"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from "../types/leaderboard.schema";

/**
 * Segmented 7 / 30 / 90-day control. The active pill slides between options
 * via a shared layoutId (position = selected period); each option is a native
 * button with aria-pressed, so keyboard support is free.
 */
export function PeriodSegmentedControl({
  value,
  onChange,
}: {
  value: LeaderboardPeriod;
  onChange: (period: LeaderboardPeriod) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Leaderboard period"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5"
    >
      {LEADERBOARD_PERIODS.map((period) => {
        const active = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            aria-label={`Last ${period} days`}
            onClick={() => {
              if (!active) onChange(period);
            }}
            className={cn(
              "relative rounded-full px-3 py-1 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="leaderboard-period-pill"
                className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            ) : null}
            <span className="relative z-10">{period}d</span>
          </button>
        );
      })}
    </div>
  );
}
