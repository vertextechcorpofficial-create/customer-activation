/**
 * Pipeline stage service — server-only.
 * Single owner of reads/writes against `telemarketing_stage`.
 * Philippine time is written explicitly on every mutation.
 */

import type { Stage, StageCreate, StageUpdate } from "../types/pipeline.schema";
import { dFetch } from "../utils/directus";

const COLLECTION = "telemarketing_stage";

interface DirectusEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

/** Philippine time, written explicitly by the app. */
function phNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class StageServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "StageServiceError";
    this.status = status;
  }
}

const DIRECTUS_ERROR_STATUS: Record<string, number> = {
  INVALID_PAYLOAD: 400,
  RECORD_NOT_FOUND: 404,
  RECORD_NOT_UNIQUE: 409,
  FORBIDDEN: 403,
};

/** `dFetch` hands back the parsed error body on a non-ok response. */
function throwDirectusError(body: DirectusEnvelope<unknown>): never {
  const first = body.errors?.[0];
  const status = DIRECTUS_ERROR_STATUS[first?.extensions?.code ?? ""] ?? 500;
  throw new StageServiceError(first?.message ?? "Directus request failed", status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
  const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
  if (!body) return {};
  if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
  return body;
}

function byOrder(a: Stage, b: Stage): number {
  return a.stage_order - b.stage_order;
}

/**
 * Field changes for a stage. `stage_order` is excluded: the column is UNIQUE,
 * so order changes move the rows in between via the reorder writer.
 */
function stagePatch(input: StageUpdate, actorId: number | null): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
  if (input.stage_code !== undefined) patch.stage_code = input.stage_code.trim();
  if (input.stage_name !== undefined) patch.stage_name = input.stage_name.trim();
  if (input.is_won !== undefined) patch.is_won = input.is_won ? 1 : 0;
  if (input.is_lost !== undefined) patch.is_lost = input.is_lost ? 1 : 0;
  if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
  return patch;
}

/**
 * Write a new pipeline order. `stage_order` is UNIQUE, so a straight swap
 * collides mid-write — park every moved row on a free slot, then land 1..N.
 */
async function writeOrder(ordered: Stage[], actorId: number | null): Promise<void> {
  const moved = ordered
    .map((stage, index) => ({ stage, target: index + 1 }))
    .filter((entry) => entry.stage.stage_order !== entry.target);
  if (moved.length === 0) return;

  const now = phNow();
  const parkBase = Math.max(...ordered.map((stage) => stage.stage_order)) + 1000;
  await request(`/items/${COLLECTION}`, {
    method: "PATCH",
    body: JSON.stringify(
      moved.map((entry, index) => ({
        stage_id: entry.stage.stage_id,
        stage_order: parkBase + index,
        updated_by: actorId,
        updated_at: now,
      })),
    ),
  });
  await request(`/items/${COLLECTION}`, {
    method: "PATCH",
    body: JSON.stringify(
      moved.map((entry) => ({
        stage_id: entry.stage.stage_id,
        stage_order: entry.target,
        updated_by: actorId,
        updated_at: now,
      })),
    ),
  });
}

/** All stages, pipeline order first — inactive stay listed so they can be reactivated. */
export async function listStages(): Promise<Stage[]> {
  const body = await request<Stage[]>(`/items/${COLLECTION}?fields=*&sort=stage_order&limit=-1`);
  return body.data ?? [];
}

export async function createStage(input: StageCreate, actorId: number | null): Promise<Stage> {
  const now = phNow();
  const body = await request<Stage>(`/items/${COLLECTION}`, {
    method: "POST",
    body: JSON.stringify({
      stage_code: input.stage_code.trim(),
      stage_name: input.stage_name.trim(),
      stage_order: input.stage_order,
      is_won: input.is_won ? 1 : 0,
      is_lost: input.is_lost ? 1 : 0,
      is_active: input.is_active ? 1 : 0,
      created_by: actorId,
      created_at: now,
      updated_by: actorId,
      updated_at: now,
    }),
  });
  if (!body.data) throw new StageServiceError("Stage was not created", 500);
  return body.data;
}

export async function updateStage(id: number, input: StageUpdate, actorId: number | null): Promise<Stage> {
  const hasFields =
    input.stage_code !== undefined ||
    input.stage_name !== undefined ||
    input.is_won !== undefined ||
    input.is_lost !== undefined ||
    input.is_active !== undefined;

  if (input.stage_order !== undefined) {
    const current = await listStages();
    const target = current.find((stage) => stage.stage_id === id);
    if (!target) throw new StageServiceError("Stage was not found", 404);
    const others = current.filter((stage) => stage.stage_id !== id).sort(byOrder);
    const index = Math.min(Math.max(input.stage_order - 1, 0), others.length);
    const ordered = [...others.slice(0, index), target, ...others.slice(index)];
    await writeOrder(ordered, actorId);

    if (!hasFields) {
      return { ...target, stage_order: index + 1, updated_by: actorId, updated_at: phNow() };
    }
  }

  const body = await request<Stage>(`/items/${COLLECTION}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(stagePatch(input, actorId)),
  });
  if (!body.data) throw new StageServiceError("Stage was not updated", 500);
  return body.data;
}

/**
 * Persist a new pipeline order. `stageIds` is the wanted order; rows left out
 * keep their relative order and follow the ones that were sent.
 */
export async function reorderStages(stageIds: number[], actorId: number | null): Promise<Stage[]> {
  const current = await listStages();
  if (current.length === 0) return [];

  const byId = new Map(current.map((stage) => [stage.stage_id, stage]));
  const moved = stageIds.map((id) => byId.get(id)).filter((stage): stage is Stage => Boolean(stage));
  const rest = current.filter((stage) => !moved.includes(stage)).sort(byOrder);
  await writeOrder([...moved, ...rest], actorId);

  return listStages();
}

/** Stages are never hard-deleted — leads keep pointing at them. */
export async function deactivateStage(id: number, actorId: number | null): Promise<Stage> {
  return updateStage(id, { is_active: false }, actorId);
}
