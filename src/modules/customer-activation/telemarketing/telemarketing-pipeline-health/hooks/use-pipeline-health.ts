"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PipelineHealth } from "../types/report.schema";
import { fetchPipelineHealth } from "../providers/health-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function usePipelineHealth(period = 7) {
  const [data, setData] = useState<PipelineHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchPipelineHealth(period));
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load pipeline health", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
