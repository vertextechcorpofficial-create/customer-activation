"use client";

import { useCallback, useEffect, useState } from "react";

import { assetRegistrationRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { AssetItemDetail } from "../services/asset-registration-service";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useAssetItem(id: number | null) {
    const [detail, setDetail] = useState<AssetItemDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (id === null) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(assetRegistrationRoutes.item(id), { cache: "no-store" });
            const body = (await res.json().catch(() => null)) as ApiEnvelope<AssetItemDetail> | null;
            if (!res.ok || !body || body.success === false) {
                throw new Error(
                    (body && body.success === false && body.message) || "Could not load the asset.",
                );
            }
            setDetail(body.data);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { detail, isLoading, error, refresh };
}
