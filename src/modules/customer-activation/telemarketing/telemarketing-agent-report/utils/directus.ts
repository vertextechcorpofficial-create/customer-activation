/**
 * Self-contained Directus fetch for the per-user-report module.
 * Never import the shared telemarketing utils — this file owns its plumbing.
 */

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";

const JSON_HEADERS: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
};

/**
 * Fetch a Directus REST path (e.g. `/items/telemarketing_agent`).
 * - Returns the parsed JSON body on success.
 * - Returns `null` on 204 No Content.
 * - On non-ok: logs with the `DIRECTUS ERROR:` prefix and returns the
 *   parsed error body so callers can surface Directus' message.
 * ponytail: no cache directive — report reads run in a force-dynamic route
 * and must reflect the current rows on every request.
 */
export async function dFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
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
