import { z } from "zod";

/**
 * Report pipeline-health contracts — self-contained, never import from
 * sibling lanes or parent telemarketing folders. Tables are read-only:
 * `telemarketing_stage`, `telemarketing_lead`, `telemarketing_activity`.
 */

export const STUCK_DAY_OPTIONS = [3, 7, 14, 30] as const;

export const ReportFilterSchema = z.object({
  stuckDays: z.coerce
    .number()
    .int()
    .refine((v) => (STUCK_DAY_OPTIONS as readonly number[]).includes(v), {
      message: "stuckDays must be one of 3, 7, 14, 30",
    })
    .default(7),
});
export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const StageHealthSchema = z.object({
  stage_id: z.number().int(),
  stage_code: z.string(),
  stage_name: z.string(),
  stage_order: z.number().int(),
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
  active: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  conversionRate: z.number().nonnegative(),
});
export type HealthTotals = z.infer<typeof HealthTotalsSchema>;

export const PipelineHealthSchema = z.object({
  stages: z.array(StageHealthSchema),
  stuck: z.array(StuckLeadSchema),
  totals: HealthTotalsSchema,
  stuckDays: z.number().int(),
});
export type PipelineHealth = z.infer<typeof PipelineHealthSchema>;
