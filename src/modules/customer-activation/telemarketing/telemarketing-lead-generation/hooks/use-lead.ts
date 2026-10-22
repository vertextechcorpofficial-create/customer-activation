"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Lead, LeadUpdate } from "../types/lead.schema";
import { fetchLead, updateLead as apiUpdate } from "../providers/lead-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useLead(leadId: number | null) {
    const [lead, setLead] = useState<Lead | null>(null);
    const [isLoading, setIsLoading] = useState(leadId !== null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        if (leadId === null) {
            setLead(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            setLead(await fetchLead(leadId));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [leadId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const update = useCallback(
        async (input: LeadUpdate): Promise<Lead | null> => {
            if (leadId === null) return null;
            try {
                const next = await apiUpdate(leadId, input);
                setLead(next);
                toast.success("Lead updated");
                return next;
            } catch (err) {
                toast.error("Failed to update lead", { description: toMessage(err) });
                return null;
            }
        },
        [leadId],
    );

    return { lead, isLoading, error, refresh, update };
}
