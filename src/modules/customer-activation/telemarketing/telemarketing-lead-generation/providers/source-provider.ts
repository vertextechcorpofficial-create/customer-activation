import { type ClientOption, type SourceResult } from "../types/lead.schema";

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
