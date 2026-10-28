import { z } from "zod";

/**
 * Contracts for the Referral Campaigns module.
 *
 * Self-contained by design: primitives are duplicated here rather than imported
 * from the telemarketing module or any sibling lane. Never import across feature
 * modules and never hoist these into a shared folder.
 *
 * Field names mirror `referrals_campaign` exactly.
 * Directus/MySQL returns `0`/`1` for tinyint flags, so `DbFlag` tolerates both.
 * `content_json` is written only as the validated v2 canvas document from
 * `../designer/schema` (see `writeCampaignContent`); this schema only surfaces
 * its presence + version.
 */

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// PH wall time, per conventions §6.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

// Directus returns tinyint as boolean or 0/1.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);
export type DbFlag = z.infer<typeof DbFlagSchema>;

// Lowercase kebab, e.g. `solar-referral-month`.
export const CampaignCodeSchema = z
    .string()
    .min(1, "Enter a campaign code.")
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens.");

// Nullable PH datetimes (`starts_at` / `ends_at`).
const NullableDatetimeSchema = z.string().min(1).nullable().optional();

export const CampaignSchema = z.object({
    campaign_id: z.number().int(),
    campaign_code: z.string().min(1).max(64),
    title: z.string().min(1).max(191),
    description: z.string().nullable().optional(),
    content_json: z.string().nullable().optional(),
    content_version: z.number().int(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
    is_active: DbFlagSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

const windowRefinement = (v: { starts_at?: string | null; ends_at?: string | null }) => {
    if (!v.starts_at || !v.ends_at) return true;
    return v.ends_at >= v.starts_at;
};

const WINDOW_MESSAGE = "End date must not be before the start date.";

const CampaignBaseSchema = z.object({
    campaign_code: CampaignCodeSchema,
    title: z.string().min(1, "Enter a campaign title.").max(191),
    description: z.string().max(65535).nullable().optional(),
    starts_at: NullableDatetimeSchema,
    ends_at: NullableDatetimeSchema,
    is_active: z.boolean().default(true),
});

export const CampaignCreateSchema = CampaignBaseSchema.refine(windowRefinement, {
    message: WINDOW_MESSAGE,
    path: ["ends_at"],
});

export const CampaignUpdateSchema = CampaignBaseSchema.partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })
    .refine(windowRefinement, { message: WINDOW_MESSAGE, path: ["ends_at"] });

export type Campaign = z.infer<typeof CampaignSchema>;
export type CampaignCreate = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
