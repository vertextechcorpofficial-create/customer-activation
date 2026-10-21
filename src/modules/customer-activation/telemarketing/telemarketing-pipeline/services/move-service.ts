/**
 * Pipeline move service — server-only.
 * Moves a lead between stages and records the move as one `note` activity.
 */

import { dFetch } from "../utils/directus";
import type { LeadView, Stage } from "../types/pipeline.schema";

const LEADS = "telemarketing_lead";
const ACTIVITIES = "telemarketing_activity";
const STAGES = "telemarketing_stage";

function phNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function readData<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if ("errors" in record) return null;
  return (record.data ?? null) as T | null;
}

export interface MoveOptions {
  lostReason?: string | null;
  note?: string | null;
  userId?: number | null;
  agentId?: number;
}

/**
 * Move a lead to another stage.
 * @param leadId - The lead id.
 * @param stageId - The target stage id.
 * @param opts - Lost reason (required on a lost stage), note, audit ids.
 * @returns The lead in its new stage.
 */
export async function moveStage(
  leadId: number,
  stageId: number,
  opts: MoveOptions = {},
): Promise<LeadView> {
  const stage = readData<Stage>(await dFetch(`/items/${STAGES}/${stageId}`));
  if (!stage) {
    console.error("pipeline/moveStage: stage not found", stageId);
    throw new Error("NOT_FOUND: Stage not found");
  }

  const lostReason = (opts.lostReason ?? "").trim();
  if (Number(stage.is_lost) === 1 && !lostReason) {
    throw new Error("VALIDATION_FAILED: A lost reason is required for a lost stage");
  }

  const now = phNow();
  const body = await dFetch(`/items/${LEADS}/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({
      stage_id: stageId,
      lost_reason: lostReason || null,
      last_activity_at: now,
      updated_by: opts.userId ?? null,
      updated_at: now,
    }),
  });
  const lead = readData<LeadView>(body);
  if (!lead) {
    console.error("pipeline/moveStage: could not move the lead", body);
    throw new Error("INTERNAL_FAIL: Could not move the lead");
  }

  const note =
    opts.note?.trim() ||
    `Stage moved to ${stage.stage_name}${lostReason ? ` - ${lostReason}` : ""}`;
  try {
    const activity = await dFetch(`/items/${ACTIVITIES}`, {
      method: "POST",
      body: JSON.stringify({
        lead_id: leadId,
        agent_id: opts.agentId ?? null,
        kind: "note",
        notes: note,
        occurred_at: now,
        created_by: opts.userId ?? null,
        created_at: now,
        updated_by: opts.userId ?? null,
        updated_at: now,
      }),
    });
    if (!readData(activity)) console.error("pipeline/moveStage: activity note rejected", activity);
  } catch (error) {
    console.error("pipeline/moveStage: activity note failed", error);
  }

  return lead;
}
