import { z } from "zod";

/**
 * Per-user report contracts — self-contained, never import from sibling
 * module folders or the legacy telemarketing folders.
 */

export const ReportPeriodSchema = z.enum(["mtd", "last_30", "last_90"]);
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

export const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
    { value: "mtd", label: "Month to date" },
    { value: "last_30", label: "Last 30 days" },
    { value: "last_90", label: "Last 90 days" },
];

export const ActivityKindSchema = z.enum(["call", "email", "visit", "meeting"]);
export type ActivityKind = z.infer<typeof ActivityKindSchema>;

export const KindBreakdownSchema = z.object({
    call: z.number().int().nonnegative(),
    email: z.number().int().nonnegative(),
    visit: z.number().int().nonnegative(),
    meeting: z.number().int().nonnegative(),
});
export type KindBreakdown = z.infer<typeof KindBreakdownSchema>;

export const AgentReportRowSchema = z.object({
    agent_id: z.number().int(),
    display_name: z.string(),
    agent_code: z.string(),
    activities_total: z.number().int().nonnegative(),
    breakdown: KindBreakdownSchema,
    leads_claimed: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    last_activity_at: z.string().nullable(),
});
export type AgentReportRow = z.infer<typeof AgentReportRowSchema>;

export const PerUserReportSchema = z.object({
    period: ReportPeriodSchema,
    start: z.string(),
    end: z.string(),
    rows: z.array(AgentReportRowSchema),
});
export type PerUserReport = z.infer<typeof PerUserReportSchema>;
