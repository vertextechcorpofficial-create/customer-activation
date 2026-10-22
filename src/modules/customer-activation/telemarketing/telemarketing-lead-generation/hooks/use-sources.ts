"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SOURCE_PAGE_SIZE, type ClientOption, type SourceResult } from "../types/lead.schema";
import { fetchClients, fetchCustomerSource, fetchProspectingSource } from "../providers/source-provider";

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
) {
    const [result, setResult] = useState<SourceResult | null>(null);
    const [isLoading, setIsLoading] = useState(dealerId !== null);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);
    const pendingCancel = useRef<(() => void) | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        if (dealerId === null) {
            setResult(null);
            setIsLoading(false);
            return;
        }
        const id = (requestId.current += 1);
        pendingCancel.current?.();
        const controller = new AbortController();
        const signal = controller.signal;
        pendingCancel.current = () => controller.abort();
        setIsLoading(true);
        setError(null);
        try {
            const params = { search, page, limit: pageSize };
            const next =
                kind === "customer"
                    ? await fetchCustomerSource(dealerId, params, signal)
                    : await fetchProspectingSource(dealerId, params, signal);
            if (requestId.current !== id || signal.aborted) return;
            setResult(next);
        } catch (err) {
            if (isAbort(err) || requestId.current !== id) return;
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load sources", { description: message });
        } finally {
            if (requestId.current === id && !signal.aborted) setIsLoading(false);
        }
    }, [kind, dealerId, search, page, pageSize]);

    useEffect(() => {
        void refresh();
        return () => pendingCancel.current?.();
    }, [refresh]);

    return { result, isLoading, error, refresh };
}
