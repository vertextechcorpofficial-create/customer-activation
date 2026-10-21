import { decodeJwtPayload } from "@/lib/auth-utils";
import type { Prospect, ProspectCreate, ProspectStatus, ProspectUpdate } from "../types/prospect.schema";
import { dFetch } from "../utils/directus";

/**
 * Prospect service — server-only.
 *
 * Single owner of every read/write against `telemarketing_prospect`.
 * `customer`, `company_list` and `dealer_list` are READ-ONLY reference data:
 * they are only matched against for dedupe, never written.
 * Philippine time is written explicitly on every mutation.
 */

const TABLE = "telemarketing_prospect";

export interface ProspectFilters {
    search?: string;
    status?: ProspectStatus;
    page: number;
    limit: number;
}

export interface ProspectListMeta {
    total: number;
    page: number;
    limit: number;
}

export interface ProspectListResult {
    items: Prospect[];
    meta: ProspectListMeta;
}

export interface DuplicateMatch {
    table: string;
    id: number;
    label: string;
}

export type CreateProspectResult =
    | { duplicate: true; matched: DuplicateMatch }
    | { duplicate: false; prospect: Prospect };

interface DedupeTarget {
    table: string;
    emailFields: string[];
    mobileFields: string[];
    idField: string;
    labelFields: string[];
}

const DEDUPE_TARGETS: DedupeTarget[] = [
    { table: TABLE, emailFields: ["email"], mobileFields: ["mobile"], idField: "prospect_id", labelFields: ["company_name"] },
    { table: "telemarketing_lead", emailFields: ["email"], mobileFields: ["mobile"], idField: "lead_id", labelFields: ["company_name"] },
    { table: "customer", emailFields: ["customer_email"], mobileFields: ["contact_number"], idField: "id", labelFields: ["customer_name"] },
    { table: "company_list", emailFields: ["company_email"], mobileFields: ["company_contact"], idField: "company_id", labelFields: ["company_name"] },
    { table: "dealer_list", emailFields: ["dealer_email"], mobileFields: ["dealer_contact"], idField: "dealer_id", labelFields: ["dealer_name"] },
];

/** Philippine time, written explicitly by the app. */
function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class ProspectServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "ProspectServiceError";
        this.status = status;
    }
}

const DIRECTUS_ERROR_STATUS: Record<string, number> = {
    INVALID_PAYLOAD: 400,
    RECORD_NOT_FOUND: 404,
    RECORD_NOT_UNIQUE: 409,
    FORBIDDEN: 403,
};

interface DirectusEnvelope<T> {
    data?: T;
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

/** `dFetch` hands back the parsed error body on a non-ok response. */
function throwDirectusError(body: DirectusEnvelope<unknown>): never {
    const first = body.errors?.[0];
    const status = DIRECTUS_ERROR_STATUS[first?.extensions?.code ?? ""] ?? 500;
    throw new ProspectServiceError(first?.message ?? "Directus request failed", status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
    return body;
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
    const meta = (body as Record<string, unknown>).meta as { total_count?: number } | undefined;
    return meta?.total_count ?? 0;
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

async function findDuplicate(email?: string | null, mobile?: string | null): Promise<DuplicateMatch | null> {
    const mail = (email ?? "").trim().toLowerCase();
    const cell = (mobile ?? "").trim();
    if (!mail && !cell) return null;
    for (const target of DEDUPE_TARGETS) {
        const clauses: Record<string, unknown>[] = [];
        if (mail) for (const field of target.emailFields) clauses.push({ [field]: { _eq: mail } });
        if (cell) {
            for (const candidate of mobileCandidates(cell)) {
                for (const field of target.mobileFields) clauses.push({ [field]: { _eq: candidate } });
            }
        }
        if (clauses.length === 0) continue;
        const body = await dFetch(
            `/items/${target.table}${qs({
                filter: JSON.stringify({ _or: clauses }),
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

async function nextProspectCode(): Promise<string> {
    const body = await dFetch(`/items/${TABLE}${qs({ sort: "-prospect_id", limit: "1", fields: "prospect_id,prospect_code" })}`);
    const last = readList<{ prospect_id?: number; prospect_code?: string }>(body)[0];
    const fromCode = Number((last?.prospect_code ?? "").replace(/\D/g, ""));
    const fromId = Number(last?.prospect_id ?? 0);
    const next = Math.max(Number.isFinite(fromCode) ? fromCode : 0, Number.isFinite(fromId) ? fromId : 0) + 1;
    return `PR-${String(next).padStart(6, "0")}`;
}

/**
 * Lists prospects with search/status filters, newest first.
 * @param filters - Search/status filters plus paging.
 * @returns The page of prospects and its paging meta.
 */
export async function listProspects(filters: ProspectFilters): Promise<ProspectListResult> {
    const page = Math.max(1, Math.trunc(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit) || 20));
    const clauses: Record<string, unknown>[] = [];
    if (filters.status) clauses.push({ prospect_status: { _eq: filters.status } });
    const search = filters.search?.trim();
    if (search) {
        clauses.push({
            _or: [
                { company_name: { _icontains: search } },
                { contact_name: { _icontains: search } },
                { prospect_code: { _icontains: search } },
                { email: { _icontains: search } },
                { mobile: { _icontains: search } },
            ],
        });
    }
    const body = await request<Prospect[]>(
        `/items/${TABLE}${qs({
            filter: clauses.length ? JSON.stringify({ _and: clauses }) : undefined,
            sort: "-created_at",
            limit: String(limit),
            offset: String((page - 1) * limit),
            meta: "total_count",
        })}`,
    );
    return { items: body.data ?? [], meta: { total: readTotal(body), page, limit } };
}

/**
 * Manually enters a new prospect. Dedupes on email/mobile first across the
 * prospect, lead, customer, company and dealer tables — on a hit nothing is
 * inserted and the match is returned for a 409.
 * @param input - The validated manual-entry payload.
 * @param userId - The signed-in user for the audit columns.
 * @returns Either the duplicate match or the inserted prospect.
 */
/** True when Directus rejected the write because a UNIQUE key was already taken. */
function isUniqueViolation(body: unknown): boolean {
    if (!body || typeof body !== "object") return false;
    const errors = (body as { errors?: Array<{ extensions?: { code?: string } }> }).errors;
    return Array.isArray(errors) && errors[0]?.extensions?.code === "RECORD_NOT_UNIQUE";
}

export async function createProspect(input: ProspectCreate, userId: number | null): Promise<CreateProspectResult> {
    const matched = await findDuplicate(input.email, input.mobile);
    if (matched) return { duplicate: true, matched };
    const now = phNow();
    // `prospect_code` is derived from the current maximum, so two simultaneous creates can
    // collide on the UNIQUE key. Retry with a fresh code instead of a 500.
    let body: unknown = null;
    let prospect: Prospect | null = null;
    for (let attempt = 0; attempt < 3 && !prospect; attempt += 1) {
        body = await dFetch(
        `/items/${TABLE}`,
        {
            method: "POST",
            body: JSON.stringify({
                prospect_code: await nextProspectCode(),
                company_name: input.company_name.trim(),
                contact_name: input.contact_name?.trim() || null,
                contact_position: input.contact_position?.trim() || null,
                mobile: input.mobile?.trim() || null,
                email: input.email?.trim().toLowerCase() || null,
                address: input.address?.trim() || null,
                industry: input.industry?.trim() || null,
                product_interest: input.product_interest?.trim() || null,
                need: input.need?.trim() || null,
                prospect_status: "new",
                converted_customer_id: null,
                converted_at: null,
                created_by: userId,
                created_at: now,
                updated_by: userId,
                updated_at: now,
            }),
        },
        );
        prospect = readData<Prospect>(body);
        if (!prospect && !isUniqueViolation(body)) break;
    }
    if (!prospect) {
        console.error("createProspect: Directus rejected the insert", body);
        throw new ProspectServiceError("Could not save the prospect", 500);
    }
    return { duplicate: false, prospect };
}

/**
 * Patches a prospect. `status: "converted"` can never arrive here — the
 * schema omits it and this guard rejects it at runtime anyway, because
 * conversion belongs to the pipeline module alone.
 * @param prospectId - The prospect id.
 * @param input - The validated partial patch.
 * @param userId - The signed-in user for the audit columns.
 * @returns The updated prospect.
 */
export async function updateProspect(
    prospectId: number,
    input: ProspectUpdate,
    userId: number | null,
): Promise<Prospect> {
    if ((input as { prospect_status?: string }).prospect_status === "converted") {
        throw new ProspectServiceError("Prospects can only be converted from the pipeline", 400);
    }
    const patch: Record<string, unknown> = { updated_by: userId, updated_at: phNow() };
    if (input.company_name !== undefined) patch.company_name = input.company_name.trim();
    if (input.contact_name !== undefined) patch.contact_name = input.contact_name?.trim() || null;
    if (input.contact_position !== undefined) patch.contact_position = input.contact_position?.trim() || null;
    if (input.mobile !== undefined) patch.mobile = input.mobile?.trim() || null;
    if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null;
    if (input.address !== undefined) patch.address = input.address?.trim() || null;
    if (input.industry !== undefined) patch.industry = input.industry?.trim() || null;
    if (input.product_interest !== undefined) patch.product_interest = input.product_interest?.trim() || null;
    if (input.need !== undefined) patch.need = input.need?.trim() || null;
    if (input.prospect_status !== undefined) patch.prospect_status = input.prospect_status;
    const body = await request<Prospect>(`/items/${TABLE}/${prospectId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    if (!body.data) throw new ProspectServiceError("Prospect was not updated", 500);
    return body.data;
}
