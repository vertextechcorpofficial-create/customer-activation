/**
 * Conversion service — server-only.
 *
 * Closed Won is the only place the pipeline writes into the shared `customer`
 * table. Two rules come from the Customer Asset session and hold here:
 *  - `customer_code` is allocated BEFORE insert. It is not derived from the row
 *    id (only 148 of 3361 existing codes end in their id), and we do not add a
 *    trigger to someone else's table.
 *  - `isActive` is written explicitly as 1. The column defaults to 0, and a
 *    customer with 0 is invisible to the asset picker.
 *
 * Code shape: `CA-<lead_code>` — unique by construction (lead codes are unique)
 * and traceable back to its lead without knowing the id.
 */

import { dFetch } from "../utils/directus";
import type { LeadView } from "../types/pipeline.schema";

const CUSTOMERS = "customer";
const LEADS = "telemarketing_lead";

const CODE_PREFIX = "CA-";

function phNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function readData<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if ("errors" in record) return null;
  return (record.data ?? null) as T | null;
}

function readRows<T>(body: unknown): T[] {
  const data = readData<T[]>(body);
  return Array.isArray(data) ? data : [];
}

function errorText(body: unknown): string {
  if (!body || typeof body !== "object") return "unknown error";
  const errors = (body as { errors?: Array<{ message?: string }> }).errors;
  return errors?.[0]?.message ?? "unknown error";
}

export interface ConversionResult {
  customerId: number;
  customerCode: string;
  /** True when the customer already existed (retry or duplicate conversion). */
  reused: boolean;
}

interface CustomerRow {
  id: number;
  customer_code: string;
  lead_id: number | null;
}

async function findCustomerByCode(code: string): Promise<CustomerRow | null> {
  const filter = encodeURIComponent(JSON.stringify({ customer_code: { _eq: code } }));
  const rows = readRows<CustomerRow>(
    await dFetch(`/items/${CUSTOMERS}?filter=${filter}&limit=1&fields=id,customer_code,lead_id`),
  );
  return rows[0] ?? null;
}

let cachedStoreTypeId: number | null = null;

// ponytail: every converted customer gets the first store_type until an industry→store_type mapping exists.
async function resolveStoreType(): Promise<number> {
  if (cachedStoreTypeId !== null) return cachedStoreTypeId;
  const rows = readRows<{ id: number }>(
    await dFetch(`/items/store_type?limit=1&sort=id&fields=id`),
  );
  const id = rows[0]?.id;
  if (typeof id !== "number") {
    throw new Error("No store_type rows exist; cannot convert");
  }
  cachedStoreTypeId = id;
  return id;
}

/** Two-way link: the lead points at its customer, so the pair is traceable. */
async function linkLead(leadId: number, customerId: number, actorId: number | null): Promise<void> {
  const now = phNow();
  const body = await dFetch(`/items/${LEADS}/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({
      converted_customer_id: customerId,
      converted_at: now,
      updated_by: actorId,
      updated_at: now,
    }),
  });
  if (readData<unknown>(body) === null) {
    throw new Error(`Could not link the lead to customer ${customerId}: ${errorText(body)}`);
  }
}

/**
 * Create (or reuse) the customer for a won lead and link both directions.
 * Idempotent: a repeat call finds the existing `CA-<lead_code>` and just relinks.
 */
export async function convertLeadToCustomer(
  lead: LeadView,
  actorId: number | null,
): Promise<ConversionResult> {
  const code = `${CODE_PREFIX}${lead.lead_code}`;

  const existing = await findCustomerByCode(code);
  if (existing) {
    if (existing.lead_id !== lead.lead_id) {
      // Someone else's row already owns this code — do not hijack it.
      throw new Error(
        `customer_code ${code} already belongs to customer ${existing.id} (lead ${existing.lead_id ?? "none"})`,
      );
    }
    await linkLead(lead.lead_id, existing.id, actorId);
    return { customerId: existing.id, customerCode: code, reused: true };
  }

  const body = await dFetch(`/items/${CUSTOMERS}`, {
      method: "POST",
      body: JSON.stringify({
        customer_code: code,
        customer_name: lead.company_name,
        isActive: 1,
        lead_id: lead.lead_id,
        store_type: await resolveStoreType(),
        contact_number: lead.mobile ?? null,
        customer_email: lead.email ?? null,
        date_entered: phNow(),
        encoder_id: actorId ?? 0,
      }),
    });
  const created = readData<{ id: number }>(body);

  if (!created?.id) {
    throw new Error(`Could not create the customer record for ${code}: ${errorText(body)}`);
  }

  try {
    await linkLead(lead.lead_id, created.id, actorId);
  } catch (error) {
    // Compensate: an unlinked customer row is worse than none — a retry would
    // find it by code and relink, but a stray row also pollutes the picker.
    const rollback = await dFetch(`/items/${CUSTOMERS}/${created.id}`, { method: "DELETE" });
    if (rollback !== null && typeof rollback === "object" && "errors" in rollback) {
      console.error(
        "conversion: link failed AND rollback failed; customer",
        created.id,
        "is orphaned",
        errorText(rollback),
      );
    }
    throw error;
  }

  return { customerId: created.id, customerCode: code, reused: false };
}
