"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PoolResult, PoolSort } from "../services/claim-service";
import { claimLead, getPool, releaseLead } from "../providers/claim-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export interface UsePoolParams {
  search?: string;
  stageId?: number;
  sort?: PoolSort;
  page?: number;
  limit?: number;
}

/** Lead pool: non-terminal leads with the caller's claim state. */
export function usePool(params: UsePoolParams = {}) {
  const { search, stageId, sort, page = 1, limit = 10 } = params;
  const [pool, setPool] = useState<PoolResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const key = JSON.stringify({ search: search ?? "", stageId: stageId ?? null, sort: sort ?? null, page, limit });

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const parsed = JSON.parse(key) as UsePoolParams & { page: number; limit: number };
      setPool(
        await getPool(
          {
            search: parsed.search?.trim() ? parsed.search.trim() : undefined,
            stageId: parsed.stageId ?? undefined,
            sort: parsed.sort ?? undefined,
            page: parsed.page,
            limit: parsed.limit,
          },
          controller.signal,
        ),
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(toMessage(err));
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
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
