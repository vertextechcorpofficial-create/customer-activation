"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "../types/leaderboard.schema";

const pill =
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums";

/**
 * Rank movement: up = success ▲n, down = destructive ▼n, unchanged = muted
 * dash, no previous baseline = info NEW.
 */
export function RankDeltaBadge({ row }: { row: LeaderboardRow }) {
  if (row.previous_rank === null) {
    return (
      <span
        aria-label="new to the board"
        className={cn(pill, "border-transparent bg-info/15 text-info")}
      >
        NEW
      </span>
    );
  }
  if (row.rank_delta > 0) {
    return (
      <span
        aria-label={`up ${row.rank_delta} ${row.rank_delta === 1 ? "rank" : "ranks"}`}
        className={cn(pill, "border-transparent bg-success/15 text-success")}
      >
        <span aria-hidden>▲</span> {row.rank_delta}
      </span>
    );
  }
  if (row.rank_delta < 0) {
    const abs = Math.abs(row.rank_delta);
    return (
      <span
        aria-label={`down ${abs} ${abs === 1 ? "rank" : "ranks"}`}
        className={cn(pill, "border-transparent bg-destructive/15 text-destructive")}
      >
        <span aria-hidden>▼</span> {abs}
      </span>
    );
  }
  return (
    <span
      aria-label="rank unchanged"
      className={cn(pill, "border bg-muted text-muted-foreground")}
    >
      <span aria-hidden>—</span>
    </span>
  );
}

/**
 * Momentum (org convention: accelerating is green, cooling is intentionally
 * grey/non-alarming). Ratio = score / previous_score, one decimal.
 */
export function MomentumBadge({ row }: { row: LeaderboardRow }) {
  const ratio =
    row.previous_score > 0 ? row.score / row.previous_score : null;
  const ratioText = ratio === null ? null : `${ratio.toFixed(1)}×`;
  switch (row.momentum) {
    case "accelerating":
      return (
        <span
          aria-label={
            ratioText === null
              ? "accelerating: no score in the previous period"
              : `accelerating: score ${ratioText} the previous period`
          }
          className={cn(pill, "border-transparent bg-success/15 text-success")}
        >
          <span aria-hidden>↑</span>
          {ratioText ?? "—"}
        </span>
      );
    case "cooling":
      return (
        <span
          aria-label={
            ratioText === null
              ? "cooling: no score in the previous period"
              : `cooling: score ${ratioText} the previous period`
          }
          className={cn(pill, "border bg-muted text-muted-foreground")}
        >
          <span aria-hidden>↓</span>
          {ratioText ?? "—"}
        </span>
      );
    case "steady":
      return (
        <span
          aria-label="steady: within 0.8×–1.5× of the previous period"
          className={cn(pill, "border bg-muted text-muted-foreground")}
        >
          steady
        </span>
      );
    case "new":
      return (
        <span
          aria-label="new: no score in the previous period"
          className={cn(pill, "border-transparent bg-info/15 text-info")}
        >
          new
        </span>
      );
  }
}

/**
 * Streak: rendered only when streak_days > 0 (never "0d"). Tone escalates
 * with length — muted under 3d, warning at 3d+, destructive accent at 7d+.
 */
export function StreakBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <span
      aria-label={`${days} day activity streak`}
      className={cn(
        pill,
        days >= 7
          ? "border-transparent bg-destructive/15 text-destructive"
          : days >= 3
            ? "border-transparent bg-warning/15 text-warning"
            : "border bg-muted text-muted-foreground",
      )}
    >
      <Flame className="size-3" aria-hidden />
      {days}d
    </span>
  );
}
