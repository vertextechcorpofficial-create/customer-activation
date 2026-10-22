import { dFetch } from "../utils/directus";
import {
    ReportPeriodSchema,
    type AgentReportRow,
    type KindBreakdown,
    type PerUserReport,
    type ReportPeriod,
} from "../types/report.schema";

/**
 * Server-only. Never import from client components — the API route calls this.
 * Aggregates per-agent metrics in JS with maps (four Directus reads, no N+1).
 */

const AGENTS = "telemarketing_agent";
const ACTIVITIES = "telemarketing_activity";
const CLAIMS = "telemarketing_lead_agent";
const LEADS = "telemarketing_lead";

/**
 * ponytail: period reads are bounded — agents (registration-only roster) at
 * AGENT_CAP rows, activities capped at ACTIVITY_CAP rows,
 * in-window active claims at CLAIM_CAP rows, in-window conversions at
 * CONVERTED_CAP rows. Counts stay exact under the ceiling; beyond it the
 * oldest rows win via sort and the report degrades gracefully instead of
 * OOMing on limit=-1.
 */
const AGENT_CAP = 10_000;
const ACTIVITY_CAP = 10_000;
const CLAIM_CAP = 10_000;
const CONVERTED_CAP = 10_000;

interface AgentRow {
    agent_id: number;
    display_name: string;
    agent_code: string;
}

interface ActivityRow {
    agent_id: number;
    kind: string;
    occurred_at: string;
}

interface ClaimRow {
    lead_id: number;
    agent_id: number;
    is_primary: boolean | 0 | 1;
    claimed_at: string;
    released_at: string | null;
}

interface LeadRow {
    lead_id: number;
    converted_at: string | null;
}

export interface PerUserReportArgs {
    period?: unknown;
}

function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function manilaNowParts(): { stamp: string; date: string } {
    const stamp = phNow();
    return { stamp, date: stamp.slice(0, 10) };
}

/** [start, end] wall-clock bounds for a period, Asia/Manila. */
export function resolveRange(period: ReportPeriod): { start: string; end: string } {
    const { stamp, date } = manilaNowParts();
    if (period === "last_30" || period === "last_90") {
        const days = period === "last_30" ? 30 : 90;
        const start = new Date(Date.now() - days * 86400000).toLocaleString("sv-SE", {
            timeZone: "Asia/Manila",
        });
        return { start, end: stamp };
    }
    return { start: `${date.slice(0, 7)}-01 00:00:00`, end: stamp };
}

function checked<T>(body: unknown, action: string): T {
    if (body === null) throw new Error(`Failed to ${action}`);
    if (typeof body === "object" && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        throw new Error(errors?.[0]?.message ?? `Failed to ${action}`);
    }
    return body as T;
}

function emptyBreakdown(): KindBreakdown {
    // Notes are excluded from counting (see below) and from the breakdown
    // type, so there is no `note` key to initialise.
    return { call: 0, email: 0, visit: 0, meeting: 0 };
}

function isPrimary(value: ClaimRow["is_primary"]): boolean {
    return Number(value) === 1;
}

/**
 * Module-wide conversion-attribution definition (single owner).
 * Conversions whose `converted_at` is inside the period, among leads
 * claimed inside the period, credited to exactly one agent: the in-window
 * primary claimant, else the earliest in-window claimant by claimed_at.
 * One agent per conversion, so a rate can never exceed 100%. Both the
 * per-user report and the agent-history KPI call this — never reimplement
 * it. Inputs must already be windowed (callers filter server-side with the
 * same Directus `_gte`/`_lte` bounds); this function only attributes.
 */
export interface AttributionClaim {
    lead_id: number;
    agent_id: number;
    is_primary: boolean | 0 | 1;
    claimed_at: string;
}

export interface AttributionConvertedLead {
    lead_id: number;
    converted_at: string | null;
}

export function attributeConversions(
    claims: AttributionClaim[],
    convertedLeads: AttributionConvertedLead[],
): Map<number, number> {
    const primaryByLead = new Map<number, number>();
    // Single-agent fallback: lead with no in-window primary claim attributes
    // to its earliest in-window claimant. Exactly one agent per lead, so the
    // rate cannot exceed 100% by double-crediting a conversion. Compared by
    // claimed_at explicitly so the fallback never depends on result ordering.
    const earliestByLead = new Map<number, AttributionClaim>();
    for (const claim of claims) {
        if (isPrimary(claim.is_primary) && !primaryByLead.has(claim.lead_id)) {
            primaryByLead.set(claim.lead_id, claim.agent_id);
        }
        const prev = earliestByLead.get(claim.lead_id);
        if (prev === undefined || claim.claimed_at < prev.claimed_at) {
            earliestByLead.set(claim.lead_id, claim);
        }
    }

    const conversionsByAgent = new Map<number, number>();
    for (const lead of convertedLeads) {
        if (lead.converted_at == null) continue;
        const agentId =
            primaryByLead.get(lead.lead_id) ?? earliestByLead.get(lead.lead_id)?.agent_id;
        if (agentId !== undefined) {
            conversionsByAgent.set(agentId, (conversionsByAgent.get(agentId) ?? 0) + 1);
        }
    }
    return conversionsByAgent;
}

/** Per-agent activity totals, kind breakdowns and conversion counts. */
export async function listPerUserReport(args: PerUserReportArgs): Promise<PerUserReport> {
    const parsed = ReportPeriodSchema.safeParse(args.period ?? "mtd");
    const period: ReportPeriod = parsed.success ? parsed.data : "mtd";
    const { start, end } = resolveRange(period);

    const activityFilter = encodeURIComponent(
        JSON.stringify({ occurred_at: { _gte: start, _lte: end } }),
    );
    const convertedFilter = encodeURIComponent(
        JSON.stringify({ converted_at: { _gte: start, _lte: end } }),
    );
    // Claimed shares the window: claims MADE inside the period (claimed_at
    // between start and end), REGARDLESS of release state. A released claim
    // was still a claim made in-window, and its conversion must stay
    // attributable — filtering on released_at here silently drops real
    // conversions from both sides. Conversions are attributed through this
    // same claim set, so numerator and denominator describe one window.
    const periodClaimFilter = encodeURIComponent(
        JSON.stringify({ claimed_at: { _gte: start, _lte: end } }),
    );

    const [agentBody, activityBody, claimBody, convertedBody] = await Promise.all([
        dFetch(
            `/items/${AGENTS}?limit=${AGENT_CAP}&fields=agent_id,display_name,agent_code`,
        ),
        dFetch(
            `/items/${ACTIVITIES}?filter=${activityFilter}&sort=occurred_at&limit=${ACTIVITY_CAP}&fields=agent_id,kind,occurred_at`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${periodClaimFilter}&sort=claimed_at&limit=${CLAIM_CAP}&fields=lead_id,agent_id,is_primary,claimed_at,released_at`,
        ),
        dFetch(
            `/items/${LEADS}?filter=${convertedFilter}&sort=converted_at&limit=${CONVERTED_CAP}&fields=lead_id,converted_at`,
        ),
    ]);

    const agents = checked<{ data: AgentRow[] }>(agentBody, "load agents").data ?? [];
    const activities = checked<{ data: ActivityRow[] }>(activityBody, "load activities").data ?? [];
    const claims = checked<{ data: ClaimRow[] }>(claimBody, "load claims").data ?? [];
    const converted = checked<{ data: LeadRow[] }>(convertedBody, "load conversions").data ?? [];

    const claimedByAgent = new Map<number, number>();
    for (const claim of claims) {
        claimedByAgent.set(claim.agent_id, (claimedByAgent.get(claim.agent_id) ?? 0) + 1);
    }

    // Conversions are attributed through the in-window claim set above, so
    // numerator and denominator describe one window.
    const conversionsByAgent = attributeConversions(claims, converted);

    const totalByAgent = new Map<number, number>();
    const breakdownByAgent = new Map<number, KindBreakdown>();
    const lastByAgent = new Map<number, string>();
    for (const activity of activities) {
        // Metrics-integrity: stage moves record themselves as `note`
        // activities (the lead's stage history for the timeline), so counting
        // them rewards bookkeeping, not selling — exclude notes from the total
        // and the breakdown. Trade-off: a manually written note (the activity
        // form allows kind=note with free text) is excluded too; there is
        // currently no field distinguishing manual from system notes, and that
        // is the ceiling. Note rows are still written and read elsewhere.
        if (activity.kind === "note") continue;
        totalByAgent.set(activity.agent_id, (totalByAgent.get(activity.agent_id) ?? 0) + 1);
        let breakdown = breakdownByAgent.get(activity.agent_id);
        if (!breakdown) {
            breakdown = emptyBreakdown();
            breakdownByAgent.set(activity.agent_id, breakdown);
        }
        if (
            activity.kind === "call" ||
            activity.kind === "email" ||
            activity.kind === "visit" ||
            activity.kind === "meeting"
        ) {
            breakdown[activity.kind] += 1;
        }
        const prev = lastByAgent.get(activity.agent_id);
        if (prev === undefined || activity.occurred_at > prev) {
            lastByAgent.set(activity.agent_id, activity.occurred_at);
        }
    }

    const rows: AgentReportRow[] = agents.map((agent) => ({
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        agent_code: agent.agent_code,
        activities_total: totalByAgent.get(agent.agent_id) ?? 0,
        breakdown: breakdownByAgent.get(agent.agent_id) ?? emptyBreakdown(),
        leads_claimed: claimedByAgent.get(agent.agent_id) ?? 0,
        conversions: conversionsByAgent.get(agent.agent_id) ?? 0,
        last_activity_at: lastByAgent.get(agent.agent_id) ?? null,
    }));
    rows.sort((a, b) => b.conversions - a.conversions || b.activities_total - a.activities_total);

    return { period, start, end, rows };
}
