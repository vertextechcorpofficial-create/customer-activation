import { type ClientOption, type SourceResult, type SourceRow } from "../types/lead.schema";

/**
 * Client-safe wrappers around the lead-generation source APIs.
 * No Directus access here — the API routes own all server I/O.
 * The browser sends only a numeric dealerId; base URLs and tokens never
 * leave the server.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-lead-generation/sources";

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

export interface SourceQueryParams {
    search?: string;
    page?: number;
    limit?: number;
    contact?: "with" | "missing";
}

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, signal });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) throw new Error(body?.message ?? `Request failed (${res.status})`);
    return body.data as T;
}

function withPaging(path: string, params: SourceQueryParams): string {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.contact) query.set("contact", params.contact);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const text = query.toString();
    return text ? `${path}?${text}` : path;
}

/** Every registered client. Never contains connection secrets. */
export function fetchClients(signal?: AbortSignal): Promise<ClientOption[]> {
    return request<ClientOption[]>(`${BASE}/clients`, signal);
}

/**
 * One server-paged window of a client's `customer` table.
 * Returns the discriminated `SourceResult` — branch on `status`:
 * `ok` (rows + live total), `empty` (provisioned, no rows yet),
 * `unavailable` (forbidden | not_found | unreachable + detail).
 */
export function fetchCustomerSource(
    dealerId: number,
    params: SourceQueryParams = {},
    signal?: AbortSignal,
): Promise<SourceResult> {
    const query = new URLSearchParams({ dealerId: String(dealerId) });
    const paged = withPaging(`${BASE}/customer`, params);
    const separator = paged.includes("?") ? "&" : "?";
    return request<SourceResult>(`${paged}${separator}${query.toString()}`, signal);
}

/** Same contract as `fetchCustomerSource`, against the client's `customer_prospect` table. */
export function fetchProspectingSource(
    dealerId: number,
    params: SourceQueryParams = {},
    signal?: AbortSignal,
): Promise<SourceResult> {
    const query = new URLSearchParams({ dealerId: String(dealerId) });
    const paged = withPaging(`${BASE}/prospecting`, params);
    const separator = paged.includes("?") ? "&" : "?";
    return request<SourceResult>(`${paged}${separator}${query.toString()}`, signal);
}

const REFERRALS_BASE =
    "/api/customer-activation/telemarketing/telemarketing-lead-generation/referral-accounts";

export interface ReferralQueryParams {
    search?: string;
    page?: number;
    limit?: number;
    /** `account_status` narrow. Absent means no narrowing. */
    status?: string;
}

/** One website registrant as served by the referral-accounts endpoint. */
export interface ReferralAccountRow {
    referrer_id: number;
    referrer_code: string | null;
    attached_referral_code?: string | null;
    full_name: string | null;
    company_name: string | null;
    position: string | null;
    mobile: string | null;
    email: string | null;
    account_status: string | null;
    email_verified: number | boolean | null;
    created_at: string | null;
}

interface ReferralListEnvelope {
    success: boolean;
    data?: ReferralAccountRow[];
    meta?: { total?: number };
    message?: string;
}

function referralStr(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * One server-paged window of website registrants, mapped into `SourceRow`
 * so the tab reuses the table, selection, and bulk-create machinery.
 * `full_name` becomes the lead-facing name, falling back to `company_name`
 * when the registrant supplied one; there is no address to carry.
 */
export async function fetchReferralAccounts(
    params: ReferralQueryParams = {},
    signal?: AbortSignal,
): Promise<SourceResult> {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.status?.trim()) query.set("status", params.status.trim());
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const text = query.toString();
    const res = await fetch(text ? `${REFERRALS_BASE}?${text}` : REFERRALS_BASE, {
        headers: { "Content-Type": "application/json" },
        signal,
    });
    const body = (await res.json().catch(() => null)) as ReferralListEnvelope | null;
    if (!res.ok || !body?.success) throw new Error(body?.message ?? `Request failed (${res.status})`);
    const rows: SourceRow[] = (Array.isArray(body.data) ? body.data : []).map((row) => ({
        id: Number(row.referrer_id) || 0,
        name: referralStr(row.company_name) ?? referralStr(row.full_name) ?? "(Unnamed registrant)",
        code: referralStr(row.referrer_code),
        contact: referralStr(row.mobile),
        email: referralStr(row.email),
        city: null,
        province: null,
        party_kind: "none" as const,
        party_id: null,
        source: "referral_accounts" as const,
        attachedReferralCode: referralStr(row.attached_referral_code),
        contactName: referralStr(row.full_name),
        position: referralStr(row.position),
        company: referralStr(row.company_name),
        registeredAt: referralStr(row.created_at),
        accountStatus: referralStr(row.account_status),
        referrer_id: Number.isInteger(Number(row.referrer_id)) && Number(row.referrer_id) > 0 ? Number(row.referrer_id) : null,
    }));
    const total = Number(body.meta?.total);
    if (!Number.isInteger(total) || total <= 0) return { status: "empty" };
    return { status: "ok", rows, total };
}
