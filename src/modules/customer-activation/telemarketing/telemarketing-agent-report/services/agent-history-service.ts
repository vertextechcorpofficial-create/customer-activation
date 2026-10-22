import { dFetch } from "../utils/directus";
import {
    attributeConversions,
    resolveRange,
    type AttributionClaim,
    type AttributionConvertedLead,
} from "./per-user-service";
import type { ReportPeriod } from "../types/report.schema";

/**
 * Server-only. Never import from client components — the agent-detail API
 * route calls this. Single-agent history for the agent-report lane.
 */

const AGENTS = "telemarketing_agent";
const ACTIVITIES = "telemarketing_activity";
const CLAIMS = "telemarketing_lead_agent";
const LEADS = "telemarketing_lead";
const STAGES = "telemarketing_stage";

/**
 * ponytail: every read below is bounded and filtered by `agent_id` (`_eq`)
 * or by an `_in` list derived from this agent's own claims. The activity
 * table is never read with `limit=-1`: the timeline is capped at
 * ACTIVITY_RECENT_CAP rows (newest first) and KPI totals come from
 * `meta.filter_count`, so counts stay exact under the ceiling.
 */
export const ACTIVITY_RECENT_CAP = 100;
const CLAIM_CAP = 1000;
const STAGE_CAP = 100;
/**
 * ponytail: attribution subset reads below are bounded — co-claims on this
 * agent's leads are small, but the ceiling matches the per-user report's
 * claim window so the shared attribution can never see a narrower set.
 */
const ATTRIBUTION_CAP = 10_000;

export interface AgentHistoryAgent {
    agent_id: number;
    display_name: string;
    agent_code: string;
}

export interface AgentHistoryActivity {
    activity_id: number;
    lead_id: number;
    kind: string;
    outcome: string | null;
    notes: string | null;
    duration_minutes: number | null;
    occurred_at: string;
}

export interface AgentHistoryLead {
    lead_id: number;
    lead_code: string;
    company_name: string;
    stage_id: number;
    stage_name: string;
    claimed_at: string;
    converted_at: string | null;
}

export interface AgentHistory {
    agent: AgentHistoryAgent;
    period: ReportPeriod;
    start: string;
    end: string;
    kpis: {
        activities: number;
        claimed: number;
        won: number;
        conv_rate: number | null;
    };
    activities: AgentHistoryActivity[];
    /** All in-window activities (every kind) — `meta.filter_count`. */
    activities_total: number;
    /** Documented timeline ceiling: at most this many rows, newest first. */
    activities_ceiling: typeof ACTIVITY_RECENT_CAP;
    leads: AgentHistoryLead[];
    /** All in-window claims — `meta.filter_count`. */
    leads_total: number;
}

interface ClaimRow {
    lead_id: number;
    claimed_at: string;
}

interface LeadRow {
    lead_id: number;
    lead_code: string;
    company_name: string;
    stage_id: number;
    converted_at: string | null;
}

interface StageRow {
    stage_id: number;
    stage_name: string;
}

function checked<T>(body: unknown, action: string): T {
    if (body === null) throw new Error(`Failed to ${action}`);
    if (typeof body === "object" && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        throw new Error(errors?.[0]?.message ?? `Failed to ${action}`);
    }
    return body as T;
}

function one<T>(body: unknown): T | null {
    if (body !== null && typeof body === "object" && "data" in body) {
        const data = (body as { data: T }).data;
        return data === undefined ? null : data;
    }
    return null;
}

function many<T>(body: unknown): T[] {
    if (body !== null && typeof body === "object" && "data" in body) {
        const data = (body as { data: unknown }).data;
        return Array.isArray(data) ? (data as T[]) : [];
    }
    return [];
}

function totalOf(body: unknown, fallback: number): number {
    if (body !== null && typeof body === "object" && "meta" in body) {
        const meta = (body as { meta?: { filter_count?: number } }).meta;
        if (typeof meta?.filter_count === "number") return meta.filter_count;
    }
    return fallback;
}

/**
 * One agent's history for a period.
 * @param agentId - Positive-integer agent id (validated by the route).
 * @param period - Already-validated report period.
 * @returns The agent history, or null when the agent does not exist.
 */
export async function getAgentHistory(
    agentId: number,
    period: ReportPeriod,
): Promise<AgentHistory | null> {
    const { start, end } = resolveRange(period);

    const agent = one<AgentHistoryAgent>(
        await dFetch(`/items/${AGENTS}/${agentId}?fields=agent_id,display_name,agent_code`),
    );
    // Directus returns null data or an errors body for an unknown id.
    if (!agent || typeof agent.agent_id !== "number") return null;

    const agentEq = { agent_id: { _eq: agentId } };
    const kpiFilter = encodeURIComponent(
        JSON.stringify({
            _and: [agentEq, { occurred_at: { _gte: start, _lte: end } }, { kind: { _neq: "note" } }],
        }),
    );
    const recentFilter = encodeURIComponent(
        JSON.stringify({ _and: [agentEq, { occurred_at: { _gte: start, _lte: end } }] }),
    );
    const claimFilter = encodeURIComponent(
        JSON.stringify({ _and: [agentEq, { claimed_at: { _gte: start, _lte: end } }] }),
    );

    const [kpiBody, recentBody, claimBody] = await Promise.all([
        dFetch(
            `/items/${ACTIVITIES}?filter=${kpiFilter}&limit=1&meta=filter_count&fields=activity_id`,
        ),
        dFetch(
            `/items/${ACTIVITIES}?filter=${recentFilter}&sort=-occurred_at&limit=${ACTIVITY_RECENT_CAP}&meta=filter_count&fields=activity_id,lead_id,kind,outcome,notes,duration_minutes,occurred_at`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${claimFilter}&sort=-claimed_at&limit=${CLAIM_CAP}&meta=filter_count&fields=lead_id,claimed_at`,
        ),
    ]);

    const kpiChecked = checked<unknown>(kpiBody, "load agent activity total");
    const recentChecked = checked<{ data: AgentHistoryActivity[] }>(recentBody, "load agent activities");
    const claimChecked = checked<{ data: ClaimRow[] }>(claimBody, "load agent claims");

    const activities = recentChecked.data ?? [];
    const claims = claimChecked.data ?? [];
    const claimed = totalOf(claimBody, claims.length);
    const activitiesKpi = totalOf(kpiBody, 0);
    void kpiChecked;

    const leadIds = [...new Set(claims.map((c) => c.lead_id).filter((id) => Number.isInteger(id)))];
    let leadRows: LeadRow[] = [];
    if (leadIds.length > 0) {
        const leadFilter = encodeURIComponent(JSON.stringify({ lead_id: { _in: leadIds } }));
        const leadBody = await dFetch(
            `/items/${LEADS}?filter=${leadFilter}&limit=${leadIds.length}&fields=lead_id,lead_code,company_name,stage_id,converted_at`,
        );
        leadRows = many<LeadRow>(checked<unknown>(leadBody, "load claimed leads"));
    }

    const stageIds = [...new Set(leadRows.map((l) => l.stage_id).filter((id) => Number.isInteger(id)))];
    const stageName = new Map<number, string>();
    if (stageIds.length > 0) {
        const stageFilter = encodeURIComponent(JSON.stringify({ stage_id: { _in: stageIds } }));
        const stageBody = await dFetch(
            `/items/${STAGES}?filter=${stageFilter}&limit=${STAGE_CAP}&fields=stage_id,stage_name`,
        );
        for (const stage of many<StageRow>(checked<unknown>(stageBody, "load stages"))) {
            stageName.set(stage.stage_id, stage.stage_name);
        }
    }

    const claimedAt = new Map(claims.map((c) => [c.lead_id, c.claimed_at]));
    const leads: AgentHistoryLead[] = leadRows.map((lead) => ({
        lead_id: lead.lead_id,
        lead_code: lead.lead_code,
        company_name: lead.company_name,
        stage_id: lead.stage_id,
        stage_name: stageName.get(lead.stage_id) ?? "—",
        claimed_at: claimedAt.get(lead.lead_id) ?? "",
        converted_at: lead.converted_at,
    }));
    leads.sort((a, b) => (a.claimed_at < b.claimed_at ? 1 : a.claimed_at > b.claimed_at ? -1 : 0));

    // Won is the module's single shared attribution definition
    // (attributeConversions): conversions whose `converted_at` is inside the
    // period, among leads claimed inside the period, credited to exactly one
    // agent. Window membership is decided server-side with the same Directus
    // bounds as the per-user report — never by comparing ISO `T` timestamps
    // against space-separated wall-clock bounds as strings in JS (same-day
    // rows sort after the bound because 'T' > ' '). The subset below (all
    // in-window claims on this agent's leads) yields the same credit as the
    // full-window computation because attribution is per-lead.
    let won = 0;
    if (leadIds.length > 0) {
        const scopeClaimFilter = encodeURIComponent(
            JSON.stringify({
                _and: [{ lead_id: { _in: leadIds } }, { claimed_at: { _gte: start, _lte: end } }],
            }),
        );
        const scopeConvertedFilter = encodeURIComponent(
            JSON.stringify({
                _and: [{ lead_id: { _in: leadIds } }, { converted_at: { _gte: start, _lte: end } }],
            }),
        );
        const [scopeClaimBody, scopeConvertedBody] = await Promise.all([
            dFetch(
                `/items/${CLAIMS}?filter=${scopeClaimFilter}&sort=claimed_at&limit=${ATTRIBUTION_CAP}&fields=lead_id,agent_id,is_primary,claimed_at`,
            ),
            dFetch(
                `/items/${LEADS}?filter=${scopeConvertedFilter}&limit=${leadIds.length}&fields=lead_id,converted_at`,
            ),
        ]);
        const scopeClaims = many<AttributionClaim>(
            checked<unknown>(scopeClaimBody, "load attribution claims"),
        );
        const scopeConverted = many<AttributionConvertedLead>(
            checked<unknown>(scopeConvertedBody, "load attribution conversions"),
        );
        won = attributeConversions(scopeClaims, scopeConverted).get(agentId) ?? 0;
    }

    return {
        agent,
        period,
        start,
        end,
        kpis: {
            activities: activitiesKpi,
            claimed,
            won,
            conv_rate: claimed > 0 ? won / claimed : null,
        },
        activities,
        activities_total: totalOf(recentBody, activities.length),
        activities_ceiling: ACTIVITY_RECENT_CAP,
        leads,
        leads_total: claimed,
    };
}
