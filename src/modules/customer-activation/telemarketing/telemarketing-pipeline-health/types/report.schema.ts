import { z } from "zod";

/**
 * Report pipeline-health contracts — self-contained, never import from
 * sibling lanes or parent telemarketing folders. Tables are read-only:
 * `telemarketing_stage`, `telemarketing_lead`, `telemarketing_activity`.
 *
 * Period contract (current lane): `period` (7 | 30 | 90) is the single
 * window/threshold control — a lead is stuck when its anchor
 * (`last_activity_at`, fallback `created_at`) is older than `period` days,
 * and previous-period comparisons use the equally long window ending where
 * the current one begins.
 *
 * Backward-compat notes (pre-period UI lane + API route still reference
 * these, so tsc stays green until that lane migrates):
 * - `STUCK_DAY_OPTIONS` is kept as an alias of `PERIOD_OPTIONS`.
 * - `ReportFilterSchema.stuckDays` is an optional legacy alias; `period`
 *   wins when both are present.
 * - `HealthTotals.active` aliases `open`; `HealthTotals.conversionRate`
 *   is retained but deprecated.
 * - `PipelineHealth.stuckDays` aliases `period`.
 */

/** The only supported windows/thresholds (days). */
export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type Period = (typeof PERIOD_OPTIONS)[number];

/** @deprecated pre-period name — kept so the current dashboard compiles; same values as PERIOD_OPTIONS. */
export const STUCK_DAY_OPTIONS: readonly number[] = PERIOD_OPTIONS;

export const ReportFilterSchema = z.object({
  period: z.coerce
    .number()
    .int()
    .refine((v) => (PERIOD_OPTIONS as readonly number[]).includes(v), {
      message: "period must be one of 7, 30, 90",
    })
    .default(7),
  /** @deprecated legacy alias for `period` — accepted without validation so old callers keep compiling. */
  stuckDays: z.coerce.number().int().optional(),
});
export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const StageHealthSchema = z.object({
  stage_id: z.number().int(),
  stage_code: z.string(),
  stage_name: z.string(),
  stage_order: z.number().int(),
  /** True for Closed Won / Closed Lost — closed stages are not work. */
  isTerminal: z.boolean(),
  leadCount: z.number().int().nonnegative(),
  share: z.number().nonnegative(),
  avgDaysInStage: z.number().nonnegative(),
  oldestAgeDays: z.number().nonnegative(),
});
export type StageHealth = z.infer<typeof StageHealthSchema>;

export const StuckLeadSchema = z.object({
  lead_id: z.number().int(),
  lead_code: z.string(),
  company_name: z.string(),
  contact_name: z.string().nullable().optional(),
  stage_id: z.number().int(),
  stage_name: z.string(),
  lastActivityAt: z.string().nullable().optional(),
  daysStuck: z.number().nonnegative(),
});
export type StuckLead = z.infer<typeof StuckLeadSchema>;

export const HealthTotalsSchema = z.object({
  open: z.number().int().nonnegative(),
  /** @deprecated alias of `open` — kept for the pre-period dashboard. */
  active: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** @deprecated retained for the pre-period dashboard; prefer deltas/insights. */
  conversionRate: z.number().nonnegative(),
});
export type HealthTotals = z.infer<typeof HealthTotalsSchema>;

export const HealthDeltasSchema = z.object({
  /** Percent change in stuck vs the previous equal-length window; null when previous is 0/missing. */
  stuck: z.number().nullable(),
  /** Percent change in median age vs previous; null when previous is 0/missing. */
  medianAge: z.number().nullable(),
  /** Percent change in stalled-stage count vs previous; null when previous is 0/missing. */
  stalledStages: z.number().nullable(),
  /** Deliberately null: open is a stock figure with no historical snapshot — a derived percent would be a different metric wearing the wrong label. */
  open: z.null(),
});
export type HealthDeltas = z.infer<typeof HealthDeltasSchema>;

export const HealthInsightSchema = z.object({
  id: z.enum(["flow", "speed", "stalled"]),
  tone: z.enum(["success", "warning", "info", "destructive"]),
  title: z.string(),
  detail: z.string(),
});
export type HealthInsight = z.infer<typeof HealthInsightSchema>;

export const PipelineHealthSchema = z.object({
  /** Active window/threshold in days (7 | 30 | 90). */
  period: z.number().int(),
  stages: z.array(StageHealthSchema),
  stuck: z.array(StuckLeadSchema),
  /** Exact DB-level count of stuck leads; `stuck` is only the top slice. */
  stuckTotal: z.number().int().nonnegative(),
  totals: HealthTotalsSchema,
  deltas: HealthDeltasSchema,
  /** Median anchor age (days) across sampled open leads. */
  medianAgeDays: z.number().nonnegative(),
  /** Open stages whose oldest sampled lead is older than `period` days. */
  stalledStages: z.number().int().nonnegative(),
  insights: z.array(HealthInsightSchema),
  /** @deprecated alias of `period` — kept for the pre-period dashboard. */
  stuckDays: z.number().int(),
});
export type PipelineHealth = z.infer<typeof PipelineHealthSchema>;
