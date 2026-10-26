import type { LeadAgent } from "../types/pipeline.schema";
import type { ClaimsView, PoolResult, PoolSort } from "../services/claim-service";

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

export interface PoolQueryParams {
  search?: string;
  stageId?: number;
  productId?: number;
  sort?: PoolSort;
  page?: number;
  limit?: number;
  includeClosed?: boolean;
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

function poolQs(params: PoolQueryParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.stageId !== undefined && params.stageId !== null) search.set("stageId", String(params.stageId));
  if (params.productId !== undefined && params.productId !== null) search.set("productId", String(params.productId));
  if (params.includeClosed) search.set("includeClosed", "1");
  if (params.sort) search.set("sort", params.sort);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getPool(params: PoolQueryParams = {}, signal?: AbortSignal): Promise<PoolResult> {
  const { page = 1, limit = 10 } = params;
  const query = poolQs({ ...params, page, limit });
  return request<PoolResult>(`${POOL_BASE}${query}`, { cache: "no-store", signal });
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
