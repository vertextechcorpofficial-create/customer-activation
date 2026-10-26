"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetTaggingRemarksRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { CreateTaggingInput, ReturnTaggingInput } from "../types/asset-tagging-remarks.schema";
import type {
    AssignmentView,
    AvailableItem,
    CustomerOption,
} from "../types/asset-tagging-remarks.view";

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

export function useAssignments(customerId: number | null = null) {
    const [assignments, setAssignments] = useState<AssignmentView[]>([]);
    const [items, setItems] = useState<AvailableItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const listUrl = customerId
        ? `${assetTaggingRemarksRoutes.taggings}?customerId=${customerId}`
        : assetTaggingRemarksRoutes.taggings;

    const sync = useCallback(async () => {
        try {
            const [nextAssignments, nextItems] = await Promise.all([
                request<AssignmentView[]>(listUrl),
                request<AvailableItem[]>(assetTaggingRemarksRoutes.items),
            ]);
            setAssignments(nextAssignments);
            setItems(nextItems);
            setError(null);
        } catch {
            // The write already succeeded — keep the last good lists.
        }
    }, [listUrl]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [nextAssignments, nextItems] = await Promise.all([
                request<AssignmentView[]>(listUrl),
                request<AvailableItem[]>(assetTaggingRemarksRoutes.items),
            ]);
            setAssignments(nextAssignments);
            setItems(nextItems);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [listUrl]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const searchCustomers = useCallback(async (query: string): Promise<CustomerOption[]> => {
        const q = query.trim();
        if (!q) return [];
        try {
            return await request<CustomerOption[]>(
                `${assetTaggingRemarksRoutes.customers}?q=${encodeURIComponent(q)}`,
            );
        } catch {
            return [];
        }
    }, []);

    const listAllCustomers = useCallback(async (): Promise<CustomerOption[]> => {
        return await request<CustomerOption[]>(`${assetTaggingRemarksRoutes.customers}?all=1`);
    }, []);

    const assign = useCallback(
        async (input: CreateTaggingInput): Promise<boolean> => {
            try {
                await request(assetTaggingRemarksRoutes.taggings, {
                    method: "POST",
                    body: JSON.stringify(input),
                });
                toast.success("Asset tagged to customer");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to tag asset", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const returnItems = useCallback(
        async (id: number, input: ReturnTaggingInput): Promise<boolean> => {
            try {
                await request(assetTaggingRemarksRoutes.tagging(id), {
                    method: "PATCH",
                    body: JSON.stringify(input),
                });
                toast.success("Return recorded");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to record return", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    return { assignments, items, isLoading, error, refresh, searchCustomers, listAllCustomers, assign, returnItems };
}
