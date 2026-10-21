import type { LeaderboardRow } from "../types/leaderboard.schema";

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

/** Month-to-date agent leaderboard, already ranked. */
export function getLeaderboard(): Promise<LeaderboardRow[]> {
  return request<LeaderboardRow[]>(BASE);
}
