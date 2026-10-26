/**
 * Pipeline lead-query service â€” server-only, read-only over `telemarketing_lead`
 * (plus the tag link tables for the detail view). The pipeline never creates
 * leads â€” capture belongs to lead-generation.
 */

import { dFetch } from "../utils/directus";
import type { LeadRecord, LeadTagView } from "../types/pipeline.schema";

const LEADS = "telemarketing_lead";
const LEAD_TAGS = "telemarketing_lead_tag";
const TAGS = "telemarketing_tag";

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
