import type { LeadRecord, LeadTagView } from "../types/pipeline.schema";

/**
 * Client-safe wrapper around `/api/customer-activation/telemarketing/telemarketing-pipeline/leads`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-pipeline/leads";

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

/**
 * Loads one lead with its tags.
 * @param leadId - The lead id.
 * @returns The lead and its tags.
 */
export function fetchLeadRecord(leadId: number): Promise<LeadRecordView> {
  return request<LeadRecordView>(`${BASE}/${leadId}`);
}
