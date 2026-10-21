import type { LeadAgent } from "../types/pipeline.schema";
import type { ClaimsView, PoolResult } from "../services/claim-service";

/**
 * Client-safe wrappers around the pipeline pool + claim API routes.
 * No Directus access here — the API routes own all server I/O.
 */

const POOL_BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline/pool";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

export function getPool(page = 1, limit = 10): Promise<PoolResult> {
  return request<PoolResult>(`${POOL_BASE}?page=${page}&limit=${limit}`);
}

function claimUrl(leadId: number): string {
  return `/api/customer-activation/telemarketing/telemarketing-pipeline/leads/${leadId}/claim`;
}

export function getClaims(leadId: number): Promise<ClaimsView> {
  return request<ClaimsView>(claimUrl(leadId));
}

export function claimLead(leadId: number): Promise<LeadAgent> {
  return request<LeadAgent>(claimUrl(leadId), { method: "POST" });
}

export function releaseLead(leadId: number): Promise<LeadAgent> {
  return request<LeadAgent>(claimUrl(leadId), { method: "DELETE" });
}
