import { dFetch } from "../utils/directus";
import {
    attributeConversions,
    resolveRange,
    resolveReportWindows,
    type AttributionClaim,
    type AttributionConvertedLead,
} from "./per-user-service";
import type {
    AgentHistoryDeltas,
    AgentHistoryKpi,
    AgentHistoryPeriod,
    AgentHistoryRank,
    AgentHistoryTeam,
    KindBreakdown,
} from "../types/report.schema";

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
 * ponytail: every read below is bounded. Per-agent reads are filtered by
 * `agent_id` (`_eq`) or by an `_in` list derived from this agent's own
 * claims; team/rank reads are bulk windowed reads capped at *_CAP rows
 * (bounded constant, never per-agent). The activity table is never read
 * with `limit=-1`: the timeline is capped at ACTIVITY_RECENT_CAP rows
 * (newest first) and KPI totals come from `meta.filter_count`, so counts
 * stay exact under the ceiling.
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
const AGENT_CAP = 10_000;
const BULK_ACTIVITY_CAP = 10_000;
const BULK_CLAIM_CAP = 10_000;
const BULK_CONVERTED_CAP = 10_000;
const STREAK_CAP = 10_000;

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
    lead_company?: string | null;
    lead_code?: string | null;
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
    period: AgentHistoryPeriod;
    start: string;
    end: string;
    kpis: AgentHistoryKpi;
    /** Same-length window immediately before the current one. */
    previous: AgentHistoryKpi;
    /**
     * activities/claimed/won are percent change (one decimal, null when the
     * previous value is 0/missing); conv_rate is a percentage-point
     * difference, null only when the previous window has no claims.
     */
    deltas: AgentHistoryDeltas;
    /**
     * Team comparison context. `agents` is the full roster count (includes
     * zero-activity agents); the `avg_*` averages use only touch-or-claim
     * active agents as denominator so idle roster members cannot drag the
     * averages toward zero — the averages stay comparable to `kpis`, which
     * use the same touch definition. `avg_conv_rate` is the team rate
     * (total won / total claimed over active agents, null when no active
     * claims), not the mean of per-agent ratios, because mean-of-ratios
     * overweights low-claim agents.
     */
    team: AgentHistoryTeam;
    /**
     * Rank by won desc, then activities desc, then display name asc over the
     * full roster in the current window (same comparator shape as the
     * leaderboard, restricted to this lane's won/activities metrics).
     * `of` equals `team.agents`.
     */
    rank: AgentHistoryRank;
    /** Current-period kind counts for this agent; `note` rows excluded. */
    breakdown: KindBreakdown;
    /**
     * Consecutive Manila days with >=1 non-note activity, walking back from
     * today with grace for the current day (starts at yesterday when today
     * is empty but yesterday is not). Lookback capped at the window length.
     */
    streak_days: number;
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

interface BulkAgentRow {
    agent_id: number;
    display_name: string;
    agent_code: string;
}

interface BulkActivityRow {
    agent_id: number;
    kind: string;
    occurred_at: string;
}

interface BulkClaimRow {
    lead_id: number;
    agent_id: number;
    is_primary: boolean | 0 | 1;
    claimed_at: string;
}

interface BulkConvertedRow {
    lead_id: number;
    converted_at: string | null;
}

interface StreakRow {
    occurred_at: string;
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

/** Asia/Manila wall-clock stamp `YYYY-MM-DD HH:mm:ss` for an instant. */
function manilaStamp(at: number): string {
    return new Date(at).toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** Manila calendar day `YYYY-MM-DD` for an activity timestamp. */
function manilaDayOf(value: string): string {
    // Wall-clock stamps stored by Directus (`YYYY-MM-DD HH:mm:ss`) are already
    // Manila wall time — slice, don't reinterpret them in server-local time.
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) return value.slice(0, 10);
    const at = new Date(value).getTime();
    if (Number.isNaN(at)) return "";
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(at));
}

interface HistoryWindows {
    start: string;
    end: string;
    prevStart: string;
    prevEnd: string;
    /** Window length in days; caps the streak lookback. */
    days: number;
}

/**
 * Current + previous windows. Numeric periods reuse the shared dashboard
 * windows; legacy calendar periods use `resolveRange` for the current
 * window and the same-length window immediately before it (prevEnd =
 * current start). The legacy span is the difference of the two wall-clock
 * bounds parsed in one zone — the zone offset cancels, so the length is
 * exact even though the strings are Manila wall time.
 */
function resolveHistoryWindows(period: AgentHistoryPeriod): HistoryWindows {
    if (typeof period === "number") {
        const windows = resolveReportWindows(period);
        return { ...windows, days: period };
    }
    const { start, end } = resolveRange(period);
    const rawSpan = Date.parse(end.replace(" ", "T")) - Date.parse(start.replace(" ", "T"));
    const spanMs =
        Number.isFinite(rawSpan) && rawSpan > 0 ? rawSpan : 30 * 86_400_000;
    const now = Date.now();
    return {
        start,
        end,
        prevStart: manilaStamp(now - 2 * spanMs),
        prevEnd: start,
        days: Math.max(1, Math.ceil(spanMs / 86_400_000)),
    };
}

/**
 * Percent change, one decimal. Null when the previous value is 0 or
 * missing — there is no percent change from zero.
 */
function pctChange(current: number, previous: number): number | null {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Rate delta in percentage points, one decimal:
 * round1((current_rate - previous_rate) * 100). Null only when the previous
 * window has no claims (no baseline) — NOT merely when the previous rate is
 * 0. Percent-change on a ratio with a small base produces absurd numbers
 * (e.g. 6.7% -> 100% would read +1400%); points stay interpretable.
 */
function rateDeltaPoints(
    current: number | null,
    previous: number | null,
): number | null {
    if (previous === null || current === null) return null;
    return Math.round((current - previous) * 1000) / 10;
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

function kpiOf(activities: number, claimed: number, won: number): AgentHistoryKpi {
    return { activities, claimed, won, conv_rate: claimed > 0 ? won / claimed : null };
}

function deltasOf(current: AgentHistoryKpi, previous: AgentHistoryKpi): AgentHistoryDeltas {
    return {
        activities: pctChange(current.activities, previous.activities),
        claimed: pctChange(current.claimed, previous.claimed),
        won: pctChange(current.won, previous.won),
        conv_rate: rateDeltaPoints(current.conv_rate, previous.conv_rate),
    };
}

/**
 * One agent's history for a period.
 * @param agentId - Positive-integer agent id (validated by the route).
 * @param period - Already-validated history period (legacy calendar or rolling days).
 * @returns The agent history, or null when the agent does not exist.
 */
export async function getAgentHistory(
    agentId: number,
    period: AgentHistoryPeriod,
): Promise<AgentHistory | null> {
    const { start, end, prevStart, prevEnd, days } = resolveHistoryWindows(period);

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
    const prevKpiFilter = encodeURIComponent(
        JSON.stringify({
            _and: [
                agentEq,
                { occurred_at: { _gte: prevStart, _lte: prevEnd } },
                { kind: { _neq: "note" } },
            ],
        }),
    );
    const prevClaimFilter = encodeURIComponent(
        JSON.stringify({ _and: [agentEq, { claimed_at: { _gte: prevStart, _lte: prevEnd } }] }),
    );

    const [kpiBody, recentBody, claimBody, prevKpiBody, prevClaimBody] = await Promise.all([
        dFetch(
            `/items/${ACTIVITIES}?filter=${kpiFilter}&limit=1&meta=filter_count&fields=activity_id`,
        ),
        dFetch(
            `/items/${ACTIVITIES}?filter=${recentFilter}&sort=-occurred_at&limit=${ACTIVITY_RECENT_CAP}&meta=filter_count&fields=activity_id,lead_id,kind,outcome,notes,duration_minutes,occurred_at`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${claimFilter}&sort=-claimed_at&limit=${CLAIM_CAP}&meta=filter_count&fields=lead_id,claimed_at`,
        ),
        dFetch(
            `/items/${ACTIVITIES}?filter=${prevKpiFilter}&limit=1&meta=filter_count&fields=activity_id`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${prevClaimFilter}&sort=-claimed_at&limit=${CLAIM_CAP}&meta=filter_count&fields=lead_id,claimed_at`,
        ),
    ]);

    const kpiChecked = checked<unknown>(kpiBody, "load agent activity total");
    const recentChecked = checked<{ data: AgentHistoryActivity[] }>(recentBody, "load agent activities");
    const claimChecked = checked<{ data: ClaimRow[] }>(claimBody, "load agent claims");
    const prevKpiChecked = checked<unknown>(prevKpiBody, "load agent previous activity total");
    const prevClaimChecked = checked<{ data: ClaimRow[] }>(prevClaimBody, "load agent previous claims");

    const activities = recentChecked.data ?? [];
    const claims = claimChecked.data ?? [];
    const claimed = totalOf(claimBody, claims.length);
    const activitiesKpi = totalOf(kpiBody, 0);
    const prevClaims = prevClaimChecked.data ?? [];
    const prevClaimed = totalOf(prevClaimBody, prevClaims.length);
    const prevActivities = totalOf(prevKpiBody, 0);
    void kpiChecked;
    void prevKpiChecked;

    // Timeline lead names: one bounded read of `telemarketing_lead`
    // (`_in`, fields `lead_id,lead_code,company_name`) for the distinct
    // activity `lead_id`s — never per-row. Attached null-safe below.
    const activityLeadIds = [
        ...new Set(activities.map((a) => a.lead_id).filter((id) => Number.isInteger(id))),
    ];
    if (activityLeadIds.length > 0) {
        const activityLeadFilter = encodeURIComponent(
            JSON.stringify({ lead_id: { _in: activityLeadIds } }),
        );
        const activityLeadBody = await dFetch(
            `/items/${LEADS}?filter=${activityLeadFilter}&limit=${activityLeadIds.length}&fields=lead_id,lead_code,company_name`,
        );
        const activityLeadMap = new Map<number, { code: string | null; company: string | null }>();
        for (const row of many<LeadRow>(checked<unknown>(activityLeadBody, "load activity leads"))) {
            activityLeadMap.set(row.lead_id, {
                code: row.lead_code ?? null,
                company: row.company_name ?? null,
            });
        }
        for (const activity of activities) {
            const info = activityLeadMap.get(activity.lead_id);
            activity.lead_company = info?.company ?? null;
            activity.lead_code = info?.code ?? null;
        }
    } else {
        for (const activity of activities) {
            activity.lead_company = null;
            activity.lead_code = null;
        }
    }

    const leadIds = [...new Set(claims.map((c) => c.lead_id).filter((id) => Number.isInteger(id)))];
    const prevLeadIds = [
        ...new Set(prevClaims.map((c) => c.lead_id).filter((id) => Number.isInteger(id))),
    ];
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
    // full-window computation because attribution is per-lead. The previous
    // window reuses the same shared function with the previous bounds —
    // never a second implementation.
    async function attributedWon(
        ids: number[],
        windowStart: string,
        windowEnd: string,
        action: string,
    ): Promise<number> {
        if (ids.length === 0) return 0;
        const scopeClaimFilter = encodeURIComponent(
            JSON.stringify({
                _and: [{ lead_id: { _in: ids } }, { claimed_at: { _gte: windowStart, _lte: windowEnd } }],
            }),
        );
        const scopeConvertedFilter = encodeURIComponent(
            JSON.stringify({
                _and: [{ lead_id: { _in: ids } }, { converted_at: { _gte: windowStart, _lte: windowEnd } }],
            }),
        );
        const [scopeClaimBody, scopeConvertedBody] = await Promise.all([
            dFetch(
                `/items/${CLAIMS}?filter=${scopeClaimFilter}&sort=claimed_at&limit=${ATTRIBUTION_CAP}&fields=lead_id,agent_id,is_primary,claimed_at`,
            ),
            dFetch(
                `/items/${LEADS}?filter=${scopeConvertedFilter}&limit=${ids.length}&fields=lead_id,converted_at`,
            ),
        ]);
        const scopeClaims = many<AttributionClaim>(
            checked<unknown>(scopeClaimBody, `load ${action} attribution claims`),
        );
        const scopeConverted = many<AttributionConvertedLead>(
            checked<unknown>(scopeConvertedBody, `load ${action} attribution conversions`),
        );
        return attributeConversions(scopeClaims, scopeConverted).get(agentId) ?? 0;
    }

    const [won, prevWon] = await Promise.all([
        attributedWon(leadIds, start, end, "current"),
        attributedWon(prevLeadIds, prevStart, prevEnd, "previous"),
    ]);

    const kpis = kpiOf(activitiesKpi, claimed, won);
    const previous = kpiOf(prevActivities, prevClaimed, prevWon);
    const deltas = deltasOf(kpis, previous);

    // Breakdown: exact per-kind counts via `filter_count` (a count is all
    // that is needed — no row reads). Notes excluded by construction.
    const breakdownKinds = ["call", "email", "visit", "meeting"] as const;
    const breakdownBodies = await Promise.all(
        breakdownKinds.map((kind) => {
            const filter = encodeURIComponent(
                JSON.stringify({
                    _and: [agentEq, { occurred_at: { _gte: start, _lte: end } }, { kind: { _eq: kind } }],
                }),
            );
            return dFetch(
                `/items/${ACTIVITIES}?filter=${filter}&limit=1&meta=filter_count&fields=activity_id`,
            );
        }),
    );
    const breakdown: KindBreakdown = {
        call: totalOf(checked<unknown>(breakdownBodies[0], "load call breakdown"), 0),
        email: totalOf(checked<unknown>(breakdownBodies[1], "load email breakdown"), 0),
        visit: totalOf(checked<unknown>(breakdownBodies[2], "load visit breakdown"), 0),
        meeting: totalOf(checked<unknown>(breakdownBodies[3], "load meeting breakdown"), 0),
    };

    // Streak: one bounded occurred_at-only read (newest first); the day set
    // is built in JS and walked back with today-grace, capped at the window
    // length. Notes excluded server-side.
    const streakFilter = encodeURIComponent(
        JSON.stringify({
            _and: [agentEq, { occurred_at: { _gte: start, _lte: end } }, { kind: { _neq: "note" } }],
        }),
    );
    const streakBody = await dFetch(
        `/items/${ACTIVITIES}?filter=${streakFilter}&sort=-occurred_at&limit=${STREAK_CAP}&fields=occurred_at`,
    );
    const activeDays = new Set(
        many<StreakRow>(checked<unknown>(streakBody, "load streak days"))
            .map((row) => manilaDayOf(row.occurred_at))
            .filter((day) => day !== ""),
    );
    const todayKey = manilaStamp(Date.now()).slice(0, 10);
    const yesterdayKey = manilaStamp(Date.now() - 86_400_000).slice(0, 10);
    let streak_days = 0;
    if (activeDays.size > 0) {
        let cursorAt = -1;
        if (activeDays.has(todayKey)) cursorAt = Date.now();
        else if (activeDays.has(yesterdayKey)) cursorAt = Date.now() - 86_400_000;
        if (cursorAt >= 0) {
            for (let i = 0; i < days; i++) {
                if (!activeDays.has(manilaStamp(cursorAt).slice(0, 10))) break;
                streak_days += 1;
                cursorAt -= 86_400_000;
            }
        }
    }

    // Team + rank: four bounded bulk windowed reads (bounded constant, never
    // per-agent), aggregated in JS with maps — the same pattern as the
    // per-user report. Won reuses the shared `attributeConversions`.
    const rangeFilter = (field: string, from: string, to: string): string =>
        encodeURIComponent(JSON.stringify({ [field]: { _gte: from, _lte: to } }));
    const [rosterBody, bulkActivityBody, bulkClaimBody, bulkConvertedBody] = await Promise.all([
        dFetch(`/items/${AGENTS}?limit=${AGENT_CAP}&fields=agent_id,display_name,agent_code`),
        dFetch(
            `/items/${ACTIVITIES}?filter=${rangeFilter("occurred_at", start, end)}&sort=occurred_at&limit=${BULK_ACTIVITY_CAP}&fields=agent_id,kind,occurred_at`,
        ),
        dFetch(
            `/items/${CLAIMS}?filter=${rangeFilter("claimed_at", start, end)}&sort=claimed_at&limit=${BULK_CLAIM_CAP}&fields=lead_id,agent_id,is_primary,claimed_at`,
        ),
        dFetch(
            `/items/${LEADS}?filter=${rangeFilter("converted_at", start, end)}&sort=converted_at&limit=${BULK_CONVERTED_CAP}&fields=lead_id,converted_at`,
        ),
    ]);
    const roster = many<BulkAgentRow>(checked<unknown>(rosterBody, "load team roster")).filter(
        (row) => Number.isInteger(row.agent_id),
    );
    const rosterName = new Map(
        roster.map((row) => [row.agent_id, row.display_name?.trim() || `Agent ${row.agent_id}`]),
    );
    const teamActivities = new Map<number, number>();
    for (const row of many<BulkActivityRow>(checked<unknown>(bulkActivityBody, "load team activities"))) {
        if (row.kind === "note" || !Number.isInteger(row.agent_id)) continue;
        teamActivities.set(row.agent_id, (teamActivities.get(row.agent_id) ?? 0) + 1);
    }
    const teamClaimed = new Map<number, number>();
    const bulkClaims = many<BulkClaimRow>(checked<unknown>(bulkClaimBody, "load team claims"));
    for (const row of bulkClaims) {
        if (!Number.isInteger(row.agent_id)) continue;
        teamClaimed.set(row.agent_id, (teamClaimed.get(row.agent_id) ?? 0) + 1);
    }
    const teamWon = attributeConversions(
        bulkClaims as AttributionClaim[],
        many<BulkConvertedRow>(
            checked<unknown>(bulkConvertedBody, "load team conversions"),
        ) as AttributionConvertedLead[],
    );

    const activeIds = roster
        .map((row) => row.agent_id)
        .filter(
            (id) => (teamActivities.get(id) ?? 0) > 0 || (teamClaimed.get(id) ?? 0) > 0,
        );
    const denom = activeIds.length;
    const sumOf = (pick: (id: number) => number): number =>
        activeIds.reduce((sum, id) => sum + pick(id), 0);
    const totalClaimed = sumOf((id) => teamClaimed.get(id) ?? 0);
    const totalWon = sumOf((id) => teamWon.get(id) ?? 0);
    const team: AgentHistoryTeam = {
        agents: roster.length,
        avg_activities: denom > 0 ? round1(sumOf((id) => teamActivities.get(id) ?? 0) / denom) : 0,
        avg_claimed: denom > 0 ? round1(totalClaimed / denom) : 0,
        avg_won: denom > 0 ? round1(totalWon / denom) : 0,
        avg_conv_rate: totalClaimed > 0 ? totalWon / totalClaimed : null,
    };

    const ordered = roster.map((row) => ({
        id: row.agent_id,
        won: teamWon.get(row.agent_id) ?? 0,
        act: teamActivities.get(row.agent_id) ?? 0,
        name: rosterName.get(row.agent_id) ?? `Agent ${row.agent_id}`,
    }));
    if (!ordered.some((entry) => entry.id === agentId)) {
        // Cap overflow guard: the agent exists (fetched above) but fell
        // outside the roster cap — rank it against the known set anyway.
        ordered.push({
            id: agentId,
            won: teamWon.get(agentId) ?? 0,
            act: teamActivities.get(agentId) ?? 0,
            name: agent.display_name?.trim() || `Agent ${agentId}`,
        });
    }
    ordered.sort((a, b) => b.won - a.won || b.act - a.act || a.name.localeCompare(b.name));
    const rank: AgentHistoryRank = {
        position: ordered.findIndex((entry) => entry.id === agentId) + 1,
        of: ordered.length,
    };

    return {
        agent,
        period,
        start,
        end,
        kpis,
        previous,
        deltas,
        team,
        rank,
        breakdown,
        streak_days,
        activities,
        activities_total: totalOf(recentBody, activities.length),
        activities_ceiling: ACTIVITY_RECENT_CAP,
        leads,
        leads_total: claimed,
    };
}
