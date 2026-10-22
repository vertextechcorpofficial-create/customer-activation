"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetReportsRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { AssetReportDetail } from "../types/asset-reports.schema";

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

export function useAssetReportDetail(id: number) {
    const [detail, setDetail] = useState<AssetReportDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setDetail(await request<AssetReportDetail>(assetReportsRoutes.detail(id)));
        } catch (err) {
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load asset report", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (Number.isInteger(id) && id > 0) void refresh();
    }, [refresh, id]);

    return { detail, isLoading, error, refresh: () => void refresh() };
}
