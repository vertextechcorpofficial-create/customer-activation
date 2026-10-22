"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getLeaderboard } from "../providers/leaderboard-provider";
import type { LeaderboardPeriod, LeaderboardRange, LeaderboardRow } from "../types/leaderboard.schema";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Gamified agent leaderboard state for a rolling window. */
export function useLeaderboard(period: LeaderboardPeriod = 30) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [range, setRange] = useState<LeaderboardRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard(period);
      setRows(data.rows);
      setRange(data.range);
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load the leaderboard", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, range, period, isLoading, error, refresh };
}
