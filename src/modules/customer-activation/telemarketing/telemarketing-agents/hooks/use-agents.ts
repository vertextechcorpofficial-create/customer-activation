"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgentCreate, AgentUpdate } from "../types/agent.schema";
import type { AgentView } from "../services/agent-service";
import {
    deactivateAgent as apiDeactivateAgent,
    getAgentsPage,
    registerAgent as apiRegisterAgent,
    updateAgent as apiUpdateAgent,
    type AgentStatusFilter,
} from "../providers/agent-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useAgents(params: { page: number; limit: number; search?: string; status?: AgentStatusFilter }) {
    const { page, limit, search, status } = params;
    const [agents, setAgents] = useState<AgentView[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good page if it fails. */
    const sync = useCallback(async () => {
        try {
            const result = await getAgentsPage({ page, limit, search, status });
            setAgents(result.items);
            setTotal(result.total);
            setError(null);
        } catch {
            // the write already succeeded — keep the page we have
        }
    }, [page, limit, search, status]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAgentsPage({ page, limit, search, status });
            setAgents(result.items);
            setTotal(result.total);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search, status]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const registerAgent = useCallback(
        async (input: AgentCreate): Promise<boolean> => {
            try {
                await apiRegisterAgent(input);
                toast.success("Agent registered");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to register agent", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateAgent = useCallback(
        async (agentId: number, input: AgentUpdate): Promise<boolean> => {
            try {
                await apiUpdateAgent(agentId, input);
                toast.success("Agent updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update agent", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const deactivateAgent = useCallback(
        async (agentId: number): Promise<boolean> => {
            try {
                await apiDeactivateAgent(agentId);
                toast.success("Agent deactivated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to deactivate agent", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    return { agents, total, isLoading, error, refresh, registerAgent, updateAgent, deactivateAgent };
}
