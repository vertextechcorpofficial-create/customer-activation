"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { assetGroupsRoutes } from "../routes";
import type {
    AssetGroup,
    CreateAssetGroupInput,
    UpdateAssetGroupInput,
} from "../types/asset-groups.schema";

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: unknown;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) {
        throw new Error(body?.message ?? "Something went wrong. Please try again.");
    }
    return body.data as T;
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useAssetGroups() {
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setGroups(await request<AssetGroup[]>(assetGroupsRoutes.groups));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createGroup = useCallback(async (input: CreateAssetGroupInput): Promise<boolean> => {
        try {
            await request<AssetGroup>(assetGroupsRoutes.groups, { method: "POST", body: JSON.stringify(input) });
            toast.success("Group created");
            await refresh();
            return true;
        } catch (err) {
            toast.error("Failed to create group", { description: toMessage(err) });
            return false;
        }
    }, [refresh]);

    const updateGroup = useCallback(async (id: number, input: UpdateAssetGroupInput): Promise<boolean> => {
        try {
            await request<AssetGroup>(assetGroupsRoutes.group(id), { method: "PATCH", body: JSON.stringify(input) });
            toast.success("Group updated");
            await refresh();
            return true;
        } catch (err) {
            toast.error("Failed to update group", { description: toMessage(err) });
            return false;
        }
    }, [refresh]);

    return { groups, isLoading, error, refresh, createGroup, updateGroup };
}
