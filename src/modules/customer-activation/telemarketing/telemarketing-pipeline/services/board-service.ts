"use server";

/**
 * Pipeline board service â€” server-only (Server Action, called from `use-board`).
 * Per-stage lead windows: every active stage gets its own `limit`, so terminal
 * stages (Closed Won / Lost) render instead of being filtered out like the pool.
 */

import { dFetch } from "../utils/directus";
import type { LeadAgent, LeadView, Stage } from "../types/pipeline.schema";

/**
 * ponytail: stages are a small admin-managed dimension table — STAGE_CAP keeps
 * the read bounded (no limit=-1) while covering any realistic pipeline.
 */
const STAGE_CAP = 100;

export interface BoardLead extends LeadView {
  claimant_count: number;
}

export interface BoardColumn {
  stage_id: number;
  leads: BoardLead[];
  total: number;
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

/**
 * One lead window per active stage, newest first.
 * @param perStageLimit - Cards fetched per stage (server total still reported).
 * @returns One entry per active stage, in pipeline order.
 */
export async function listBoardLeads({
  perStageLimit = 50,
}: {
  perStageLimit?: number;
} = {}): Promise<BoardColumn[]> {
  const limit = Math.min(100, Math.max(1, perStageLimit));
  const stageFilter = encodeURIComponent(JSON.stringify({ is_active: { _eq: 1 } }));
  const stages = checked<{ data: Stage[] }>(
    await dFetch(`/items/telemarketing_stage?filter=${stageFilter}&sort=stage_order&limit=${STAGE_CAP}&fields=stage_id`),
    "load stages",
  ).data;
  if (!stages || stages.length === 0) return [];

  const pages = await Promise.all(
    stages.map(async (stage): Promise<{ stage_id: number; leads: LeadView[]; total: number }> => {
      const filter = encodeURIComponent(JSON.stringify({ stage_id: { _eq: stage.stage_id } }));
      const body = checked<{ data: LeadView[]; meta?: { filter_count?: number } }>(
        await dFetch(
          `/items/telemarketing_lead?filter=${filter}&sort=-updated_at&limit=${limit}&meta=filter_count`,
        ),
        "load board leads",
      );
      const leads = body.data ?? [];
      return { stage_id: stage.stage_id, leads, total: body.meta?.filter_count ?? leads.length };
    }),
  );

  const leadIds = [...new Set(pages.flatMap((page) => page.leads.map((lead) => lead.lead_id)))];
  const counts = new Map<number, number>();
  if (leadIds.length > 0) {
    const claimFilter = encodeURIComponent(
      JSON.stringify({ lead_id: { _in: leadIds }, released_at: { _null: true } }),
    );
    const rows = checked<{ data: LeadAgent[] }>(
      await dFetch(
        `/items/telemarketing_lead_agent?filter=${claimFilter}&limit=-1&fields=lead_id,agent_id`,
      ),
      "load claims",
    ).data;
    for (const row of rows ?? []) counts.set(row.lead_id, (counts.get(row.lead_id) ?? 0) + 1);
  }

  return pages.map((page) => ({
    stage_id: page.stage_id,
    total: page.total,
    leads: page.leads.map((lead) => ({ ...lead, claimant_count: counts.get(lead.lead_id) ?? 0 })),
  }));
}
