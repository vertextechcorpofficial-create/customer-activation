"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgentCreate, AgentUpdate } from "../types/agent.schema";
import type { AgentView } from "../services/agent-service";
import {
    deactivateAgent as apiDeactivateAgent,
    getAgents,
    registerAgent as apiRegisterAgent,
    updateAgent as apiUpdateAgent,
} from "../providers/agent-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useAgents() {
    const [agents, setAgents] = useState<AgentView[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good list if it fails. */
    const sync = useCallback(async () => {
        try {
            setAgents(await getAgents());
            setError(null);
        } catch {
            // the write already succeeded — keep the list we have
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setAgents(await getAgents());
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    return { agents, isLoading, error, refresh, registerAgent, updateAgent, deactivateAgent };
}
