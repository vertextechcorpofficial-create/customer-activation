import { z } from "zod";

/**
 * Pipeline lane contracts — self-contained, never import from the legacy
 * `telemarketing/{types,utils,services,providers,hooks,components}` folders.
 * Field names mirror `telemarketing_*` exactly.
 */

// Philippine wall time `YYYY-MM-DD HH:mm:ss`, written explicitly by the app.
const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export const PhTimestampSchema = z
  .string()
  .regex(PH_TIMESTAMP, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

// Directus/MySQL returns tinyint flags as boolean or 0/1.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);

export const VALIDATION_STATUSES = [
  "new",
  "for_validation",
  "validated",
  "duplicate",
  "invalid",
  "rejected",
] as const;

export const LEAD_SOURCES = [
  "customer_db",
  "prospecting",
  "client_db",
  "referral",
  "portal",
] as const;

export const ACTIVITY_KINDS = ["call", "email", "visit", "meeting", "note"] as const;

export const ACTIVITY_OUTCOMES = [
  "connected",
  "no_answer",
  "callback",
  "interested",
  "not_interested",
  "wrong_number",
] as const;

/* -------------------------------------------------------------------------- */
/* Stage                                                                      */
/* -------------------------------------------------------------------------- */

export const StageSchema = z.object({
  stage_id: z.number().int(),
  stage_code: z.string().min(1).max(64),
  stage_name: z.string().min(1).max(191),
  stage_order: z.number().int().nonnegative(),
  is_won: DbFlagSchema,
  is_lost: DbFlagSchema,
  is_active: DbFlagSchema,
  created_by: z.number().int().nullable().optional(),
  created_at: PhTimestampSchema,
  updated_by: z.number().int().nullable().optional(),
  updated_at: PhTimestampSchema,
});

export const StageCreateSchema = z.object({
  stage_code: z.string().min(1).max(64),
  stage_name: z.string().min(1).max(191),
  stage_order: z.number().int().nonnegative(),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const StageUpdateSchema = StageCreateSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nothing to update" },
);

/** A stage is terminal when it is won or lost — leads there leave the pool. */
export function isTerminalStage(stage: Pick<z.infer<typeof StageSchema>, "is_won" | "is_lost">) {
  return Number(stage.is_won) === 1 || Number(stage.is_lost) === 1;
}

/* -------------------------------------------------------------------------- */
/* Lead (minimal board view — the pipeline never creates leads)                */
/* -------------------------------------------------------------------------- */

export const LeadViewSchema = z.object({
  lead_id: z.number().int(),
  lead_code: z.string().min(1).max(32),
  company_name: z.string().min(1).max(191),
  contact_name: z.string().max(191).nullable().optional(),
  mobile: z.string().max(32).nullable().optional(),
  email: z.string().max(191).nullable().optional(),
  stage_id: z.number().int(),
  validation_status: z.enum(VALIDATION_STATUSES),
  product_interest: z.string().max(64).nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  next_follow_up_at: z.string().nullable().optional(),
});

/** Move a lead between stages. `lost_reason` is required on a lost stage. */
export const LeadStageMoveSchema = z.object({
  stage_id: z.number().int(),
  lost_reason: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Lead record (read-only — the pipeline never creates leads)                  */
/* -------------------------------------------------------------------------- */

/** A lead row as the list and detail views read it. */
export const LeadRecordSchema = z.object({
  lead_id: z.number().int(),
  lead_code: z.string().min(1).max(32),
  source: z.enum(LEAD_SOURCES),
  company_name: z.string().min(1).max(191),
  contact_name: z.string().max(191).nullable().optional(),
  contact_position: z.string().max(191).nullable().optional(),
  mobile: z.string().max(32).nullable().optional(),
  email: z.string().max(191).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  industry: z.string().max(128).nullable().optional(),
  product_interest: z.string().max(64).nullable().optional(),
  need: z.string().nullable().optional(),
  stage_id: z.number().int(),
  validation_status: z.enum(VALIDATION_STATUSES),
  next_follow_up_at: z.string().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  lost_reason: z.string().nullable().optional(),
  referral_code: z.string().max(64).nullable().optional(),
  campaign_code: z.string().max(64).nullable().optional(),
});

/** A tag on a lead, resolved through `telemarketing_lead_tag`. */
export const LeadTagViewSchema = z.object({
  tag_id: z.number().int(),
  tag_name: z.string().min(1).max(191),
  color: z.string().max(32).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Claims (many agents may claim one lead)                                    */
/* -------------------------------------------------------------------------- */

export const LeadAgentSchema = z.object({
  id: z.number().int(),
  lead_id: z.number().int(),
  agent_id: z.number().int(),
  claimed_at: PhTimestampSchema,
  is_primary: DbFlagSchema,
  released_at: z.string().nullable().optional(),
});

export const ClaimSchema = z.object({
  lead_id: z.number().int(),
  agent_id: z.number().int(),
});

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export const ActivitySchema = z.object({
  activity_id: z.number().int(),
  lead_id: z.number().int(),
  agent_id: z.number().int(),
  kind: z.enum(ACTIVITY_KINDS),
  outcome: z.enum(ACTIVITY_OUTCOMES).nullable().optional(),
  notes: z.string().nullable().optional(),
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
  occurred_at: PhTimestampSchema,
  created_by: z.number().int().nullable().optional(),
  created_at: PhTimestampSchema,
  updated_by: z.number().int().nullable().optional(),
  updated_at: PhTimestampSchema,
});

export const ActivityCreateSchema = z
  .object({
    lead_id: z.number().int(),
    kind: z.enum(ACTIVITY_KINDS),
    outcome: z.enum(ACTIVITY_OUTCOMES).nullable().optional(),
    notes: z.string().nullable().optional(),
    duration_minutes: z.number().int().nonnegative().nullable().optional(),
    occurred_at: PhTimestampSchema.optional(),
  })
  .refine((v) => v.kind === "note" || Boolean(v.outcome), {
    message: "Pick an outcome for anything other than a note",
    path: ["outcome"],
  });

export type Stage = z.infer<typeof StageSchema>;
export type StageCreate = z.infer<typeof StageCreateSchema>;
export type StageUpdate = z.infer<typeof StageUpdateSchema>;
export type LeadView = z.infer<typeof LeadViewSchema>;
export type LeadRecord = z.infer<typeof LeadRecordSchema>;
export type LeadTagView = z.infer<typeof LeadTagViewSchema>;
export type LeadStageMove = z.infer<typeof LeadStageMoveSchema>;
export type LeadAgent = z.infer<typeof LeadAgentSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type ActivityCreate = z.infer<typeof ActivityCreateSchema>;
