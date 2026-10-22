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

/**
 * Rolling 7/30/90-day periods (days, Asia/Manila wall clock) — shared kernel
 * for the agent-history lane below (`AgentHistoryPeriodSchema`,
 * `parseAgentHistoryPeriod`). The per-user index table does not use these;
 * it uses `ReportPeriod` / `PerUserReport` above.
 */

export const AgentReportPeriodSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export type AgentReportPeriod = z.infer<typeof AgentReportPeriodSchema>;

/** Coerce query input (`"30"` works); throw a 400-mappable Error otherwise. */
export function parseAgentReportPeriod(value: unknown): AgentReportPeriod {
    const parsed = AgentReportPeriodSchema.safeParse(
        typeof value === "string" && value.trim() !== "" ? Number(value) : value,
    );
    if (!parsed.success) {
        throw new Error(
            `Invalid agent report period: expected one of 7, 30, 90 (days), received ${JSON.stringify(value) ?? "nothing"}.`,
        );
    }
    return parsed.data;
}

/**
 * Agent-history dashboard contract — additive. The single-agent history
 * accepts the legacy calendar periods AND the rolling dashboard periods
 * (7 | 30 | 90 days); legacy exports above stay untouched.
 */
export const AgentHistoryPeriodSchema = z.union([ReportPeriodSchema, AgentReportPeriodSchema]);
export type AgentHistoryPeriod = z.infer<typeof AgentHistoryPeriodSchema>;

/** Coerce query input (`"30"` or `"mtd"` both work); throw a 400-mappable Error otherwise. */
export function parseAgentHistoryPeriod(value: unknown): AgentHistoryPeriod {
    if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()))) {
        return parseAgentReportPeriod(value);
    }
    const parsed = ReportPeriodSchema.safeParse(value);
    if (!parsed.success) {
        throw new Error(
            `Invalid agent history period: expected one of mtd, last_30, last_90, 7, 30, 90, received ${JSON.stringify(value) ?? "nothing"}.`,
        );
    }
    return parsed.data;
}

/** One window's headline numbers; `conv_rate` is won / claimed (null when claimed is 0). */
export const AgentHistoryKpiSchema = z.object({
    activities: z.number().int().nonnegative(),
    claimed: z.number().int().nonnegative(),
    won: z.number().int().nonnegative(),
    conv_rate: z.number().nonnegative().nullable(),
});
export type AgentHistoryKpi = z.infer<typeof AgentHistoryKpiSchema>;

/** Percent change vs the previous window; null when the previous value is 0 or missing — except `conv_rate`, which is a percentage-point difference (see below). */
export const AgentHistoryDeltasSchema = z.object({
    activities: z.number().nullable(),
    claimed: z.number().nullable(),
    won: z.number().nullable(),
    /** Percentage-point difference: round1((current_rate - previous_rate) * 100); null only when the previous window has no claims (no baseline). */
    conv_rate: z.number().nullable(),
});
export type AgentHistoryDeltas = z.infer<typeof AgentHistoryDeltasSchema>;

/** Team comparison context for one agent history response. */
export const AgentHistoryTeamSchema = z.object({
    agents: z.number().int().nonnegative(),
    avg_activities: z.number().nonnegative(),
    avg_claimed: z.number().nonnegative(),
    avg_won: z.number().nonnegative(),
    avg_conv_rate: z.number().nonnegative().nullable(),
});
export type AgentHistoryTeam = z.infer<typeof AgentHistoryTeamSchema>;

export const AgentHistoryRankSchema = z.object({
    position: z.number().int().positive(),
    of: z.number().int().nonnegative(),
});
export type AgentHistoryRank = z.infer<typeof AgentHistoryRankSchema>;
