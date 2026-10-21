import type { LeadView, Stage, StageCreate, StageUpdate } from "../types/pipeline.schema";

/**
 * Client-safe wrappers around `/api/customer-activation/telemarketing/telemarketing-pipeline/stages`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline/stages";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.errors?.[0]?.message ?? body?.message ?? "Something went wrong. Please try again.");
  }
  return body.data as T;
}

export function getStages(): Promise<Stage[]> {
  return request<Stage[]>(BASE);
}

export function createStage(input: StageCreate): Promise<Stage> {
  return request<Stage>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateStage(stageId: number, input: StageUpdate): Promise<Stage> {
  return request<Stage>(`${BASE}/${stageId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** Reorder by patching each stage's position (collection route is GET + POST only). */
export async function reorderStages(stageIds: number[]): Promise<Stage[]> {
  for (let i = 0; i < stageIds.length; i++) {
    await updateStage(stageIds[i], { stage_order: i + 1 });
  }
  return getStages();
}

export function deactivateStage(stageId: number): Promise<Stage> {
  return request<Stage>(`${BASE}/${stageId}`, { method: "DELETE" });
}

/** Move a lead to another stage (lost reason required on a lost stage). */
export function moveLeadStage(
  leadId: number,
  stageId: number,
  lostReason?: string,
  note?: string,
): Promise<LeadView> {
  return request<LeadView>(`/api/customer-activation/telemarketing/telemarketing-pipeline/leads/${leadId}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage_id: stageId, lost_reason: lostReason, note }),
  });
}
