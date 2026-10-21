"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PerUserReport, ReportPeriod } from "../types/report.schema";
import { fetchPerUserReport } from "../providers/per-user-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

/** Per-user telemarketing metrics for a selectable period. */
export function usePerUserReport(initialPeriod: ReportPeriod = "mtd") {
    const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
    const [report, setReport] = useState<PerUserReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setReport(await fetchPerUserReport(period));
        } catch (err) {
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load per-user report", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { report, rows: report?.rows ?? [], period, setPeriod, isLoading, error, refresh };
}
