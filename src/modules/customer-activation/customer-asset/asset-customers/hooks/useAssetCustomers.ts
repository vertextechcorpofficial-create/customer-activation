"use client";

import { useCallback, useEffect, useState } from "react";

import { assetCustomersRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { CustomerListRow } from "../services/asset-customers-service";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!res.ok || !body || body.success === false) {
        throw new Error(
            (body && body.success === false && body.message) || "Something went wrong. Please try again.",
        );
    }
    return body.data;
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useAssetCustomers() {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [onlyWithAssets, setOnlyWithAssets] = useState(false);
    const [customers, setCustomers] = useState<CustomerListRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(t);
    }, [query]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (onlyWithAssets) params.set("withAssets", "1");
            const qs = params.toString();
            setCustomers(
                await request<CustomerListRow[]>(
                    qs ? `${assetCustomersRoutes.customers}?${qs}` : assetCustomersRoutes.customers,
                ),
            );
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [debouncedQuery, onlyWithAssets]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        query,
        setQuery,
        onlyWithAssets,
        setOnlyWithAssets,
        customers,
        isLoading,
        error,
        refresh: () => void refresh(),
    };
}
