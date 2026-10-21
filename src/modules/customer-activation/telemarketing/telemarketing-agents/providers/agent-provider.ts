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
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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
    return body.data as T;
}

export function getAgents(): Promise<AgentView[]> {
    return request<AgentView[]>(BASE);
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

export function searchUsers(search: string, limit = 20): Promise<UserOption[]> {
    const params = new URLSearchParams({ search, limit: String(limit) });
    return request<UserOption[]>(`${BASE}/users?${params.toString()}`);
}
