"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { assetReportsRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { AssetReportRow } from "../types/asset-reports.schema";

async function request<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
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

function todayIso(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

export function useAssetReports() {
    const [asOf, setAsOf] = useState<string>(todayIso);
    const [rows, setRows] = useState<AssetReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedFor = useRef<string | null>(null);

    const load = useCallback(async (date: string, force = false) => {
        if (!force && loadedFor.current === date) return;
        setIsLoading(true);
        setError(null);
        try {
            setRows(
                await request<AssetReportRow[]>(
                    `${assetReportsRoutes.report}?asOf=${encodeURIComponent(date)}`,
                ),
            );
            loadedFor.current = date;
        } catch (err) {
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load report", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(asOf);
    }, [asOf, load]);

    const setAsOfDate = useCallback((next: string) => {
        setAsOf(next);
        setError(null);
    }, []);

    const refresh = useCallback(() => {
        void load(asOf, true);
    }, [load, asOf]);

    return { rows, isLoading, error, refresh, asOf, setAsOf: setAsOfDate };
}
