/**
 * Client-scoped Directus fetch — takes an explicit base URL + token per call.
 *
 * Mirrors the single-tenant `utils/directus` (dFetch) semantics: no-store,
 * Bearer auth, 204 resolves to null, and a non-ok response resolves to the
 * parsed error body instead of throwing — but the HTTP status is surfaced
 * alongside the body so callers can tell "forbidden" apart from "not found".
 * Network failures and timeouts reject so callers can map them to
 * "unreachable". Every request aborts after 5s.
 */

export interface ClientFetchResult<T> {
    ok: boolean;
    status: number;
    body: T;
}

function trimBase(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
}

export async function clientFetch<T = unknown>(
    baseUrl: string,
    token: string,
    path: string,
    init?: RequestInit,
): Promise<ClientFetchResult<T>> {
    const timeout = AbortSignal.timeout(5000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const res = await fetch(`${trimBase(baseUrl)}${path}`, {
        ...init,
        signal,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {}),
        },
    });
    if (res.status === 204) return { ok: true, status: 204, body: null as T };
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        console.error("CLIENT DIRECTUS ERROR:", res.status, path, body);
    }
    return { ok: res.ok, status: res.status, body: body as T };
}
