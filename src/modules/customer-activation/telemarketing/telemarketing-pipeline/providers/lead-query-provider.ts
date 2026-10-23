import type { LeadRecord, LeadTagView } from "../types/pipeline.schema";
import type { LeadQueryMeta, LeadSort } from "../services/lead-query-service";

/**
 * Client-safe wrappers around `/api/customer-activation/telemarketing/telemarketing-pipeline/leads`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline/leads";

export interface LeadQueryParams {
  stageId?: number;
  source?: string;
  search?: string;
  sort?: LeadSort;
  page?: number;
  limit?: number;
}

export interface LeadPage {
  items: LeadRecord[];
  meta: LeadQueryMeta;
}

export interface LeadRecordView {
  lead: LeadRecord;
  tags: LeadTagView[];
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

function messageOf(body: Envelope<unknown> | null, status: number): string {
  return body?.message ?? `Request failed (${status})`;
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
  return body.data as T;
}

function qs(params: LeadQueryParams): string {
  const search = new URLSearchParams();
  if (params.stageId !== undefined) search.set("stageId", String(params.stageId));
  if (params.source) search.set("source", params.source);
  if (params.search) search.set("search", params.search);
  if (params.sort) search.set("sort", params.sort);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Lists leads.
 * @param params - Stage/source/search/sort filters plus paging.
 * @returns The page of leads and its paging meta.
 */
export function fetchLeadPage(params: LeadQueryParams = {}): Promise<LeadPage> {
  return request<LeadPage>(`${BASE}${qs(params)}`);
}

/**
 * Loads one lead with its tags.
 * @param leadId - The lead id.
 * @returns The lead and its tags.
 */
export function fetchLeadRecord(leadId: number): Promise<LeadRecordView> {
  return request<LeadRecordView>(`${BASE}/${leadId}`);
}
