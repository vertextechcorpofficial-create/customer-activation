import type { Activity, ActivityCreate } from "../types/pipeline.schema";

/**
 * Client-safe wrappers around the pipeline activity API route.
 * No Directus access here — the route owns all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline/activities";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[] | undefined>;
}

/** First field-level validation message, so the UI can name the bad field. */
function firstFieldError(errors: Envelope<unknown>["errors"]): string | null {
  if (!errors) return null;
  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

async function call<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new Error(firstFieldError(body?.errors) ?? body?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

/** Activities for one lead, newest first. */
export function fetchActivities(leadId: number): Promise<Activity[]> {
  return fetch(`${BASE}?lead_id=${leadId}`).then(call<Activity[]>);
}

/** Log one activity against a lead. */
export function createActivity(input: ActivityCreate): Promise<Activity> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(call<Activity>);
}
