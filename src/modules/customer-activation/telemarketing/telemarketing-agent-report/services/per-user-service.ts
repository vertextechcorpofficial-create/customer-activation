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
    return { call: 0, email: 0, visit: 0, meeting: 0, note: 0 };
}

function isPrimary(value: ClaimRow["is_primary"]): boolean {
    return Number(value) === 1;
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
    const activeClaimFilter = encodeURIComponent(JSON.stringify({ released_at: { _null: true } }));

    const [agentBody, activityBody, claimBody, convertedBody] = await Promise.all([
        dFetch(
            `/items/${AGENTS}?limit=-1&fields=agent_id,display_name,agent_code`,
        ),
        dFetch(
            `/items/${ACTIVITIES}?filter=${activityFilter}&limit=-1&fields=agent_id,kind,occurred_at`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${activeClaimFilter}&limit=-1&fields=lead_id,agent_id,is_primary,released_at`,
        ),
        dFetch(
            `/items/${LEADS}?filter=${convertedFilter}&limit=-1&fields=lead_id,converted_at`,
        ),
    ]);

    const agents = checked<{ data: AgentRow[] }>(agentBody, "load agents").data ?? [];
    const activities = checked<{ data: ActivityRow[] }>(activityBody, "load activities").data ?? [];
    const claims = checked<{ data: ClaimRow[] }>(claimBody, "load claims").data ?? [];
    const converted = checked<{ data: LeadRow[] }>(convertedBody, "load conversions").data ?? [];

    const claimedByAgent = new Map<number, number>();
    const primaryByLead = new Map<number, number>();
    for (const claim of claims) {
        if (claim.released_at != null) continue;
        claimedByAgent.set(claim.agent_id, (claimedByAgent.get(claim.agent_id) ?? 0) + 1);
        if (isPrimary(claim.is_primary) && !primaryByLead.has(claim.lead_id)) {
            primaryByLead.set(claim.lead_id, claim.agent_id);
        }
    }

    const conversionsByAgent = new Map<number, number>();
    for (const lead of converted) {
        if (lead.converted_at == null) continue;
        const agentId = primaryByLead.get(lead.lead_id);
        if (agentId !== undefined) {
            conversionsByAgent.set(agentId, (conversionsByAgent.get(agentId) ?? 0) + 1);
        }
    }

    const totalByAgent = new Map<number, number>();
    const breakdownByAgent = new Map<number, KindBreakdown>();
    const lastByAgent = new Map<number, string>();
    for (const activity of activities) {
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
            activity.kind === "meeting" ||
            activity.kind === "note"
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
