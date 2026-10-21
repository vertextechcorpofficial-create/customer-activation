"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getLeaderboard } from "../providers/leaderboard-provider";
import type { LeaderboardRow } from "../types/leaderboard.schema";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Month-to-date agent leaderboard state. */
export function useLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await getLeaderboard());
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load the leaderboard", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, isLoading, error, refresh };
}
