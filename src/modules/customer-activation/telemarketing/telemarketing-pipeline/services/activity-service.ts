/**
 * Pipeline activity service — server-only.
 * One logged interaction with a lead; inserting one stamps
 * `telemarketing_lead.last_activity_at` so the lead shows "last touched".
 */

import { dFetch } from "../utils/directus";
import { ActivityCreateSchema, type Activity, type ActivityCreate } from "../types/pipeline.schema";

const ACTIVITIES = "telemarketing_activity";
const LEADS = "telemarketing_lead";

/** Philippine wall-clock timestamp, e.g. "2026-10-21 09:30:00". */
function phNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function one<T>(body: unknown): T | null {
  if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data: T }).data;
    return data === undefined ? null : data;
  }
  return null;
}

function many<T>(body: unknown): T[] {
  if (body && typeof body === "object" && "data" in body && Array.isArray((body as { data: unknown }).data)) {
    return (body as { data: T[] }).data;
  }
  return [];
}

function errMsg(body: unknown): string {
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: { message?: string }[] }).errors;
    if (Array.isArray(errors) && typeof errors[0]?.message === "string") return errors[0].message;
  }
  return "Directus request failed";
}

/** Every activity logged against a lead, newest first. */
export async function listByLead(leadId: number): Promise<Activity[]> {
  if (!Number.isInteger(leadId) || leadId <= 0) throw new Error("Invalid lead id");
  const filter = encodeURIComponent(JSON.stringify({ lead_id: { _eq: leadId } }));
  const body = await dFetch(`/items/${ACTIVITIES}?filter=${filter}&sort=-occurred_at&limit=-1`);
  if (body !== null && typeof body === "object" && "errors" in body) throw new Error(errMsg(body));
  return many<Activity>(body);
}

/** Log one interaction and stamp the lead's `last_activity_at`. */
export async function createActivity(input: ActivityCreate, agentId: number): Promise<Activity> {
  const parsed = ActivityCreateSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid activity payload");
  if (!Number.isInteger(agentId) || agentId <= 0) throw new Error("Invalid agent id");
  const data = parsed.data;

  const lead = one<{ lead_id: number }>(await dFetch(`/items/${LEADS}/${data.lead_id}`));
  if (!lead) throw new Error("LEAD_NOT_FOUND");

  const now = phNow();
  const occurredAt = data.occurred_at ?? now;

  const created = await dFetch(`/items/${ACTIVITIES}`, {
    method: "POST",
    body: JSON.stringify({
      lead_id: data.lead_id,
      agent_id: agentId,
      kind: data.kind,
      outcome: data.kind === "note" ? null : (data.outcome ?? null),
      notes: data.notes?.trim() || null,
      duration_minutes: data.duration_minutes ?? null,
      occurred_at: occurredAt,
      created_at: now,
      updated_at: now,
    }),
  });
  const activity = one<Activity>(created);
  if (!activity) throw new Error(errMsg(created));

  // ponytail: a failed lead stamp is logged, never thrown — the activity is
  // already stored and `last_activity_at` self-heals on the next insert.
  const stamped = await dFetch(`/items/${LEADS}/${data.lead_id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_activity_at: occurredAt, updated_at: now }),
  });
  if (stamped !== null && typeof stamped === "object" && "errors" in stamped) {
    console.error("[pipeline/activity] lead last_activity_at sync failed:", stamped);
  }

  return activity;
}
