"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PoolResult } from "../services/claim-service";
import { claimLead, getPool, releaseLead } from "../providers/claim-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Lead pool: non-terminal leads with the caller's claim state. */
export function usePool(page = 1, limit = 10) {
  const [pool, setPool] = useState<PoolResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPool(await getPool(page, limit));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claim = useCallback(
    async (leadId: number): Promise<boolean> => {
      try {
        await claimLead(leadId);
        toast.success("Lead claimed");
        await refresh();
        return true;
      } catch (err) {
        toast.error("Failed to claim lead", { description: toMessage(err) });
        return false;
      }
    },
    [refresh],
  );

  const release = useCallback(
    async (leadId: number): Promise<boolean> => {
      try {
        await releaseLead(leadId);
        toast.success("Claim released");
        await refresh();
        return true;
      } catch (err) {
        toast.error("Failed to release claim", { description: toMessage(err) });
        return false;
      }
    },
    [refresh],
  );

  return {
    items: pool?.items ?? [],
    meta: pool?.meta ?? { total: 0, page, limit },
    isLoading,
    error,
    refresh,
    claim,
    release,
  };
}
