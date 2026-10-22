"use client";

import { useState } from "react";
import { MotionConfig } from "framer-motion";
import { LeaderboardTable } from "./components/leaderboard-table";
import { PeriodSegmentedControl } from "./components/period-segmented-control";
import { useLeaderboard } from "./hooks/use-leaderboard";
import type {
  LeaderboardPeriod,
  LeaderboardRange,
} from "./types/leaderboard.schema";

const rangeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

/** "15 Oct – 22 Oct" from Manila wall-clock stamps ("YYYY-MM-DD HH:mm:ss"). */
function formatRangeShort(range: LeaderboardRange): string {
  const toDate = (stamp: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp);
    if (!match) return null;
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = toDate(range.start);
  const end = toDate(range.end);
  if (!start || !end) return "";
  return `${rangeFormat.format(start)} – ${rangeFormat.format(end)}`;
}

export function UserLeaderboardModule() {
  const [period, setPeriod] = useState<LeaderboardPeriod>(30);
  const { rows, range, isLoading, error, refresh } = useLeaderboard(period);
  const rangeText = range ? formatRangeShort(range) : "";

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">
              Leaderboard
            </h1>
            {rangeText !== "" ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {rangeText}
              </p>
            ) : null}
          </div>
          <PeriodSegmentedControl value={period} onChange={setPeriod} />
        </div>
        <LeaderboardTable
          rows={rows}
          isLoading={isLoading}
          error={error}
          onRetry={() => void refresh()}
        />
      </div>
    </MotionConfig>
  );
}
