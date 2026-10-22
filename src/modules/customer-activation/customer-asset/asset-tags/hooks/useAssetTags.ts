"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetTagsRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type {
    AssetTag,
    CreateAssetTagInput,
    UpdateAssetTagInput,
} from "../types/asset-tags.schema";

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

export function useAssetTags() {
    const [tags, setTags] = useState<AssetTag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async () => {
        try {
            setTags(await request<AssetTag[]>(assetTagsRoutes.tags));
            setError(null);
        } catch {
            // The write already succeeded — keep the last good list.
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setTags(await request<AssetTag[]>(assetTagsRoutes.tags));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createTag = useCallback(
        async (input: CreateAssetTagInput): Promise<boolean> => {
            try {
                await request(assetTagsRoutes.tags, { method: "POST", body: JSON.stringify(input) });
                toast.success("Tag created");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to create tag", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateTag = useCallback(
        async (id: number, input: UpdateAssetTagInput): Promise<boolean> => {
            try {
                await request(assetTagsRoutes.tag(id), {
                    method: "PATCH",
                    body: JSON.stringify(input),
                });
                toast.success("Tag updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update tag", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    return { tags, isLoading, error, refresh, createTag, updateTag };
}
