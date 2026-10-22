import type { PerUserReport, ReportPeriod } from "../types/report.schema";

/**
 * Client-safe wrappers around the per-user-report API route.
 * No Directus access here — the route owns all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-agent-report";

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

/** Per-agent metrics for a period, sorted by conversions then activities. */
export function fetchPerUserReport(period: ReportPeriod): Promise<PerUserReport> {
    return request<PerUserReport>(`${BASE}?period=${period}`);
}
