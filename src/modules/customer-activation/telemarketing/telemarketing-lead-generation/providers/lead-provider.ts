import type { Lead, LeadCreate, LeadUpdate } from "../types/lead.schema";

/**
 * Client-safe wrappers around the lead-generation leads API.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-lead-generation/leads";

export interface LeadListParams {
    source?: string;
    search?: string;
    stageId?: number;
    page?: number;
    limit?: number;
}

export interface LeadListData {
    items: Lead[];
    meta: { total: number; page: number; limit: number };
}

export interface DuplicateMatch {
    table: string;
    id: number;
    label: string;
}

export type LeadCreateOutcome =
    | { duplicate: true; matched: DuplicateMatch }
    | { duplicate: false; lead: Lead };

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
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return body.data as T;
}

function qs(params: LeadListParams): string {
    const search = new URLSearchParams();
    if (params.source) search.set("source", params.source);
    if (params.search) search.set("search", params.search);
    if (params.stageId !== undefined) search.set("stageId", String(params.stageId));
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    const query = search.toString();
    return query ? `?${query}` : "";
}

export function fetchLeads(params: LeadListParams = {}): Promise<LeadListData> {
    return request<LeadListData>(`${BASE}${qs(params)}`);
}

export function fetchLead(leadId: number): Promise<Lead> {
    return request<Lead>(`${BASE}/${leadId}`);
}

export async function createLead(input: LeadCreate): Promise<LeadCreateOutcome> {
    const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as (Envelope<Lead> & {
        errors?: { duplicate?: DuplicateMatch };
    }) | null;
    if (res.status === 409) {
        const matched = body?.errors?.duplicate;
        return { duplicate: true, matched: matched ?? { table: "", id: 0, label: messageOf(body, 409) } };
    }
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return { duplicate: false, lead: body.data as Lead };
}

export function updateLead(leadId: number, input: LeadUpdate): Promise<Lead> {
    return request<Lead>(`${BASE}/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
}
