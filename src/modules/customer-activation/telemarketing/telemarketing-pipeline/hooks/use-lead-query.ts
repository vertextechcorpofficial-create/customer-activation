"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchLeadPage, type LeadPage, type LeadQueryParams } from "../providers/lead-query-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** A page of leads for the list view — read-only, the pipeline never creates leads. */
export function useLeadQuery(params: LeadQueryParams = {}) {
  const [data, setData] = useState<LeadPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A content key keeps the callbacks stable while the caller passes a fresh object.
  const key = JSON.stringify(params);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchLeadPage(JSON.parse(key) as LeadQueryParams));
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load leads", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items: data?.items ?? [],
    meta: data?.meta ?? { total: 0, page: 1, limit: 20 },
    isLoading,
    error,
    refresh,
  };
}
