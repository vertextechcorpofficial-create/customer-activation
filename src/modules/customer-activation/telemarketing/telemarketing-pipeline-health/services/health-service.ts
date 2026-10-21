import type { PipelineHealth, StageHealth, StuckLead } from "../types/report.schema";
import { dFetch } from "../utils/directus";

/** Server-only pipeline-health aggregation for the report lane. */

const STAGE_TABLE = "telemarketing_stage";
const LEAD_TABLE = "telemarketing_lead";

const STUCK_CAP = 25;
const MS_PER_DAY = 86_400_000;

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

export interface PipelineHealthInput {
  stuckDays: number;
}

export async function listPipelineHealth(input: PipelineHealthInput): Promise<PipelineHealth> {
  const stuckDays = Math.trunc(input.stuckDays) || 7;
  const now = Date.now();

  const [stageBody, leadBody] = await Promise.all([
    dFetch(`/items/${STAGE_TABLE}?sort=stage_order&limit=-1`),
    dFetch(
      `/items/${LEAD_TABLE}?limit=-1&fields=lead_id,lead_code,company_name,contact_name,stage_id,updated_at,created_at,last_activity_at`,
    ),
  ]);
  const allStages = readList<StageRow>(stageBody);
  const leads = readList<LeadRow>(leadBody);

  const active = allStages
    .filter((s) => toFlag(s.is_active))
    .sort((a, b) => a.stage_order - b.stage_order);
  const byId = new Map(allStages.map((s) => [s.stage_id, s]));
  const terminalOf = (stageId: number): "won" | "lost" | null => {
    const s = byId.get(stageId);
    if (!s) return null;
    if (toFlag(s.is_won)) return "won";
    if (toFlag(s.is_lost)) return "lost";
    return null;
  };

  let won = 0;
  let lost = 0;
  for (const lead of leads) {
    const t = terminalOf(lead.stage_id);
    if (t === "won") won += 1;
    else if (t === "lost") lost += 1;
  }
  const total = leads.length;
  const activeCount = total - won - lost;

  const byStage = new Map<number, LeadRow[]>();
  for (const lead of leads) {
    const list = byStage.get(lead.stage_id) ?? [];
    list.push(lead);
    byStage.set(lead.stage_id, list);
  }

  const stages: StageHealth[] = active.map((stage) => {
    const rows = byStage.get(stage.stage_id) ?? [];
    const ages = rows.map((l) => ageDays(l.updated_at, now));
    const sum = ages.reduce((acc, v) => acc + v, 0);
    return {
      stage_id: stage.stage_id,
      stage_code: stage.stage_code,
      stage_name: stage.stage_name,
      stage_order: stage.stage_order,
      leadCount: rows.length,
      share: total === 0 ? 0 : round1((rows.length / total) * 100),
      avgDaysInStage: rows.length === 0 ? 0 : round1(sum / rows.length),
      oldestAgeDays: round1(ages.length === 0 ? 0 : Math.max(...ages)),
    };
  });

  const activeIds = new Set(active.map((s) => s.stage_id));
  const stuck: StuckLead[] = leads
    .filter((l) => activeIds.has(l.stage_id))
    .map((l) => {
      const anchor = l.last_activity_at ?? l.created_at;
      return {
        lead: l,
        daysStuck: Math.floor(ageDays(anchor, now)),
        anchor,
      };
    })
    .filter((r) => r.daysStuck > stuckDays)
    .sort((a, b) => b.daysStuck - a.daysStuck)
    .slice(0, STUCK_CAP)
    .map((r) => ({
      lead_id: r.lead.lead_id,
      lead_code: r.lead.lead_code,
      company_name: r.lead.company_name,
      contact_name: r.lead.contact_name,
      stage_id: r.lead.stage_id,
      stage_name: byId.get(r.lead.stage_id)?.stage_name ?? "—",
      lastActivityAt: r.anchor,
      daysStuck: r.daysStuck,
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
