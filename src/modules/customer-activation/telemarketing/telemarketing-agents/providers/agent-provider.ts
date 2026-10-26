import type { Agent, AgentCreate, AgentUpdate, UserOption } from "../types/agent.schema";
import type { AgentView } from "../services/agent-service";

/**
 * Client-safe wrappers around the user-creation API routes.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-agents";

interface Envelope<T> {
    success: boolean;
    data?: T;
    meta?: { total: number; page: number; limit: number };
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

async function requestEnvelope<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) {
        throw new Error(
            body?.errors?.[0]?.message ?? body?.message ?? "Something went wrong. Please try again.",
        );
    }
    return body;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const body = await requestEnvelope<T>(url, init);
    return body.data as T;
}

export interface AgentPageResult {
    items: AgentView[];
    total: number;
    page: number;
    limit: number;
}

export function getAgentsPage(params: {
    page: number;
    limit: number;
    search?: string;
}): Promise<AgentPageResult> {
    const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
    });
    if (params.search?.trim()) qs.set("search", params.search.trim());
    return requestEnvelope<AgentView[]>(`${BASE}?${qs.toString()}`).then((body) => ({
        items: body.data ?? [],
        total: body.meta?.total ?? body.data?.length ?? 0,
        page: body.meta?.page ?? params.page,
        limit: body.meta?.limit ?? params.limit,
    }));
}

export function getAgents(): Promise<AgentView[]> {
    return request<AgentView[]>(`${BASE}?limit=100`);
}

export function registerAgent(input: AgentCreate): Promise<Agent> {
    return request<Agent>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateAgent(agentId: number, input: AgentUpdate): Promise<Agent> {
    return request<Agent>(`${BASE}/${agentId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateAgent(agentId: number): Promise<Agent> {
    return request<Agent>(`${BASE}/${agentId}`, { method: "DELETE" });
}

/** One page of the registration combobox's user search. */
export const USER_PAGE_SIZE = 50;

export function searchUsers(params: {
    search: string;
    offset?: number;
    limit?: number;
}): Promise<UserOption[]> {
    const qs = new URLSearchParams({
        search: params.search,
        limit: String(params.limit ?? USER_PAGE_SIZE),
        offset: String(params.offset ?? 0),
    });
    return request<UserOption[]>(`${BASE}/users?${qs.toString()}`);
}
