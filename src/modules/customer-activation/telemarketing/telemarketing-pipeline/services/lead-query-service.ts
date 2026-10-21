/**
 * Pipeline lead-query service — server-only, read-only over `telemarketing_lead`
 * (plus the tag link tables for the detail view). The pipeline never creates
 * leads — capture belongs to lead-generation.
 */

import { dFetch } from "../utils/directus";
import type { LeadRecord, LeadTagView } from "../types/pipeline.schema";

const LEADS = "telemarketing_lead";
const LEAD_TAGS = "telemarketing_lead_tag";
const TAGS = "telemarketing_tag";

export interface LeadQueryFilters {
  stageId?: number;
  source?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface LeadQueryMeta {
  total: number;
  page: number;
  limit: number;
}

export interface LeadQueryResult {
  items: LeadRecord[];
  meta: LeadQueryMeta;
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function readList<T>(body: unknown): T[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  if ("errors" in record) return [];
  return Array.isArray(record.data) ? (record.data as T[]) : [];
}

function readData<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if ("errors" in record) return null;
  return (record.data ?? null) as T | null;
}

function readTotal(body: unknown): number {
  if (!body || typeof body !== "object") return 0;
  const meta = (body as Record<string, unknown>).meta as { total_count?: number } | undefined;
  return meta?.total_count ?? 0;
}

/**
 * Lists leads with the given filters, newest first.
 * @param filters - Stage/source/search filters plus paging.
 * @returns The page of leads and its paging meta.
 */
export async function listLeads(filters: LeadQueryFilters): Promise<LeadQueryResult> {
  const page = Math.max(1, Math.trunc(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit) || 20));

  const clauses: Record<string, unknown>[] = [];
  if (filters.stageId !== undefined) clauses.push({ stage_id: { _eq: filters.stageId } });
  if (filters.source) clauses.push({ source: { _eq: filters.source } });

  const search = filters.search?.trim();
  if (search) {
    clauses.push({
      _or: [
        { company_name: { _icontains: search } },
        { contact_name: { _icontains: search } },
        { lead_code: { _icontains: search } },
        { email: { _icontains: search } },
        { mobile: { _icontains: search } },
      ],
    });
  }

  const body = await dFetch(
    `/items/${LEADS}${qs({
      filter: clauses.length ? JSON.stringify({ _and: clauses }) : undefined,
      sort: "-created_at",
      limit: String(limit),
      offset: String((page - 1) * limit),
      meta: "total_count",
    })}`,
  );

  return {
    items: readList<LeadRecord>(body),
    meta: { total: readTotal(body), page, limit },
  };
}

/**
 * Loads one lead.
 * @param leadId - The lead id.
 * @returns The lead, or null when it does not exist.
 */
export async function getLead(leadId: number): Promise<LeadRecord | null> {
  return readData<LeadRecord>(await dFetch(`/items/${LEADS}/${leadId}`));
}

/**
 * Tags on a lead, resolved through the link table.
 * @param leadId - The lead id.
 * @returns The lead's tags, in tag order.
 */
export async function listLeadTags(leadId: number): Promise<LeadTagView[]> {
  const links = readList<{ tag_id: number }>(
    await dFetch(
      `/items/${LEAD_TAGS}${qs({
        filter: JSON.stringify({ lead_id: { _eq: leadId } }),
        fields: "tag_id",
        limit: "-1",
      })}`,
    ),
  );
  const tagIds = [...new Set(links.map((link) => link.tag_id).filter((id) => Number.isInteger(id)))];
  if (tagIds.length === 0) return [];
  return readList<LeadTagView>(
    await dFetch(
      `/items/${TAGS}${qs({
        filter: JSON.stringify({ tag_id: { _in: tagIds } }),
        fields: "tag_id,tag_name,color",
        limit: "-1",
      })}`,
    ),
  );
}
