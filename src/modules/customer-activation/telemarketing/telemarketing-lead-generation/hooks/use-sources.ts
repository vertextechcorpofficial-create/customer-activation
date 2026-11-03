"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SOURCE_PAGE_SIZE, type ClientOption, type SourceResult } from "../types/lead.schema";
import {
    fetchClients,
    fetchCustomerSource,
    fetchProspectingSource,
    fetchReferralAccounts,
    fetchWebsites,
    type WebsiteOption,
} from "../providers/source-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

function isAbort(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

export type ClientSourceKind = "customer" | "prospecting";

/** The registered clients a source tab can be scoped to. No secrets — safe for the browser. */
export function useClients() {
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setClients(await fetchClients());
        } catch (err) {
            if (isAbort(err)) return;
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load clients", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { clients, isLoading, error, refresh };
}

/**
 * In-flight requests by query signature. A mount can run twice (React
 * remounts effects), so the second subscription joins the first request
 * instead of aborting it and paying for an identical round trip.
 */
const inflight = new Map<string, Promise<SourceResult>>();

function loadSource(
    kind: ClientSourceKind,
    dealerId: number,
    params: { search: string; page: number; limit: number; contact: "with" | "missing" | "all" },
): Promise<SourceResult> {
    const key = `${kind}|${dealerId}|${params.search}|${params.page}|${params.limit}|${params.contact}`;
    const existing = inflight.get(key);
    if (existing) return existing;
    const paging = {
        search: params.search,
        page: params.page,
        limit: params.limit,
        ...(params.contact === "all" ? {} : { contact: params.contact as "with" | "missing" }),
    };
    const request = (
        kind === "customer"
            ? fetchCustomerSource(dealerId, paging)
            : fetchProspectingSource(dealerId, paging)
    ).finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
    });
    inflight.set(key, request);
    return request;
}

/**
 * One client-scoped source table. `dealerId` is the numeric registry id —
 * pass null before a client is picked and nothing fetches. The caller
 * debounces `search`; every change here is already a settled query. Rows are
 * kept during a refetch (stale-while-revalidate): only the first load blanks
 * the table. Branch the UI on `result.status` (`ok` | `empty` | `unavailable`).
 */
export function useClientSource(
    kind: ClientSourceKind,
    dealerId: number | null,
    search = "",
    page = 1,
    pageSize = SOURCE_PAGE_SIZE,
    contact: "with" | "missing" | "all" = "all",
) {
    const [result, setResult] = useState<SourceResult | null>(null);
    const [isLoading, setIsLoading] = useState(dealerId !== null);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const refresh = useCallback(async (): Promise<void> => {
        if (dealerId === null) {
            setResult(null);
            setIsLoading(false);
            return;
        }
        const id = (requestId.current += 1);
        setIsLoading(true);
        setError(null);
        try {
            const next = await loadSource(kind, dealerId, { search, page, limit: pageSize, contact });
            if (requestId.current !== id) return;
            setResult(next);
        } catch (err) {
            if (requestId.current !== id) return;
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load sources", { description: message });
        } finally {
            if (requestId.current === id) setIsLoading(false);
        }
    }, [kind, dealerId, search, page, pageSize, contact]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { result, isLoading, error, refresh };
}

/** In-flight referral requests by query signature — same join-instead-of-abort shape. */
const referralInflight = new Map<string, Promise<SourceResult>>();

/**
 * One server-paged window of website registrants. Unlike the client-scoped
 * tabs this is global (no dealerId), narrowed by `account_status` instead of
 * contact completeness. Rows stay during a refetch; branch on
 * `result.status` (`ok` | `empty` | `unavailable`).
 */
export function useReferralAccounts(
    search = "",
    status = "all",
    page = 1,
    pageSize = SOURCE_PAGE_SIZE,
    websiteId: number | null = null,
) {
    const [result, setResult] = useState<SourceResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const refresh = useCallback(async (): Promise<void> => {
        const id = (requestId.current += 1);
        setIsLoading(true);
        setError(null);
        try {
            const key = `referrals|${search}|${status}|${page}|${pageSize}|${websiteId ?? "all"}`;
            const existing = referralInflight.get(key);
            const request =
                existing ??
                fetchReferralAccounts({
                    search,
                    page,
                    limit: pageSize,
                    ...(status === "all" ? {} : { status }),
                    ...(websiteId !== null ? { websiteId } : {}),
                }).finally(() => {
                    if (referralInflight.get(key) === request) referralInflight.delete(key);
                });
            if (!existing) referralInflight.set(key, request);
            const next = await request;
            if (requestId.current !== id) return;
            setResult(next);
        } catch (err) {
            if (requestId.current !== id) return;
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load referral accounts", { description: message });
        } finally {
            if (requestId.current === id) setIsLoading(false);
        }
    }, [search, status, page, pageSize, websiteId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { result, isLoading, error, refresh };
}

/**
 * Active referral websites for the referral tab's website filter. Loads once
 * on mount; a catalogue failure resolves to [] so the toolbar keeps only
 * "All websites" instead of breaking.
 */
export function useWebsites() {
    const [websites, setWebsites] = useState<WebsiteOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setIsLoading(true);
            try {
                const sites = await fetchWebsites();
                if (!cancelled) setWebsites(sites);
            } catch {
                if (!cancelled) setWebsites([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    return { websites, isLoading };
}
