/**
 * Pipeline move service — server-only.
 * Moves a lead between stages and records the move as one `note` activity.
 */

import { dFetch } from "../utils/directus";
import type { LeadView, Stage } from "../types/pipeline.schema";
import { convertLeadToCustomer, type ConversionResult } from "./conversion-service";

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

export interface MoveResult {
  lead: LeadView;
  /** Set only when the move landed on a won stage. */
  conversion: ConversionResult | { error: string } | null;
}

/**
 * Move a lead to another stage.
 * Landing on a won stage also converts it: one `customer` row plus the
 * two-way link. Conversion failure does not undo the move — it is reported
 * back so the caller can retry, and the conversion itself is idempotent.
 *
 * @param leadId - The lead id.
 * @param stageId - The target stage id.
 * @param opts - Lost reason (required on a lost stage), note, audit ids.
 * @returns The lead in its new stage, plus conversion outcome.
 */
export async function moveStage(
  leadId: number,
  stageId: number,
  opts: MoveOptions = {},
): Promise<MoveResult> {
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

  // Conversion: only on a won stage, and only once per lead.
  let conversion: ConversionResult | { error: string } | null = null;
  if (Number(stage.is_won) === 1 && !lead.converted_customer_id) {
    try {
      conversion = await convertLeadToCustomer(lead, opts.userId ?? null);
      lead.converted_customer_id = conversion.customerId;
      lead.converted_at = now;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conversion failed";
      console.error("pipeline/moveStage: conversion failed", message);
      conversion = { error: message };
    }
  }

  const convertedNote =
    conversion && !("error" in conversion) ? ` - converted to customer ${conversion.customerCode}` : "";
  const note =
    opts.note?.trim() ||
    `Stage moved to ${stage.stage_name}${lostReason ? ` - ${lostReason}` : ""}${convertedNote}`;
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

  return { lead, conversion };
}
