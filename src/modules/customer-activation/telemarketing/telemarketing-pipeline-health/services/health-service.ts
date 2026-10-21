import type { PipelineHealth, StageHealth, StuckLead } from "../types/report.schema";
import { dFetch } from "../utils/directus";

/** Server-only pipeline-health aggregation for the report lane. */

const STAGE_TABLE = "telemarketing_stage";
const LEAD_TABLE = "telemarketing_lead";

const STUCK_CAP = 25;
const MS_PER_DAY = 86_400_000;

/**
 * ponytail: per-stage reads are capped at SAMPLE_CAP rows to keep the report O(stages)
 * instead of O(leads). Count and oldest age stay exact (count comes from
 * `filter_count`, oldest from the sort); the average age is computed from the
 * oldest cap rows, so on a stage larger than SAMPLE_CAP it is an approximation.
 * Upgrade path: a stored `age_days` column or a SQL view, then a true AVG().
 */
const SAMPLE_CAP = 200;
const STUCK_SCAN = 200;

interface StageRow {
  stage_id: number;
  stage_code: string;
  stage_name: string;
  stage_order: number;
  is_won: boolean | 0 | 1;
  is_lost: boolean | 0 | 1;
  is_active: boolean | 0 | 1;
}

interface LeadRow {
  lead_id: number;
  lead_code: string;
  company_name: string;
  contact_name: string | null;
  stage_id: number;
  updated_at: string;
  created_at: string;
  last_activity_at: string | null;
}

function readList<T>(body: unknown): T[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  if ("errors" in record) return [];
  return Array.isArray(record.data) ? (record.data as T[]) : [];
}

function toFlag(value: boolean | 0 | 1): boolean {
  return value === true || value === 1;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Days from `value` until now, floored at 0. Unparseable dates count as 0. */
function ageDays(value: string | null | undefined, now: number): number {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, (now - date.getTime()) / MS_PER_DAY);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface LeadCountEnvelope {
  meta?: { filter_count?: number };
}

async function countLeads(filter: unknown): Promise<number> {
  const body = await dFetch(
    `/items/${LEAD_TABLE}?limit=1&meta=filter_count&filter=${encodeURIComponent(JSON.stringify(filter))}`,
  );
  return (body as LeadCountEnvelope | null)?.meta?.filter_count ?? 0;
}

export interface PipelineHealthInput {
  stuckDays: number;
}

export async function listPipelineHealth(input: PipelineHealthInput): Promise<PipelineHealth> {
  const stuckDays = Math.trunc(input.stuckDays) || 7;
  const now = Date.now();

  const allStages = readList<StageRow>(await dFetch(`/items/${STAGE_TABLE}?sort=stage_order&limit=-1`));
  const active = allStages
    .filter((s) => toFlag(s.is_active))
    .sort((a, b) => a.stage_order - b.stage_order);
  const byId = new Map(allStages.map((s) => [s.stage_id, s]));

  const wonStageIds = allStages.filter((s) => toFlag(s.is_won)).map((s) => s.stage_id);
  const lostStageIds = allStages.filter((s) => toFlag(s.is_lost)).map((s) => s.stage_id);

  // One bounded read per active stage: exact count (filter_count), exact oldest
  // (sorted asc), and an age sample for the average.
  const [total, won, lost, ...stageReads] = await Promise.all([
    countLeads({}),
    wonStageIds.length ? countLeads({ stage_id: { _in: wonStageIds } }) : Promise.resolve(0),
    lostStageIds.length ? countLeads({ stage_id: { _in: lostStageIds } }) : Promise.resolve(0),
    ...active.map(async (stage) => {
      const filter = encodeURIComponent(JSON.stringify({ stage_id: { _eq: stage.stage_id } }));
      const body = await dFetch(
        `/items/${LEAD_TABLE}?filter=${filter}&sort=updated_at&limit=${SAMPLE_CAP}&fields=updated_at&meta=filter_count`,
      );
      const rows = readList<{ updated_at: string }>(body);
      const count = (body as LeadCountEnvelope | null)?.meta?.filter_count ?? rows.length;
      const ages = rows.map((row) => ageDays(row.updated_at, now));
      const sum = ages.reduce((acc, value) => acc + value, 0);
      return { stage, count, ages, sum };
    }),
  ]);

  const activeCount = total - won - lost;

  const stages: StageHealth[] = stageReads.map(({ stage, count, ages, sum }) => ({
    stage_id: stage.stage_id,
    stage_code: stage.stage_code,
    stage_name: stage.stage_name,
    stage_order: stage.stage_order,
    leadCount: count,
    share: total === 0 ? 0 : round1((count / total) * 100),
    avgDaysInStage: ages.length === 0 ? 0 : round1(sum / ages.length),
    oldestAgeDays: ages.length === 0 ? 0 : round1(Math.max(...ages)),
  }));

  const activeIds = active.map((s) => s.stage_id);
  const cutoff = new Date(now - stuckDays * MS_PER_DAY)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  // Candidates only: active stage AND no activity (or a stale one) past the cutoff.
  // Bounded scan, worst STUCK_CAP surface.
  const stuckFilter = {
    _and: [
      { stage_id: { _in: activeIds } },
      {
        _or: [
          { last_activity_at: { _lt: cutoff } },
          {
            _and: [
              { last_activity_at: { _null: true } },
              { created_at: { _lt: cutoff } },
            ],
          },
        ],
      },
    ],
  };

  const stuckRows =
    activeIds.length === 0
      ? []
      : readList<LeadRow>(
          await dFetch(
            `/items/${LEAD_TABLE}?filter=${encodeURIComponent(
              JSON.stringify(stuckFilter),
            )}&sort=last_activity_at&limit=${STUCK_SCAN}&fields=lead_id,lead_code,company_name,contact_name,stage_id,last_activity_at,created_at`,
          ),
        );

  const stuck: StuckLead[] = stuckRows
    .map((lead) => {
      const anchor = lead.last_activity_at ?? lead.created_at;
      return { lead, daysStuck: Math.floor(ageDays(anchor, now)), anchor };
    })
    .filter((row) => row.daysStuck > stuckDays)
    .sort((a, b) => b.daysStuck - a.daysStuck)
    .slice(0, STUCK_CAP)
    .map((row) => ({
      lead_id: row.lead.lead_id,
      lead_code: row.lead.lead_code,
      company_name: row.lead.company_name,
      contact_name: row.lead.contact_name,
      stage_id: row.lead.stage_id,
      stage_name: byId.get(row.lead.stage_id)?.stage_name ?? "—",
      lastActivityAt: row.anchor,
      daysStuck: row.daysStuck,
    }));

  return {
    stages,
    stuck,
    totals: {
      active: activeCount,
      won,
      lost,
      total,
      conversionRate: won + lost === 0 ? 0 : round1((won / (won + lost)) * 100),
    },
    stuckDays,
  };
}
