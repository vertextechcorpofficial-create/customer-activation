"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetRegistrationRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type {
    AssetGroup,
    AssetTag,
    CreateAssetItemInput,
    UpdateAssetItemInput,
} from "../types/asset-registration.schema";
import type { EnrichedAssetItem } from "../services/asset-registration-service";

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

export interface AssetItemFormValues extends CreateAssetItemInput {
    tag_ids: number[];
}

export function useAssetItems() {
    const [items, setItems] = useState<EnrichedAssetItem[]>([]);
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [tags, setTags] = useState<AssetTag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async () => {
        try {
            setItems(await request<EnrichedAssetItem[]>(assetRegistrationRoutes.items));
            setError(null);
        } catch {
            // The write already succeeded — keep the last good list.
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedItems, catalogs] = await Promise.all([
                request<EnrichedAssetItem[]>(assetRegistrationRoutes.items),
                request<{ groups: AssetGroup[]; tags: AssetTag[] }>(assetRegistrationRoutes.catalogs),
            ]);
            setItems(fetchedItems);
            setGroups(catalogs.groups);
            setTags(catalogs.tags);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createItem = useCallback(
        async (values: AssetItemFormValues): Promise<boolean> => {
            try {
                await request(assetRegistrationRoutes.items, {
                    method: "POST",
                    body: JSON.stringify(values),
                });
                toast.success("Asset registered");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to register asset", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateItem = useCallback(
        async (id: number, input: UpdateAssetItemInput): Promise<boolean> => {
            try {
                await request(assetRegistrationRoutes.item(id), {
                    method: "PATCH",
                    body: JSON.stringify(input),
                });
                toast.success("Asset updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update asset", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const saveItemTags = useCallback(
        async (id: number, tagIds: number[]): Promise<boolean> => {
            try {
                await request(assetRegistrationRoutes.itemTags(id), {
                    method: "PUT",
                    body: JSON.stringify({ tag_ids: tagIds }),
                });
                toast.success("Asset tags updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update tags", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    return { items, groups, tags, isLoading, error, refresh, createItem, updateItem, saveItemTags };
}
