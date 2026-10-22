"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ClaimsView } from "../services/claim-service";
import { claimLead, getClaims, releaseLead } from "../providers/claim-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Claimants for one lead, plus claim/release for the signed-in agent. */
export function useClaims(leadId: number) {
  const [view, setView] = useState<ClaimsView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setView(await getClaims(leadId));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claim = useCallback(async (): Promise<boolean> => {
    try {
      await claimLead(leadId);
      toast.success("Lead claimed");
      await refresh();
      return true;
    } catch (err) {
      toast.error("Failed to claim lead", { description: toMessage(err) });
      return false;
    }
  }, [leadId, refresh]);

  const release = useCallback(async (): Promise<boolean> => {
    try {
      await releaseLead(leadId);
      toast.success("Claim released");
      await refresh();
      return true;
    } catch (err) {
      toast.error("Failed to release claim", { description: toMessage(err) });
      return false;
    }
  }, [leadId, refresh]);

  return {
    agentId: view?.agent_id ?? null,
    claimants: (view?.claimants ?? []).filter((c) => c.released_at == null),
    isLoading,
    error,
    refresh,
    claim,
    release,
  };
}
