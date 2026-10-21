"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Lead, LeadCreate } from "../types/lead.schema";
import { createLead as apiCreate, fetchLeads, type LeadListData, type LeadListParams } from "../providers/lead-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useLeads(params: LeadListParams = {}) {
    const [data, setData] = useState<LeadListData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const key = JSON.stringify(params);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchLeads(JSON.parse(key) as LeadListParams));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [key]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const create = useCallback(
        async (input: LeadCreate): Promise<Lead | null> => {
            try {
                const outcome = await apiCreate(input);
                if (outcome.duplicate) {
                    toast.error("Duplicate lead", {
                        description: outcome.matched.label
                            ? `Matches ${outcome.matched.label} (${outcome.matched.table})`
                            : "This contact already exists",
                    });
                    return null;
                }
                toast.success(`Lead ${outcome.lead.lead_code} created`);
                await refresh();
                return outcome.lead;
            } catch (err) {
                toast.error("Failed to create lead", { description: toMessage(err) });
                return null;
            }
        },
        [refresh],
    );

    return {
        items: data?.items ?? [],
        meta: data?.meta ?? { total: 0, page: 1, limit: 20 },
        isLoading,
        error,
        refresh,
        create,
    };
}
