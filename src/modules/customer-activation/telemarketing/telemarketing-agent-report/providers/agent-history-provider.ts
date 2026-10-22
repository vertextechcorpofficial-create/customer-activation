import type { AgentHistory } from "../services/agent-history-service";
import type { ReportPeriod } from "../types/report.schema";

/**
 * Client-safe wrappers around the agent-history API route.
 * No Directus access here — the route owns all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-agent-report/agents";

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: unknown;
}

function messageOf(body: Envelope<unknown> | null, status: number): string {
    return body?.message ?? `Request failed (${status})`;
}

async function request<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return body.data as T;
}

/** One agent's KPIs, recent activities and claimed leads for a period. */
export function fetchAgentHistory(agentId: number, period: ReportPeriod): Promise<AgentHistory> {
    return request<AgentHistory>(`${BASE}/${agentId}?period=${period}`);
}

export type { AgentHistory, ReportPeriod };
