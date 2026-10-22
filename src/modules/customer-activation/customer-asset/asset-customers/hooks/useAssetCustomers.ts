"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

import { assetCustomersRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { CustomerListPage, CustomerListRow } from "../services/asset-customers-service";

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

export type CustomerStatusFilter = "all" | "active" | "inactive";

interface AssetCustomerFilters {
    q: string;
    status: CustomerStatusFilter;
    onlyWithAssets: boolean;
    page: number;
    pageSize: number;
}

export function useAssetCustomers() {
    // Immediate input value (every keystroke); the fetch key `filters.q`
    // is the debounced/trimmed form. All fetch-relevant state lives in the
    // single atomic `filters` object so a filter change and its page reset
    // commit in one update → one fetch, no (new filter, old page) request.
    const [queryInput, setQueryInput] = useState("");
    const [filters, setFilters] = useState<AssetCustomerFilters>({
        q: "",
        status: "all",
        onlyWithAssets: false,
        page: 0,
        pageSize: 10,
    });
    const [customers, setCustomers] = useState<CustomerListRow[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const requestIdRef = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => {
            const trimmed = queryInput.trim();
            setFilters((prev) => (prev.q === trimmed ? prev : { ...prev, q: trimmed, page: 0 }));
        }, 300);
        return () => clearTimeout(t);
    }, [queryInput]);

    useEffect(() => {
        const id = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);
        void (async () => {
            try {
                const params = new URLSearchParams();
                if (filters.q) params.set("q", filters.q);
                if (filters.onlyWithAssets) params.set("withAssets", "1");
                if (filters.status !== "all") params.set("status", filters.status);
                params.set("page", String(filters.page));
                params.set("pageSize", String(filters.pageSize));
                const data = await request<CustomerListPage | CustomerListRow[]>(
                    `${assetCustomersRoutes.customers}?${params.toString()}`,
                );
                if (requestIdRef.current !== id) return;
                // Tolerate the legacy array envelope during rollout.
                const pageData: CustomerListPage = Array.isArray(data)
                    ? { rows: data, total: data.length }
                    : data;
                if (pageData.rows.length === 0 && filters.page > 0) {
                    // Filtering can empty the current page — jump straight to
                    // the last page that can hold data, using returned total.
                    const lastPage = Math.max(0, Math.ceil(pageData.total / filters.pageSize) - 1);
                    setFilters((prev) => (prev.page === lastPage ? prev : { ...prev, page: lastPage }));
                    return;
                }
                setCustomers(pageData.rows);
                setTotal(pageData.total);
            } catch (err) {
                if (requestIdRef.current !== id) return;
                setError(toMessage(err));
            } finally {
                if (requestIdRef.current === id) setIsLoading(false);
            }
        })();
    }, [filters, refreshTick]);

    const setQuery = useCallback((value: SetStateAction<string>) => {
        setQueryInput(value);
    }, []);

    const setStatus = useCallback((value: SetStateAction<CustomerStatusFilter>) => {
        setFilters((prev) => {
            const next = typeof value === "function" ? (value as (p: CustomerStatusFilter) => CustomerStatusFilter)(prev.status) : value;
            return next === prev.status ? prev : { ...prev, status: next, page: 0 };
        });
    }, []);

    const setOnlyWithAssets = useCallback((value: SetStateAction<boolean>) => {
        setFilters((prev) => {
            const next = typeof value === "function" ? (value as (p: boolean) => boolean)(prev.onlyWithAssets) : value;
            return next === prev.onlyWithAssets ? prev : { ...prev, onlyWithAssets: next, page: 0 };
        });
    }, []);

    const setPage = useCallback((value: SetStateAction<number>) => {
        setFilters((prev) => {
            const next = typeof value === "function" ? (value as (p: number) => number)(prev.page) : value;
            const clamped = Math.max(0, next);
            return clamped === prev.page ? prev : { ...prev, page: clamped };
        });
    }, []);

    const setPageSize = useCallback((value: SetStateAction<number>) => {
        setFilters((prev) => {
            const next = typeof value === "function" ? (value as (p: number) => number)(prev.pageSize) : value;
            return next === prev.pageSize ? prev : { ...prev, pageSize: next };
        });
    }, []);

    const refresh = useCallback(() => {
        setRefreshTick((t) => t + 1);
    }, []);

    const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

    const onPaginationChange = useCallback(
        ({ pageIndex, pageSize: nextSize }: { pageIndex: number; pageSize: number }) => {
            setFilters((prev) => {
                if (nextSize !== prev.pageSize) {
                    // Rows-per-page changed — restart from the first page.
                    return { ...prev, pageSize: nextSize, page: 0 };
                }
                return pageIndex === prev.page ? prev : { ...prev, page: pageIndex };
            });
        },
        [],
    );

    return {
        query: queryInput,
        setQuery,
        onlyWithAssets: filters.onlyWithAssets,
        setOnlyWithAssets,
        status: filters.status,
        setStatus,
        page: filters.page,
        setPage,
        pageSize: filters.pageSize,
        setPageSize,
        total,
        pageCount,
        pagination: { pageIndex: filters.page, pageSize: filters.pageSize },
        onPaginationChange,
        customers,
        isLoading,
        error,
        refresh,
    };
}
