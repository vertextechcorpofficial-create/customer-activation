"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetReportsRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type {
    CustomerAssetRow,
    LastPurchaseRow,
    ValuationRow,
} from "../types/asset-reports.schema";

export type AssetReportTab = "last-purchase" | "customer-assets" | "valuation";

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
    return new Date().toISOString().slice(0, 10);
}

export function useAssetReports() {
    const [tab, setTabState] = useState<AssetReportTab>("last-purchase");
    const [asOf, setAsOf] = useState<string>(todayIso);
    const [lastPurchase, setLastPurchase] = useState<LastPurchaseRow[]>([]);
    const [customerAssets, setCustomerAssets] = useState<CustomerAssetRow[]>([]);
    const [valuation, setValuation] = useState<ValuationRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<Record<AssetReportTab, boolean>>({
        "last-purchase": false,
        "customer-assets": false,
        valuation: false,
    });
    const [loadedAsOf, setLoadedAsOf] = useState<string | null>(null);

    const load = useCallback(
        async (target: AssetReportTab, date: string, force = false) => {
            const isValuation = target === "valuation";
            if (!force && loaded[target] && (!isValuation || loadedAsOf === date)) return;
            setIsLoading(true);
            setError(null);
            try {
                if (target === "last-purchase") {
                    setLastPurchase(await request<LastPurchaseRow[]>(assetReportsRoutes.lastPurchase));
                } else if (target === "customer-assets") {
                    setCustomerAssets(await request<CustomerAssetRow[]>(assetReportsRoutes.customerAssets));
                } else {
                    setValuation(
                        await request<ValuationRow[]>(
                            `${assetReportsRoutes.valuation}?asOf=${encodeURIComponent(date)}`,
                        ),
                    );
                    setLoadedAsOf(date);
                }
                setLoaded((prev) => ({ ...prev, [target]: true }));
            } catch (err) {
                const message = toMessage(err);
                setError(message);
                toast.error("Failed to load report", { description: message });
            } finally {
                setIsLoading(false);
            }
        },
        [loaded, loadedAsOf],
    );

    useEffect(() => {
        void load(tab, asOf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, asOf]);

    const setTab = useCallback((next: AssetReportTab) => {
        setTabState(next);
        setError(null);
    }, []);

    const refresh = useCallback(() => {
        void load(tab, asOf, true);
    }, [load, tab, asOf]);

    return { tab, setTab, asOf, setAsOf, lastPurchase, customerAssets, valuation, isLoading, error, refresh };
}
