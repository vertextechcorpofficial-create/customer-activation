/**
 * Directus fetch owned by the Referral Campaigns module.
 * Self-contained by design: duplicated here rather than imported
 * from the telemarketing module or any sibling lane.
 */

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";

const JSON_HEADERS: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
};

/**
 * Fetch a Directus REST path (e.g. `/items/referrals_campaign`).
 * - Returns the parsed JSON body on success.
 * - Returns `null` on 204 No Content.
 * - On non-ok: logs with the `DIRECTUS ERROR:` prefix and returns the
 *   parsed error body so callers can surface Directus' message.
 *
 * The optional `token` override exists because some services pass a caller
 * token explicitly; when omitted the module's static token is used.
 */
export async function dFetch<T = unknown>(
    path: string,
    initOrToken?: RequestInit | string,
    maybeInit?: RequestInit,
): Promise<T> {
    const token = typeof initOrToken === "string" ? initOrToken : undefined;
    const init = typeof initOrToken === "string" ? maybeInit : initOrToken;

    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
        headers: {
            ...JSON_HEADERS,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
