import { dFetch } from "../utils/directus";
import {
  parseLeaderboardPeriod,
  type LeaderboardBreakdown,
  type LeaderboardData,
  type LeaderboardMomentum,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "../types/leaderboard.schema";
// Single-owner conversion attribution — never reimplement ranking maths
// here. Both windows below attribute through this shared definition, so the
// board and the agent-report lane can never disagree on what a conversion is.
import {
  attributeConversions,
  type AttributionClaim,
  type AttributionConvertedLead,
} from "../../telemarketing-agent-report/services/per-user-service";

/**
 * Gamified agent leaderboard — server-only. API routes call this; client
 * code never imports it. All reads are bulk fetches aggregated with maps
 * (no per-agent reads).
 *
 * Scoring (fixed):
 * - window: rolling `period` days (7 | 30 | 90, default 30), Asia/Manila
 *   wall clock; plus the same-length window immediately before it.
 * - score = conversions × 3 + qualified × 2 + activities × 1
 * - conversions = converted_at in window, attributed through the shared
 *   `attributeConversions` over claims MADE in the window (claimed_at in
 *   window, regardless of release state) — one agent per conversion.
 * - qualified = leads claimed in the window whose CURRENT stage sits at or
 *   beyond "Qualification" (by stage_order) and is not lost. Semantic note:
 *   the previous board counted every actively-held claim (snapshot); the
 *   gamified contract needs a symmetric previous window, and historical
 *   stage is not reconstructible without a full scan, so both windows use
 *   windowed claims against the current stage map. Values differ from the
 *   old MTD board by design.
 * - activities = real-touch activity rows (call/email/visit/meeting) logged
 *   by that agent in the window; `note` rows (stage-move history) excluded.
 * - rank: score desc, activities desc, name asc — current and previous
 *   windows use the same comparator.
 * - momentum (org convention): `new` when previous_score is 0,
 *   `accelerating` when score/previous_score >= 1.5, `cooling` when <= 0.8,
 *   else `steady`.
 */

interface AgentRow {
  agent_id: number;
  display_name: string;
  agent_code: string;
  is_active?: boolean | 0 | 1;
}

interface StageRow {
  stage_id: number;
  stage_code: string;
  stage_name: string;
  stage_order: number;
  is_lost: boolean | 0 | 1;
}

interface ClaimRow {
  lead_id: number;
  agent_id: number;
  is_primary: boolean | 0 | 1;
  claimed_at: string;
}

interface ConvertedRow {
  lead_id: number;
  converted_at: string | null;
}

interface ClaimedLeadRow {
  lead_id: number;
  stage_id: number;
}

interface ActivityRow {
  agent_id: number;
  kind: string;
  occurred_at: string;
}

/**
 * ponytail: every read is bounded — agents/stages at *_CAP rows, each
 * windowed claims/converted/activities read capped at *_CAP rows, each
 * qualified lead read bounded by its window's claim set. Counts stay exact
 * under the ceiling; beyond it the oldest rows win via sort and the board
 * degrades gracefully instead of OOMing on limit=-1. The previous window
 * adds a constant 4 reads (claims/converted/activities/leads); nothing here
 * scales with agent count. Streaks and breakdowns come from the ONE bounded
 * activity read per window, never per-day reads.
 */
const AGENT_CAP = 10_000;
const STAGE_CAP = 10_000;
const CLAIM_CAP = 10_000;
const CONVERTED_CAP = 10_000;
const ACTIVITY_CAP = 10_000;

/** Asia/Manila wall-clock stamp `YYYY-MM-DD HH:mm:ss` for an instant. */
function manilaStamp(at: number): string {
  return new Date(at).toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * Resolve the current + previous windows for a period.
 * @returns Current [start, end] and previous [prevStart, prevEnd=start].
 */
function resolveWindows(period: LeaderboardPeriod): {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
} {
  const now = Date.now();
  const span = period * 86_400_000;
  return {
    start: manilaStamp(now - span),
    end: manilaStamp(now),
    prevStart: manilaStamp(now - 2 * span),
    prevEnd: manilaStamp(now - span),
  };
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

/** Unwrap a Directus body, turning its `errors` array into a thrown Error. */
function checked<T>(body: unknown, action: string): T {
  if (body === null) throw new Error(`Failed to ${action}`);
  if (typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ message?: string }> }).errors;
    throw new Error(errors?.[0]?.message ?? `Failed to ${action}`);
  }
  return body as T;
}

function rows<T>(body: unknown): T[] {
  const data = (body as { data?: T[] } | null)?.data;
  return Array.isArray(data) ? data : [];
}

function emptyBreakdown(): LeaderboardBreakdown {
  // Notes are excluded from counting (see below) and from the breakdown
  // type, so there is no `note` key to initialise.
  return { call: 0, email: 0, visit: 0, meeting: 0 };
}

function momentumFor(score: number, previousScore: number): LeaderboardMomentum {
  if (previousScore === 0) return "new";
  const ratio = score / previousScore;
  if (ratio >= 1.5) return "accelerating";
  if (ratio <= 0.8) return "cooling";
  return "steady";
}

/**
 * Gamified agent leaderboard for a rolling window.
 * @param period - 7 | 30 | 90 days (default 30). Anything else throws.
 * @returns The period, its Manila range, and ranked rows (rank 1..N).
 */
export async function getLeaderboard(periodInput?: unknown): Promise<LeaderboardData> {
  const period: LeaderboardPeriod = periodInput === undefined ? 30 : parseLeaderboardPeriod(periodInput);
  const { start, end, prevStart, prevEnd } = resolveWindows(period);

  const rangeFilter = (field: string, from: string, to: string): string =>
    encodeURIComponent(JSON.stringify({ [field]: { _gte: from, _lte: to } }));

  const claimFields = "lead_id,agent_id,is_primary,claimed_at";
  const [agentBody, stageBody, claimsCurBody, convCurBody, actCurBody, claimsPrevBody, convPrevBody, actPrevBody] =
    await Promise.all([
      dFetch(`/items/telemarketing_agent?limit=${AGENT_CAP}&fields=agent_id,display_name,agent_code,is_active`),
      dFetch(`/items/telemarketing_stage?limit=${STAGE_CAP}&fields=stage_id,stage_code,stage_name,stage_order,is_lost`),
      dFetch(`/items/telemarketing_lead_agent?filter=${rangeFilter("claimed_at", start, end)}&sort=claimed_at&limit=${CLAIM_CAP}&fields=${claimFields}`),
      dFetch(`/items/telemarketing_lead?filter=${rangeFilter("converted_at", start, end)}&sort=converted_at&limit=${CONVERTED_CAP}&fields=lead_id,converted_at`),
      dFetch(`/items/telemarketing_activity?filter=${rangeFilter("occurred_at", start, end)}&sort=occurred_at&limit=${ACTIVITY_CAP}&fields=agent_id,kind,occurred_at`),
      dFetch(`/items/telemarketing_lead_agent?filter=${rangeFilter("claimed_at", prevStart, prevEnd)}&sort=claimed_at&limit=${CLAIM_CAP}&fields=${claimFields}`),
      dFetch(`/items/telemarketing_lead?filter=${rangeFilter("converted_at", prevStart, prevEnd)}&sort=converted_at&limit=${CONVERTED_CAP}&fields=lead_id,converted_at`),
      dFetch(`/items/telemarketing_activity?filter=${rangeFilter("occurred_at", prevStart, prevEnd)}&sort=occurred_at&limit=${ACTIVITY_CAP}&fields=agent_id,kind,occurred_at`),
    ]);

  const agents = rows<AgentRow>(checked(agentBody, "load agents"));
  const stages = rows<StageRow>(checked(stageBody, "load stages"));
  const claimsCur = rows<ClaimRow>(checked(claimsCurBody, "load current claims"));
  const convCur = rows<ConvertedRow>(checked(convCurBody, "load current conversions"));
  const actCur = rows<ActivityRow>(checked(actCurBody, "load current activities"));
  const claimsPrev = rows<ClaimRow>(checked(claimsPrevBody, "load previous claims"));
  const convPrev = rows<ConvertedRow>(checked(convPrevBody, "load previous conversions"));
  const actPrev = rows<ActivityRow>(checked(actPrevBody, "load previous activities"));

  const stageById = new Map(stages.map((s) => [s.stage_id, s]));
  const lostIds = new Set(stages.filter((s) => Number(s.is_lost) === 1).map((s) => s.stage_id));
  const qualOrders = stages
    .filter(
      (s) =>
        s.stage_code?.toLowerCase().includes("qualif") ||
        s.stage_name?.toLowerCase().includes("qualif"),
    )
    .map((s) => s.stage_order);
  const qualOrder = qualOrders.length > 0 ? Math.min(...qualOrders) : null;

  // Conversions run through the single shared attribution definition — one
  // agent per conversion, in-window primary claimant else earliest in-window
  // claimant. Inputs are already windowed server-side with the same bounds.
  const convByAgent = (cs: ClaimRow[], ls: ConvertedRow[]): Map<number, number> =>
    attributeConversions(cs as AttributionClaim[], ls as AttributionConvertedLead[]);
  const conversionsCur = convByAgent(claimsCur, convCur);
  const conversionsPrev = convByAgent(claimsPrev, convPrev);

  // Qualified per window: leads claimed in the window whose current stage is
  // at/beyond Qualification and not lost — one bulk lead read per window.
  async function qualifiedFor(windowClaims: ClaimRow[], action: string): Promise<Map<number, number>> {
    const qualifiedByAgent = new Map<number, number>();
    if (qualOrder === null || windowClaims.length === 0) return qualifiedByAgent;
    const claimants = new Map<number, Set<number>>();
    for (const claim of windowClaims) {
      let set = claimants.get(claim.lead_id);
      if (!set) {
        set = new Set();
        claimants.set(claim.lead_id, set);
      }
      set.add(claim.agent_id);
    }
    const leadFilter = encodeURIComponent(JSON.stringify({ lead_id: { _in: [...claimants.keys()] } }));
    const leadBody = checked(
      // ponytail: bounded by the window's claim set — one bulk read, no N+1.
      await dFetch(`/items/telemarketing_lead?filter=${leadFilter}&limit=${CLAIM_CAP}&fields=lead_id,stage_id`),
      action,
    );
    for (const lead of rows<ClaimedLeadRow>(leadBody)) {
      if (lostIds.has(lead.stage_id)) continue;
      const stage = stageById.get(lead.stage_id);
      if (!stage || stage.stage_order < qualOrder) continue;
      for (const agentId of claimants.get(lead.lead_id) ?? []) {
        qualifiedByAgent.set(agentId, (qualifiedByAgent.get(agentId) ?? 0) + 1);
      }
    }
    return qualifiedByAgent;
  }

  const [qualifiedCur, qualifiedPrev] = await Promise.all([
    qualifiedFor(claimsCur, "load current qualified leads"),
    qualifiedFor(claimsPrev, "load previous qualified leads"),
  ]);

  // Activities per window from the ONE bounded activity read each: totals
  // (non-note), kind breakdowns, latest touch, and Manila active-day sets.
  function activitiesFor(list: ActivityRow[]): {
    total: Map<number, number>;
    breakdown: Map<number, LeaderboardBreakdown>;
    last: Map<number, string>;
    days: Map<number, Set<string>>;
  } {
    const total = new Map<number, number>();
    const breakdown = new Map<number, LeaderboardBreakdown>();
    const last = new Map<number, string>();
    const days = new Map<number, Set<string>>();
    for (const activity of list) {
      // Metrics-integrity: stage moves record themselves as `note`
      // activities; counting them rewards bookkeeping, not selling — the
      // activity component uses only real touches. Trade-off: manually
      // written notes are excluded too; no field distinguishes manual from
      // system notes, and that is the ceiling.
      if (activity.kind === "note") continue;
      total.set(activity.agent_id, (total.get(activity.agent_id) ?? 0) + 1);
      let entry = breakdown.get(activity.agent_id);
      if (!entry) {
        entry = emptyBreakdown();
        breakdown.set(activity.agent_id, entry);
      }
      if (
        activity.kind === "call" ||
        activity.kind === "email" ||
        activity.kind === "visit" ||
        activity.kind === "meeting"
      ) {
        entry[activity.kind] += 1;
      }
      const prev = last.get(activity.agent_id);
      if (prev === undefined || activity.occurred_at > prev) last.set(activity.agent_id, activity.occurred_at);
      if (activity.occurred_at) {
        const day = manilaDayOf(activity.occurred_at);
        if (day !== "") {
          let set = days.get(activity.agent_id);
          if (!set) {
            set = new Set();
            days.set(activity.agent_id, set);
          }
          set.add(day);
        }
      }
    }
    return { total, breakdown, last, days };
  }

  const cur = activitiesFor(actCur);
  const prev = activitiesFor(actPrev);

  const scoreOf = (
    conversions: Map<number, number>,
    qualified: Map<number, number>,
    total: Map<number, number>,
    agentId: number,
  ): number =>
    (conversions.get(agentId) ?? 0) * 3 +
    (qualified.get(agentId) ?? 0) * 2 +
    (total.get(agentId) ?? 0);

  // Rank comparator (both windows): score desc, activities desc, name asc.
  const compare = (
    a: { score: number; activities: number; displayName: string },
    b: { score: number; activities: number; displayName: string },
  ): number =>
    b.score - a.score || b.activities - a.activities || a.displayName.localeCompare(b.displayName);

  const displayNameOf = (agent: AgentRow): string =>
    agent.display_name?.trim() || `Agent ${agent.agent_id}`;

  // Previous-window ranks first (same comparator on previous scores), so
  // rank_delta is previous_rank - rank.
  const prevRanked = agents
    .filter((a) => Number.isInteger(a.agent_id))
    .map((agent) => ({
      agent_id: agent.agent_id,
      score: scoreOf(conversionsPrev, qualifiedPrev, prev.total, agent.agent_id),
      activities: prev.total.get(agent.agent_id) ?? 0,
      displayName: displayNameOf(agent),
    }))
    .filter((entry) => entry.score > 0)
    .sort(compare);
  const prevRankByAgent = new Map<number, number>();
  prevRanked.forEach((entry, index) => {
    if (!prevRankByAgent.has(entry.agent_id)) prevRankByAgent.set(entry.agent_id, index + 1);
  });

  // Streaks: consecutive Manila days with >=1 real activity, walking back
  // from today; grace for the current day (start at yesterday when today is
  // empty but yesterday is not). Lookback capped at the period length, and
  // the day sets come from the single bounded current-window activity read.
  const todayKey = manilaStamp(Date.now()).slice(0, 10);
  const yesterdayKey = manilaStamp(Date.now() - 86_400_000).slice(0, 10);

  function streakFor(agentId: number): number {
    const active = cur.days.get(agentId);
    if (!active || active.size === 0) return 0;
    let cursor: string | null = null;
    if (active.has(todayKey)) cursor = todayKey;
    else if (active.has(yesterdayKey)) cursor = yesterdayKey;
    else return 0;
    let streak = 0;
    let cursorAt = cursor === todayKey ? Date.now() : Date.now() - 86_400_000;
    for (let i = 0; i < period; i++) {
      const key = manilaStamp(cursorAt).slice(0, 10);
      if (!active.has(key)) break;
      streak += 1;
      cursorAt -= 86_400_000;
    }
    return streak;
  }

  const ranked = agents
    .filter((a) => Number.isInteger(a.agent_id))
    .filter((a) => a.is_active === undefined || Number(a.is_active) === 1)
    .map((agent) => {
      const conversions = conversionsCur.get(agent.agent_id) ?? 0;
      const qualified = qualifiedCur.get(agent.agent_id) ?? 0;
      const activityCount = cur.total.get(agent.agent_id) ?? 0;
      const score = conversions * 3 + qualified * 2 + activityCount;
      const previousScore = scoreOf(conversionsPrev, qualifiedPrev, prev.total, agent.agent_id);
      const displayName = displayNameOf(agent);
      return {
        agent_id: agent.agent_id,
        display_name: displayName,
        name: displayName,
        agent_code: agent.agent_code ?? "",
        score,
        conversions,
        qualified,
        activities: activityCount,
        previous_score: previousScore,
        displayName,
      };
    })
    .sort(compare);

  const rowsOut: LeaderboardRow[] = ranked.map((entry, index) => {
    const rank = index + 1;
    const previousRank = prevRankByAgent.get(entry.agent_id) ?? null;
    const breakdown = cur.breakdown.get(entry.agent_id) ?? emptyBreakdown();
    return {
      agent_id: entry.agent_id,
      display_name: entry.display_name,
      name: entry.name,
      agent_code: entry.agent_code,
      score: entry.score,
      conversions: entry.conversions,
      qualified: entry.qualified,
      activities: entry.activities,
      breakdown,
      previous_score: entry.previous_score,
      score_delta_pct:
        entry.previous_score === 0
          ? null
          : Math.round(((entry.score - entry.previous_score) / entry.previous_score) * 1000) / 10,
      momentum: momentumFor(entry.score, entry.previous_score),
      rank,
      previous_rank: previousRank,
      rank_delta: previousRank === null ? 0 : previousRank - rank,
      streak_days: streakFor(entry.agent_id),
      last_activity_at: cur.last.get(entry.agent_id) ?? null,
    };
  });

  return { period, range: { start, end }, rows: rowsOut };
}
