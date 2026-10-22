import type { HealthInsight, PipelineHealth, StageHealth, StuckLead } from "../types/report.schema";
import { PERIOD_OPTIONS } from "../types/report.schema";
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

interface StageSampleRow {
  updated_at: string;
  created_at: string;
  last_activity_at: string | null;
}

interface PrevSampleRow {
  stage_id: number;
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

/** Days from `anchor` until `at`, floored at 0 (future anchors clamp to 0). */
function ageAsOf(anchor: string | null | undefined, at: number): number {
  const date = parseDate(anchor);
  if (!date) return 0;
  return Math.max(0, (at - date.getTime()) / MS_PER_DAY);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return round1(raw);
}

/** Rounded percent change, null when previous is 0 or missing. */
function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

/** Manila wall-clock stamp — writes use Asia/Manila ("sv-SE" stamps, QA §12). */
function manila(ms: number): string {
  return new Date(ms).toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function buildInsights(input: {
  stuckTotal: number;
  open: number;
  medianAgeDays: number;
  period: number;
  stalledStages: number;
}): HealthInsight[] {
  const { stuckTotal, open, medianAgeDays, period, stalledStages } = input;
  const share = open === 0 ? 0 : (stuckTotal / open) * 100;

  const flow: HealthInsight =
    stuckTotal === 0 || share < 10
      ? {
          id: "flow",
          tone: "success",
          title: "Pipeline moving well",
          detail:
            stuckTotal === 0 ? "No leads have gone quiet." : "Only a few leads need a nudge.",
        }
      : share < 20
        ? {
            id: "flow",
            tone: "warning",
            title: "Follow-ups piling up",
            detail: "More leads are going quiet and need attention.",
          }
        : {
            id: "flow",
            tone: "destructive",
            title: "Pipeline needs attention",
            detail: "Many leads have gone quiet and need follow-up now.",
          };

  const ratio = medianAgeDays / period;
  const speed: HealthInsight =
    ratio < 0.25
      ? { id: "speed", tone: "success", title: "Good momentum", detail: "Waiting times are short." }
      : ratio < 0.5
        ? { id: "speed", tone: "info", title: "Steady pace", detail: "Leads are progressing steadily." }
        : ratio < 1
          ? {
              id: "speed",
              tone: "warning",
              title: "Things are slowing down",
              detail: "Leads are taking a while to move forward.",
            }
          : {
              id: "speed",
              tone: "destructive",
              title: "Leads are getting stuck",
              detail: "Typical waiting times are running long.",
            };

  const stalled: HealthInsight =
    stalledStages === 0
      ? {
          id: "stalled",
          tone: "success",
          title: "No stalled stages",
          detail: "Every stage has recent movement.",
        }
      : stalledStages === 1
        ? {
            id: "stalled",
            tone: "warning",
            title: "One stage stalled",
            detail: "One stage has had no recent movement.",
          }
        : {
            id: "stalled",
            tone: "destructive",
            title: `${stalledStages} stages stalled`,
            detail: "Several stages have had no recent movement.",
          };

  return [flow, speed, stalled];
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
  /** Active window/threshold (7 | 30 | 90). Wins when both are present. */
  period?: number;
  /** @deprecated legacy alias — used only when `period` is absent. */
  stuckDays?: number;
}

export async function listPipelineHealth(input: PipelineHealthInput): Promise<PipelineHealth> {
  if (input.period !== undefined) {
    const p = Math.trunc(input.period);
    if (!(PERIOD_OPTIONS as readonly number[]).includes(p)) {
      throw new Error("period must be one of 7, 30, 90");
    }
  }
  const period =
    input.period !== undefined
      ? Math.trunc(input.period)
      : input.stuckDays !== undefined
        ? Math.trunc(input.stuckDays) || 7
        : 7;
  const now = Date.now();

  // ponytail: stages are a small admin table — bounded limit=100 keeps the
  // query bounded (no limit=-1) while covering any realistic pipeline.
  // Explicit fields: the open/closed split below needs the real is_won /
  // is_lost flags (stage-tone only infers terminals from the code string).
  const allStages = readList<StageRow>(
    await dFetch(
      `/items/${STAGE_TABLE}?sort=stage_order&limit=100&fields=stage_id,stage_code,stage_name,stage_order,is_won,is_lost,is_active`,
    ),
  );
  const active = allStages
    .filter((s) => toFlag(s.is_active))
    .sort((a, b) => a.stage_order - b.stage_order);
  // Closed stages are not work: the stuck list and the active denominator
  // only cover open stages (is_won = 0 AND is_lost = 0). The funnel keeps
  // showing every active stage including terminals.
  const openStages = active.filter((s) => !toFlag(s.is_won) && !toFlag(s.is_lost));
  const byId = new Map(allStages.map((s) => [s.stage_id, s]));

  const wonStageIds = allStages.filter((s) => toFlag(s.is_won)).map((s) => s.stage_id);
  const lostStageIds = allStages.filter((s) => toFlag(s.is_lost)).map((s) => s.stage_id);

  // One bounded read per active stage: exact count (filter_count), exact oldest
  // (sorted asc), and an age sample for the average. Anchor fields ride along
  // in the same rows so the top-level median/stalled reuse them with zero
  // extra per-stage queries.
  const [total, won, lost, ...stageReads] = await Promise.all([
    countLeads({}),
    wonStageIds.length ? countLeads({ stage_id: { _in: wonStageIds } }) : Promise.resolve(0),
    lostStageIds.length ? countLeads({ stage_id: { _in: lostStageIds } }) : Promise.resolve(0),
    ...active.map(async (stage) => {
      const filter = encodeURIComponent(JSON.stringify({ stage_id: { _eq: stage.stage_id } }));
      const body = await dFetch(
        `/items/${LEAD_TABLE}?filter=${filter}&sort=updated_at&limit=${SAMPLE_CAP}&fields=updated_at,last_activity_at,created_at&meta=filter_count`,
      );
      const rows = readList<StageSampleRow>(body);
      const count = (body as LeadCountEnvelope | null)?.meta?.filter_count ?? rows.length;
      const ages = rows.map((row) => ageDays(row.updated_at, now));
      const sum = ages.reduce((acc, value) => acc + value, 0);
      const anchorAges = rows.map((row) => ageDays(row.last_activity_at ?? row.created_at, now));
      return { stage, count, ages, sum, anchorAges };
    }),
  ]);

  // Denominator of stuckShareOf: total minus closed leads, i.e. exactly the
  // open-stage population the stuck query scans — so stuckTotal <= active
  // always holds and the share can never exceed 100%.
  const activeCount = total - won - lost;

  const stages: StageHealth[] = stageReads.map(({ stage, count, ages, sum }) => ({
    stage_id: stage.stage_id,
    stage_code: stage.stage_code,
    stage_name: stage.stage_name,
    stage_order: stage.stage_order,
    isTerminal: toFlag(stage.is_won) || toFlag(stage.is_lost),
    leadCount: count,
    share: total === 0 ? 0 : round1((count / total) * 100),
    avgDaysInStage: ages.length === 0 ? 0 : round1(sum / ages.length),
    oldestAgeDays: ages.length === 0 ? 0 : round1(Math.max(...ages)),
  }));

  const openIds = openStages.map((s) => s.stage_id);
  const openSet = new Set(openIds);
  // Writes use Asia/Manila wall-clock ("sv-SE" stamps), so the stuck boundary
  // is built with the same Manila formatter — a UTC toISOString() here would
  // skew the cutoff 8 hours (QA §12).
  const cutoff = manila(now - period * MS_PER_DAY);

  // Candidates only: OPEN stage AND no activity (or a stale one) past the cutoff.
  // Bounded scan, worst STUCK_CAP surface. `meta=filter_count` on this same
  // request gives the EXACT stuck total without a second query or a full fetch.
  //
  // Stuck definition (DB predicate is authoritative): the anchor timestamp —
  // last_activity_at, falling back to created_at when NULL — is strictly older
  // than the cutoff. The old in-memory `.filter(floor(age) > stuckDays)` re-check
  // is intentionally NOT applied: `floor(age) > stuckDays` means age ≥
  // stuckDays+1 day, which is strictly narrower than the DB predicate and would
  // silently drop leads idle between stuckDays and stuckDays+1 day — the very
  // rows `filter_count` counts. So the list below is the top slice of exactly
  // the population `stuckTotal` totals; `daysStuck` (floored) is display/sort only.
  const stuckFilter = {
    _and: [
      { stage_id: { _in: openIds } },
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

  const stuckBody =
    openIds.length === 0
      ? null
      : await dFetch(
          `/items/${LEAD_TABLE}?filter=${encodeURIComponent(
            JSON.stringify(stuckFilter),
          )}&sort=last_activity_at&limit=${STUCK_SCAN}&fields=lead_id,lead_code,company_name,contact_name,stage_id,last_activity_at,created_at&meta=filter_count`,
        );

  const stuckRows = stuckBody ? readList<LeadRow>(stuckBody) : [];
  const stuckTotal = (stuckBody as LeadCountEnvelope | null)?.meta?.filter_count ?? stuckRows.length;

  const stuck: StuckLead[] = stuckRows
    .map((lead) => {
      const anchor = lead.last_activity_at ?? lead.created_at;
      return { lead, daysStuck: Math.floor(ageDays(anchor, now)), anchor };
    })
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

  // Current top-level KPIs from the same per-stage anchor samples (no extra
  // per-stage queries): median anchor age across open stages, and the count of
  // open stages whose oldest sampled anchor exceeds the period. Closed stages
  // are excluded — a terminal with an old lead would read as stalled forever.
  const openReads = stageReads.filter(({ stage }) => openSet.has(stage.stage_id));
  const openAnchorAges = openReads.flatMap(({ anchorAges }) => anchorAges);
  const medianAgeDays = median(openAnchorAges);
  const stalledStages = openReads.filter(
    ({ anchorAges }) => anchorAges.length > 0 && Math.max(...anchorAges) > period,
  ).length;

  // Previous equal-length window ending where the current one begins. Honest
  // reconstruction without snapshots: leads that existed then
  // (created_at <= prevEnd) with their current anchor timestamps. Caveats —
  // leads touched after prevEnd look fresher than they were (so prev stuck /
  // median / stalled are lower bounds), and stage moves after prevEnd are
  // invisible (current stage stands in for the historical one). Aggregate
  // totals are robust to moves between open stages; per-stage stalled counts
  // are not, so the previous sample below is documented as an approximation.
  // Cost: exactly 2 extra bounded reads (one count, one capped sample) — the
  // per-stage query count does not grow.
  const prevEndMs = now - period * MS_PER_DAY;
  const prevEndStr = manila(prevEndMs);
  const prevCutoffStr = manila(prevEndMs - period * MS_PER_DAY);

  const prevStuck =
    openIds.length === 0
      ? 0
      : await countLeads({
          _and: [
            { stage_id: { _in: openIds } },
            { created_at: { _lte: prevEndStr } },
            {
              _or: [
                { last_activity_at: { _lt: prevCutoffStr } },
                {
                  _and: [
                    { last_activity_at: { _null: true } },
                    { created_at: { _lt: prevCutoffStr } },
                  ],
                },
              ],
            },
          ],
        });

  const prevSampleBody =
    openIds.length === 0
      ? null
      : await dFetch(
          `/items/${LEAD_TABLE}?filter=${encodeURIComponent(
            JSON.stringify({ _and: [{ stage_id: { _in: openIds } }, { created_at: { _lte: prevEndStr } }] }),
          )}&sort=created_at&limit=${SAMPLE_CAP}&fields=stage_id,last_activity_at,created_at`,
        );
  const prevRows = prevSampleBody ? readList<PrevSampleRow>(prevSampleBody) : [];
  const prevAges = prevRows.map((row) => ageAsOf(row.last_activity_at ?? row.created_at, prevEndMs));
  const prevMedian = median(prevAges);
  const prevOldestByStage = new Map<number, number>();
  for (const row of prevRows) {
    const age = ageAsOf(row.last_activity_at ?? row.created_at, prevEndMs);
    const seen = prevOldestByStage.get(row.stage_id) ?? 0;
    if (age > seen) prevOldestByStage.set(row.stage_id, age);
  }
  const prevStalled = openIds.filter((id) => (prevOldestByStage.get(id) ?? 0) > period).length;

  const open = activeCount;
  const deltas = {
    stuck: pctChange(stuckTotal, prevStuck),
    medianAge: pctChange(medianAgeDays, prevMedian),
    stalledStages: pctChange(stalledStages, prevStalled),
    open: null as null,
  };
  const insights = buildInsights({ stuckTotal, open, medianAgeDays, period, stalledStages });

  return {
    period,
    stages,
    stuck,
    stuckTotal,
    totals: {
      open,
      active: activeCount,
      won,
      lost,
      total,
      conversionRate: won + lost === 0 ? 0 : round1((won / (won + lost)) * 100),
    },
    deltas,
    medianAgeDays,
    stalledStages,
    insights,
    stuckDays: period,
  };
}
