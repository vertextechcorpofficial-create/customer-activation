/**
 * Own Directus fetch for the new-customer lane.
 * Self-contained copy: never import dFetch from a sibling module folder.
 */

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";

const JSON_HEADERS: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
};

/**
 * Fetch a Directus REST path (e.g. `/items/telemarketing_prospect`).
 * - Returns the parsed JSON body on success.
 * - Returns `null` on 204 No Content.
 * - No cache: every read is fresh for the table view.
 * - On non-ok: the parsed error body is returned so callers can surface
 *   Directus' message; callers detect it via the `errors` key.
 */
export async function dFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
            ...JSON_HEADERS,
            ...(init?.headers ?? {}),
        },
    });
    if (res.status === 204) return null as T;
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        console.error("DIRECTUS ERROR:", res.status, path, body);
        return body as T;
    }
    return body as T;
}
