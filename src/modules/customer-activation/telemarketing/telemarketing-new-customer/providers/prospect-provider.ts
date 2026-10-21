import type { Prospect, ProspectCreate, ProspectStatus, ProspectUpdate } from "../types/prospect.schema";

/**
 * Client-safe wrappers around the new-customer API routes.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-new-customer";

export interface ProspectListParams {
    search?: string;
    status?: ProspectStatus;
    page?: number;
    limit?: number;
}

export interface ProspectListData {
    items: Prospect[];
    meta: { total: number; page: number; limit: number };
}

export interface DuplicateMatch {
    table: string;
    id: number;
    label: string;
}

export type ProspectCreateOutcome =
    | { duplicate: true; matched: DuplicateMatch }
    | { duplicate: false; prospect: Prospect };

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: unknown;
}

function messageOf(body: Envelope<unknown> | null, status: number): string {
    return body?.message ?? `Request failed (${status})`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return body.data as T;
}

function qs(params: ProspectListParams): string {
    const search = new URLSearchParams();
    if (params.search) search.set("search", params.search);
    if (params.status) search.set("status", params.status);
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    const query = search.toString();
    return query ? `?${query}` : "";
}

export function fetchProspects(params: ProspectListParams = {}): Promise<ProspectListData> {
    return request<ProspectListData>(`${BASE}${qs(params)}`);
}

export async function createProspect(input: ProspectCreate): Promise<ProspectCreateOutcome> {
    const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as (Envelope<Prospect> & {
        errors?: { duplicate?: DuplicateMatch };
    }) | null;
    if (res.status === 409) {
        const matched = body?.errors?.duplicate;
        return { duplicate: true, matched: matched ?? { table: "", id: 0, label: messageOf(body, 409) } };
    }
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return { duplicate: false, prospect: body.data as Prospect };
}

export function updateProspect(prospectId: number, input: ProspectUpdate): Promise<Prospect> {
    return request<Prospect>(`${BASE}/${prospectId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
