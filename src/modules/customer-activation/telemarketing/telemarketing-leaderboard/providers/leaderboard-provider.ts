import type { LeaderboardData, LeaderboardPeriod } from "../types/leaderboard.schema";

/**
 * Client-safe wrappers around `/api/customer-activation/telemarketing/telemarketing-leaderboard`.
 * No Directus access here — the API route owns all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-leaderboard";

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
    throw new Error(body?.errors?.[0]?.message ?? body?.message ?? "Something went wrong. Please try again.");
  }
  return body.data as T;
}

/**
 * Gamified agent leaderboard for a rolling window.
 * @param period - 7 | 30 | 90 days (default 30). Anything else is rejected
 * server-side with a 400.
 */
export function getLeaderboard(period: LeaderboardPeriod = 30): Promise<LeaderboardData> {
  const query = Number.isInteger(period) ? `?period=${period}` : "";
  return request<LeaderboardData>(`${BASE}${query}`);
}
