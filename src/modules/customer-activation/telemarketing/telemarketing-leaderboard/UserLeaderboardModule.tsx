"use client";

import { LeaderboardTable } from "./components/leaderboard-table";

export function UserLeaderboardModule() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Agent leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Month-to-date agent ranking by conversions, qualified leads and logged activities.
        </p>
      </div>
      <LeaderboardTable />
    </div>
  );
}
