import { z } from "zod";

/**
 * User-leaderboard lane contracts — self-contained.
 * Never import from sibling module folders.
 */

export const LeaderboardRowSchema = z.object({
  agent_id: z.number().int(),
  name: z.string().min(1),
  score: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  qualified: z.number().int().nonnegative(),
  activities: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
});

export const LeaderboardSchema = z.array(LeaderboardRowSchema);

export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
