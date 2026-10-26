import { decodeJwtPayload } from "@/lib/auth-utils";
import type { Lead, LeadCreate, LeadUpdate } from "../types/lead.schema";
import { dFetch } from "../utils/directus";

/** Server-only lead logic for the Lead Generation lane. */

const TABLE = "telemarketing_lead";
const STAGE_TABLE = "telemarketing_stage";

function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

export interface LeadFilters {
    source?: string;
    search?: string;
    stageId?: number;
    page: number;
    limit: number;
}

export interface LeadListMeta {
    total: number;
    page: number;
    limit: number;
}

export interface LeadListResult {
    items: Lead[];
    meta: LeadListMeta;
}

export interface DuplicateMatch {
    table: string;
    id: number;
    label: string;
}

export type CreateLeadResult =
    | { duplicate: true; matched: DuplicateMatch }
    | { duplicate: false; lead: Lead; provenance_recorded: boolean };

interface DedupeTarget {
    table: string;
    emailFields: string[];
    mobileFields: string[];
    idField: string;
    labelFields: string[];
}

// Dedupe answers "have we already created this lead" — not "does this
// entity exist somewhere". Leads are imported FROM client databases, while
// the central `customer` table holds a different population (seeded from
// other tenants), so comparing an import against it produces cross-database
// false positives. `telemarketing_lead` is the table we write to, so it is
// the only dedupe target.
const DEDUPE_TARGETS: DedupeTarget[] = [
    { table: TABLE, emailFields: ["email"], mobileFields: ["mobile"], idField: "lead_id", labelFields: ["company_name"] },
];

// ponytail: data-hygiene workaround — the real fix is source data cleanup,
// and this list is the ceiling. These shared placeholder mobiles must never
// act as identity.
const PLACEHOLDER_MOBILES = new Set(["0", "00", "0000000000", "09123456789", "09000000000", "1234567890"]);

const PLACEHOLDER_EMAILS = new Set(["", "-", "n/a", "none", "test@test.com"]);

function usableEmail(email?: string | null): string | null {
    const mail = (email ?? "").trim().toLowerCase();
    if (!mail || PLACEHOLDER_EMAILS.has(mail)) return null;
    const at = mail.indexOf("@");
    if (at <= 0) return null;
    if (mail.indexOf(".", at) <= at + 1) return null;
    return mail;
}

function usableMobile(mobile?: string | null): string | null {
    const cell = (mobile ?? "").trim();
    if (!cell) return null;
    const stripped = cell.replace(/[\s\-()]/g, "");
    const digits = stripped.replace(/\D/g, "");
    const plausible = /^09\d{9}$/.test(stripped) || /^09\d{9}$/.test(digits) || /^\+?639\d{9}$/.test(stripped) || /^639\d{9}$/.test(digits);
    if (!plausible) return null;
    if (PLACEHOLDER_MOBILES.has(cell) || PLACEHOLDER_MOBILES.has(digits) || PLACEHOLDER_MOBILES.has(stripped)) return null;
    return cell;
}

export function decodeUserId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    for (const key of ["id", "user_id", "sub"]) {
        const value = payload[key];
        if (value === undefined || value === null || value === "") continue;
        const id = Number(value);
        if (Number.isInteger(id)) return id;
    }
    return null;
}

function qs(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, value);
    }
    const query = search.toString();
    return query ? `?${query}` : "";
}

function readData<T>(body: unknown): T | null {
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    if ("errors" in record) return null;
    return (record.data ?? null) as T | null;
}

function readList<T>(body: unknown): T[] {
    if (!body || typeof body !== "object") return [];
    const record = body as Record<string, unknown>;
    if ("errors" in record) return [];
    return Array.isArray(record.data) ? (record.data as T[]) : [];
}

function readTotal(body: unknown): number {
    if (!body || typeof body !== "object") return 0;
    const meta = (body as Record<string, unknown>).meta as { filter_count?: number } | undefined;
    return meta?.filter_count ?? 0;
}

function mobileCandidates(mobile: string): string[] {
    const digits = mobile.replace(/\D/g, "");
    const tail = digits.length > 10 ? digits.slice(-10) : digits;
    return Array.from(new Set([mobile, digits, tail].filter((v) => v.length > 0)));
}

function labelOf(row: Record<string, unknown>, fields: string[]): string {
    for (const field of fields) {
        const value = row[field];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

async function findDuplicate(
    email?: string | null,
    mobile?: string | null,
    productId?: number | null,
): Promise<DuplicateMatch | null> {
    // Only plausibly-identifying contact values act as dedupe keys. When
    // NEITHER a valid email NOR a valid mobile remains, skip the lookup and
    // allow the create — never 409 an import just because the source row has
    // no usable contact. When only one is usable, dedupe on that one only.
    // Invariant: a repeat of the SAME import still 409s, because the repeat
    // carries the same valid email (e.g. cristina@gmail.com) and the email
    // branch matches the lead row created by the first import.
    // Duplicate rule: contact match AND same product — (usable email OR
    // usable mobile matches) AND product_id equals (null matches only null,
    // via `_null`). The same contact with a different product is a
    // legitimate new lead and must NOT 409.
    const mail = usableEmail(email);
    const cell = usableMobile(mobile);
    if (!mail && !cell) return null;
    const productClause =
        productId !== undefined && productId !== null
            ? { product_id: { _eq: productId } }
            : { product_id: { _null: true } };
    for (const target of DEDUPE_TARGETS) {
        const clauses: Record<string, unknown>[] = [];
        if (mail) for (const field of target.emailFields) clauses.push({ [field]: { _eq: mail } });
        if (cell) {
            for (const candidate of mobileCandidates(cell)) {
                for (const field of target.mobileFields) clauses.push({ [field]: { _eq: candidate } });
            }
        }
        if (!clauses.length) continue;
        const body = await dFetch(
            `/items/${target.table}${qs({
                filter: JSON.stringify({ _and: [{ _or: clauses }, productClause] }),
                fields: [target.idField, ...target.labelFields].join(","),
                limit: "1",
            })}`,
        );
        const row = readList<Record<string, unknown>>(body)[0];
        if (!row) continue;
        const id = Number(row[target.idField]);
        return {
            table: target.table,
            id: Number.isFinite(id) ? id : 0,
            label: labelOf(row, target.labelFields) || String(row[target.idField] ?? ""),
        };
    }
    return null;
}

async function nextLeadCode(): Promise<string> {
    const body = await dFetch(`/items/${TABLE}${qs({ sort: "-lead_id", limit: "1", fields: "lead_id,lead_code" })}`);
    const last = readList<{ lead_id?: number; lead_code?: string }>(body)[0];
    const fromCode = Number((last?.lead_code ?? "").replace(/\D/g, ""));
    const fromId = Number(last?.lead_id ?? 0);
    const next = Math.max(Number.isFinite(fromCode) ? fromCode : 0, Number.isFinite(fromId) ? fromId : 0) + 1;
    return `TM-${String(next).padStart(6, "0")}`;
}

/** First active stage by pipeline order â€” new leads start here. */
async function resolveFirstActiveStage(): Promise<number | null> {
    const body = await dFetch(
        `/items/${STAGE_TABLE}${qs({
            filter: JSON.stringify({ is_active: { _eq: 1 } }),
            sort: "stage_order",
            limit: "1",
            fields: "stage_id",
        })}`,
    );
    const row = readList<{ stage_id?: number }>(body)[0];
    const id = Number(row?.stage_id);
    return Number.isInteger(id) ? id : null;
}

export async function listLeads(filters: LeadFilters): Promise<LeadListResult> {
    const page = Math.max(1, Math.trunc(filters.page) || 1);
    // Default matches the module page size (pipeline lead list uses 10).
    const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit) || 10));
    const clauses: Record<string, unknown>[] = [];
    if (filters.stageId !== undefined) clauses.push({ stage_id: { _eq: filters.stageId } });
    if (filters.source) clauses.push({ source: { _eq: filters.source } });
    const search = filters.search?.trim();
    if (search) {
        clauses.push({
            _or: [
                { company_name: { _icontains: search } },
                { lead_code: { _icontains: search } },
                { email: { _icontains: search } },
                { mobile: { _icontains: search } },
            ],
        });
    }
    const body = await dFetch(
        `/items/${TABLE}${qs({
            filter: clauses.length ? JSON.stringify({ _and: clauses }) : undefined,
            sort: "-created_at",
            limit: String(limit),
            offset: String((page - 1) * limit),
            meta: "filter_count",
        })}`,
    );
    return { items: readList<Lead>(body), meta: { total: readTotal(body), page, limit } };
}

export async function getLead(leadId: number): Promise<Lead | null> {
    const body = await dFetch(`/items/${TABLE}/${leadId}`);
    return readData<Lead>(body);
}

/** True when Directus rejected the write because a UNIQUE key was already taken. */
function isUniqueViolation(body: unknown): boolean {
    if (!body || typeof body !== "object") return false;
    const errors = (body as { errors?: Array<{ extensions?: { code?: string } }> }).errors;
    return Array.isArray(errors) && errors[0]?.extensions?.code === "RECORD_NOT_UNIQUE";
}

// Whether `telemarketing_lead` carries the `dealer_id` provenance column,
// detected ONCE per process. The column is applied by the owner (see
// documentation/lead-generation-client-provenance-ddl.md); until then creates
// must not fail — they omit the column and report provenance_recorded: false.
let dealerIdColumn: boolean | null = null;

async function telemarketingLeadHasDealerId(): Promise<boolean> {
    if (dealerIdColumn !== null) return dealerIdColumn;
    try {
        const body = await dFetch<{ data?: Array<{ field?: string }> }>(`/fields/${TABLE}`);
        const fields = Array.isArray(body?.data) ? body.data : [];
        dealerIdColumn = fields.some((entry) => entry?.field === "dealer_id");
    } catch {
        dealerIdColumn = false;
    }
    return dealerIdColumn;
}

export async function createLead(input: LeadCreate, userId: number | null): Promise<CreateLeadResult> {
    const matched = await findDuplicate(input.email, input.mobile, input.product_id ?? null);
    if (matched) return { duplicate: true, matched };
    const stageId = input.stage_id ?? (await resolveFirstActiveStage());
    if (stageId === null || stageId === undefined) {
        console.error("createLead: no active stage to place the new lead");
        throw new Error("INTERNAL_FAIL: No active stage available");
    }
    const now = phNow();
    const { tag_ids, stage_id: _omitted, dealer_id: requestedDealer, product_id, ...fields } = input;
    void _omitted;
    const wantsProvenance = requestedDealer !== undefined && requestedDealer !== null;
    const storeDealer = wantsProvenance && (await telemarketingLeadHasDealerId());
    // `lead_code` is derived from the current maximum, so two simultaneous creates can
    // collide on the UNIQUE key. Retry with a freshly derived code instead of surfacing
    // an opaque 500 - a genuine duplicate would have been caught by findDuplicate above.
    let body: unknown = null;
    let lead: Lead | null = null;
    for (let attempt = 0; attempt < 3 && !lead; attempt += 1) {
        body = await dFetch(`/items/${TABLE}`, {
            method: "POST",
            body: JSON.stringify({
                ...fields,
                ...(storeDealer ? { dealer_id: requestedDealer } : {}),
                // One product per lead; null for historical/unassigned rows.
                // No column-detection fallback: `product_id` must be a
                // registered Directus field or this write is rejected.
                product_id: product_id ?? null,
                stage_id: stageId,
                lead_code: await nextLeadCode(),
                // Retained for the shared database (NOT NULL column); not surfaced in this app.
                validation_status: "new",
                created_by: userId,
                created_at: now,
                updated_by: userId,
                updated_at: now,
            }),
        });
        lead = readData<Lead>(body);
        if (!lead && !isUniqueViolation(body)) break;
    }
    if (!lead) {
        console.error("createLead: Directus rejected the insert", body);
        throw new Error("INTERNAL_FAIL: Could not create the lead");
    }
    if (tag_ids?.length) {
        const links = await Promise.allSettled(
            tag_ids.map((tag_id) =>
                dFetch("/items/telemarketing_lead_tag", {
                    method: "POST",
                    body: JSON.stringify({
                        lead_id: lead.lead_id,
                        tag_id,
                        tagged_at: now,
                        tagged_by: userId,
                        created_by: userId,
                        created_at: now,
                        updated_by: userId,
                        updated_at: now,
                    }),
                }),
            ),
        );
        for (const link of links) {
            if (link.status === "rejected") console.error("createLead: tag link failed", link.reason);
        }
    }
    return { duplicate: false, lead, provenance_recorded: !wantsProvenance || storeDealer };
}

export async function updateLead(leadId: number, input: LeadUpdate, userId: number | null): Promise<Lead | null> {
    const body = await dFetch(`/items/${TABLE}/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...input, updated_by: userId, updated_at: phNow() }),
    });
    const lead = readData<Lead>(body);
    if (!lead) console.error("updateLead: Directus rejected the update", body);
    return lead;
}
