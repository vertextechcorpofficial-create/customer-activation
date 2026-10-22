"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgentHistory } from "../services/agent-history-service";
import type { ReportPeriod } from "../types/report.schema";
import { fetchAgentHistory } from "../providers/agent-history-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

/** One agent's history for a selectable period. */
export function useAgentHistory(agentId: number, initialPeriod: ReportPeriod = "mtd") {
    const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
    const [history, setHistory] = useState<AgentHistory | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!Number.isInteger(agentId) || agentId <= 0) {
            setError("Invalid agent id");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            setHistory(await fetchAgentHistory(agentId, period));
        } catch (err) {
            const message = toMessage(err);
            setError(message);
            toast.error("Failed to load agent history", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, [agentId, period]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { history, period, setPeriod, isLoading, error, refresh };
}
