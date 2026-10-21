import type { PipelineHealth } from "../types/report.schema";

/**
 * Client-safe wrappers around the pipeline-health report API.
 * No Directus access here — the API route owns all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline-health";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

export function fetchPipelineHealth(stuckDays = 7): Promise<PipelineHealth> {
  return fetch(`${BASE}?stuckDays=${encodeURIComponent(String(stuckDays))}`).then(async (res) => {
    const body = (await res.json().catch(() => null)) as Envelope<PipelineHealth> | null;
    if (!res.ok || !body?.success) throw new Error(body?.message ?? `Request failed (${res.status})`);
    return body.data as PipelineHealth;
  });
}
