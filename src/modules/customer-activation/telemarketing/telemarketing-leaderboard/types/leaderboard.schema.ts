import { z } from "zod";

/**
 * User-leaderboard lane contracts — self-contained.
 * Never import from sibling module folders (types only; the service layer
 * owns the one sanctioned exception: conversion attribution, see
 * services/leaderboard-service.ts).
 *
 * Gamified contract: a rolling `period` window (days, Asia/Manila wall
 * clock) plus the same-length window immediately before it, so the UI lane
 * can render score deltas, momentum badges, rank movement and streaks.
 */

export const LeaderboardPeriodSchema = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodSchema>;

export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = [7, 30, 90] as const;

export function parseLeaderboardPeriod(value: unknown): LeaderboardPeriod {
  const parsed = LeaderboardPeriodSchema.safeParse(
    typeof value === "string" && value.trim() !== "" ? Number(value) : value,
  );
  if (!parsed.success) {
    throw new Error(
      `Invalid leaderboard period: expected one of 7, 30, 90 (days), received ${JSON.stringify(value) ?? "nothing"}.`,
    );
  }
  return parsed.data;
}

export const LeaderboardMomentumSchema = z.enum([
  "accelerating",
  "cooling",
  "steady",
  "new",
]);
export type LeaderboardMomentum = z.infer<typeof LeaderboardMomentumSchema>;

export const LeaderboardBreakdownSchema = z.object({
  call: z.number().int().nonnegative(),
  email: z.number().int().nonnegative(),
  visit: z.number().int().nonnegative(),
  meeting: z.number().int().nonnegative(),
});
export type LeaderboardBreakdown = z.infer<typeof LeaderboardBreakdownSchema>;

export const LeaderboardRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});
export type LeaderboardRange = z.infer<typeof LeaderboardRangeSchema>;

export const LeaderboardRowSchema = z.object({
  agent_id: z.number().int(),
  display_name: z.string().min(1),
  /** Legacy alias of display_name — pre-contract components read `name`. */
  name: z.string().min(1),
  agent_code: z.string(),
  score: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  qualified: z.number().int().nonnegative(),
  activities: z.number().int().nonnegative(),
  breakdown: LeaderboardBreakdownSchema,
  previous_score: z.number().int().nonnegative(),
  /** Null when previous_score === 0 (no baseline to divide by). */
  score_delta_pct: z.number().nullable(),
  momentum: LeaderboardMomentumSchema,
  rank: z.number().int().positive(),
  /** Null when the agent had no score in the previous window. */
  previous_rank: z.number().int().positive().nullable(),
  /** previous_rank - rank. + moved up, - moved down, 0 unchanged or no baseline. */
  rank_delta: z.number().int(),
  /** Consecutive Manila days with >=1 real (non-note) activity, capped at period. */
  streak_days: z.number().int().nonnegative(),
  /** Latest non-note activity in the current window, null when there is none. */
  last_activity_at: z.string().nullable(),
});

export const LeaderboardSchema = z.array(LeaderboardRowSchema);

export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

export const LeaderboardDataSchema = z.object({
  period: LeaderboardPeriodSchema,
  range: LeaderboardRangeSchema,
  rows: LeaderboardSchema,
});
export type LeaderboardData = z.infer<typeof LeaderboardDataSchema>;
