"use client";

import { LeaderboardTable } from "./components/leaderboard-table";

export function UserLeaderboardModule() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-xs text-muted-foreground">Month to date · Asia/Manila</p>
      </div>
      <LeaderboardTable />
    </div>
  );
}
