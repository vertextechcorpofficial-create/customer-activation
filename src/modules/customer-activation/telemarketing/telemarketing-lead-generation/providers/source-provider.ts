import type { SourceRow } from "../types/lead.schema";

/**
 * Client-safe wrappers around the lead-generation source APIs.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-lead-generation/sources";

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
}

async function request<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) throw new Error(body?.message ?? `Request failed (${res.status})`);
    return body.data as T;
}

function withSearch(path: string, search?: string): string {
    return search?.trim() ? `${path}?search=${encodeURIComponent(search.trim())}` : path;
}

export function fetchCustomerDb(search?: string): Promise<SourceRow[]> {
    return request<SourceRow[]>(withSearch(`${BASE}/customer-db`, search));
}

export function fetchProspecting(): Promise<SourceRow[]> {
    return request<SourceRow[]>(`${BASE}/prospecting`);
}

export function fetchClientDb(search?: string): Promise<SourceRow[]> {
    return request<SourceRow[]>(withSearch(`${BASE}/client-db`, search));
}
