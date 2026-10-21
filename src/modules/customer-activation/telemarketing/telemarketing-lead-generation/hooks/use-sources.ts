"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SourceRow } from "../types/lead.schema";
import { fetchClientDb, fetchCustomerDb, fetchProspecting } from "../providers/source-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useSources(search = "") {
    const [customerRows, setCustomerRows] = useState<SourceRow[]>([]);
    const [prospectingRows, setProspectingRows] = useState<SourceRow[]>([]);
    const [clientRows, setClientRows] = useState<SourceRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            const [customers, prospects, clients] = await Promise.all([
                fetchCustomerDb(search),
                fetchProspecting(),
                fetchClientDb(search),
            ]);
            setCustomerRows(customers);
            setProspectingRows(prospects);
            setClientRows(clients);
        } catch (err) {
            setError(toMessage(err));
            toast.error("Failed to load sources", { description: toMessage(err) });
        } finally {
            setIsLoading(false);
        }
    }, [search]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { customerRows, prospectingRows, clientRows, isLoading, error, refresh };
}
