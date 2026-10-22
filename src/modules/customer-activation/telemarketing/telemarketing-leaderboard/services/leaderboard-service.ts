import { dFetch } from "../utils/directus";
import type { LeaderboardRow } from "../types/leaderboard.schema";

/**
 * User-leaderboard service — server-only. API routes call this; client code
 * never imports it. All reads are bulk fetches aggregated with maps (no N+1).
 *
 * Scoring (fixed):
 * - window: month-to-date (Asia/Manila)
 * - score = conversions × 3 + qualified × 2 + activities × 1
 * - conversions = leads with converted_at in window where the agent is the
 *   active is_primary claimant
 * - qualified = leads the agent actively claims that currently sit at or
 *   beyond the "Qualification" stage (by stage_order) and are not lost
 * - activities = real-touch activity rows (call/email/visit/meeting) logged
 *   by that agent in the window; `note` rows (stage-move history) are excluded
 */

interface AgentRow {
  agent_id: number;
  display_name: string;
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
  released_at: string | null;
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
  activity_id: number;
  agent_id: number;
  kind: string;
}

/**
 * ponytail: reads are bounded — agents/stages/claims/conversions/activities
 * capped at *_CAP rows. Counts stay exact under the ceiling; beyond it the
 * oldest rows win via sort and the board degrades gracefully instead of
 * OOMing on limit=-1.
 */
const AGENT_CAP = 10_000;
const STAGE_CAP = 10_000;
const CLAIM_CAP = 10_000;
const CONVERTED_CAP = 10_000;
const ACTIVITY_CAP = 10_000;

/** Month-to-date start as PH wall time `YYYY-MM-01 00:00:00`. */
function manilaMonthStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}-01 00:00:00`;
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

/**
 * Month-to-date agent leaderboard, ranked by score desc with tie-breaks:
 * more conversions, then more qualified, then name asc.
 * @returns {Promise<LeaderboardRow[]>} Ranked rows, rank assigned 1..N.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const monthStart = manilaMonthStart();
  const convFilter = encodeURIComponent(JSON.stringify({ converted_at: { _gte: monthStart } }));
  const actFilter = encodeURIComponent(JSON.stringify({ occurred_at: { _gte: monthStart } }));

  const [agentBody, stageBody, claimBody, convertedBody, activityBody] = await Promise.all([
    dFetch(`/items/telemarketing_agent?limit=${AGENT_CAP}&fields=agent_id,display_name,is_active`),
    dFetch(`/items/telemarketing_stage?limit=${STAGE_CAP}&fields=stage_id,stage_code,stage_name,stage_order,is_lost`),
    dFetch(`/items/telemarketing_lead_agent?limit=${CLAIM_CAP}&fields=lead_id,agent_id,is_primary,released_at`),
    dFetch(`/items/telemarketing_lead?filter=${convFilter}&sort=converted_at&limit=${CONVERTED_CAP}&fields=lead_id,converted_at`),
    dFetch(`/items/telemarketing_activity?filter=${actFilter}&sort=occurred_at&limit=${ACTIVITY_CAP}&fields=activity_id,agent_id,kind`),
  ]);

  const agents = rows<AgentRow>(checked(agentBody, "load agents"));
  const stages = rows<StageRow>(checked(stageBody, "load stages"));
  const claims = rows<ClaimRow>(checked(claimBody, "load claims"));
  const converted = rows<ConvertedRow>(checked(convertedBody, "load converted leads"));
  const activities = rows<ActivityRow>(checked(activityBody, "load activities"));

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

  const activeClaims = claims.filter((c) => c.released_at == null);

  // Lead -> active primary claimant (first wins on duplicates).
  const primaryByLead = new Map<number, number>();
  for (const claim of activeClaims) {
    if (Number(claim.is_primary) !== 1) continue;
    if (!primaryByLead.has(claim.lead_id)) primaryByLead.set(claim.lead_id, claim.agent_id);
  }

  // Lead -> active claimant agents (for qualified counts).
  const claimantsByLead = new Map<number, number[]>();
  for (const claim of activeClaims) {
    const list = claimantsByLead.get(claim.lead_id);
    if (list) list.push(claim.agent_id);
    else claimantsByLead.set(claim.lead_id, [claim.agent_id]);
  }

  const conversionsByAgent = new Map<number, number>();
  for (const lead of converted) {
    if (!lead.converted_at || lead.converted_at < monthStart) continue;
    const agentId = primaryByLead.get(lead.lead_id);
    if (agentId !== undefined) conversionsByAgent.set(agentId, (conversionsByAgent.get(agentId) ?? 0) + 1);
  }

  const activitiesByAgent = new Map<number, number>();
  for (const activity of activities) {
    // Metrics-integrity: stage moves record themselves as `note` activities;
    // counting them rewards bookkeeping, not selling — the activity component
    // of the score uses only real touches (call/email/visit/meeting).
    // Trade-off: manually written notes are excluded too; there is currently
    // no field distinguishing manual from system notes, and that is the ceiling.
    if (activity.kind === "note") continue;
    activitiesByAgent.set(activity.agent_id, (activitiesByAgent.get(activity.agent_id) ?? 0) + 1);
  }

  // Qualified: current stage of every actively claimed lead, one bulk read.
  const qualifiedByAgent = new Map<number, number>();
  const claimedIds = [...claimantsByLead.keys()];
  if (claimedIds.length > 0 && qualOrder !== null) {
    const leadFilter = encodeURIComponent(JSON.stringify({ lead_id: { _in: claimedIds } }));
    const leadBody = checked(
      // ponytail: same 10_000 ceiling as the claim read above — one bulk read, no N+1.
      await dFetch(`/items/telemarketing_lead?filter=${leadFilter}&limit=${CLAIM_CAP}&fields=lead_id,stage_id`),
      "load claimed leads",
    );
    for (const lead of rows<ClaimedLeadRow>(leadBody)) {
      if (lostIds.has(lead.stage_id)) continue;
      const stage = stageById.get(lead.stage_id);
      if (!stage || stage.stage_order < qualOrder) continue;
      for (const agentId of claimantsByLead.get(lead.lead_id) ?? []) {
        qualifiedByAgent.set(agentId, (qualifiedByAgent.get(agentId) ?? 0) + 1);
      }
    }
  }

  const ranked = agents
    .filter((a) => Number.isInteger(a.agent_id))
    .filter((a) => a.is_active === undefined || Number(a.is_active) === 1)
    .map((agent) => {
      const conversions = conversionsByAgent.get(agent.agent_id) ?? 0;
      const qualified = qualifiedByAgent.get(agent.agent_id) ?? 0;
      const activityCount = activitiesByAgent.get(agent.agent_id) ?? 0;
      return {
        agent_id: agent.agent_id,
        name: agent.display_name?.trim() || `Agent ${agent.agent_id}`,
        score: conversions * 3 + qualified * 2 + activityCount,
        conversions,
        qualified,
        activities: activityCount,
        rank: 0,
      } satisfies LeaderboardRow;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.conversions - a.conversions ||
        b.qualified - a.qualified ||
        a.name.localeCompare(b.name),
    );

  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });
  return ranked;
}
