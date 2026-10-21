import { z } from "zod";

/**
 * Lead Generation lane contracts — self-contained, never import from the
 * parent `telemarketing/{types,utils,services}` folders or sibling lanes.
 * Field names mirror `telemarketing_lead` exactly.
 */

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// PH wall time, written explicitly by the app.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

export const LEAD_SOURCES = ["customer_db", "prospecting", "client_db"] as const;

export const PARTY_KINDS = ["customer", "company", "dealer", "none"] as const;

export const SourceOption = z.enum(LEAD_SOURCES);
export type SourceOption = z.infer<typeof SourceOption>;

export const StageOptionSchema = z.object({
    stage_id: z.number().int(),
    stage_code: z.string().min(1).max(64),
    stage_name: z.string().min(1).max(191),
});
export type StageOption = z.infer<typeof StageOptionSchema>;

/** A provisional source row shown in one of the three source tabs. */
export interface SourceRow {
    id: number;
    name: string;
    code: string | null;
    contact: string | null;
    email: string | null;
    city: string | null;
    province: string | null;
    party_kind: (typeof PARTY_KINDS)[number];
    party_id: number | null;
    source: SourceOption;
}

export const LeadSchema = z.object({
    lead_id: z.number().int(),
    lead_code: z.string().min(1).max(32),
    source: SourceOption,
    party_kind: z.enum(PARTY_KINDS),
    party_id: z.number().int().nullable().optional(),
    company_name: z.string().min(1).max(191),
    contact_name: z.string().max(191).nullable().optional(),
    mobile: z.string().max(32).nullable().optional(),
    email: z.string().max(191).nullable().optional(),
    address: z.string().max(255).nullable().optional(),
    industry: z.string().max(128).nullable().optional(),
    product_interest: z.string().max(64).nullable().optional(),
    need: z.string().nullable().optional(),
    stage_id: z.number().int(),
    validation_status: z.string().min(1).max(32),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export const LeadCreateSchema = z
    .object({
        source: SourceOption,
        party_kind: z.enum(PARTY_KINDS).default("none"),
        party_id: z.number().int().nullable().optional(),
        company_name: z.string().min(1).max(191),
        contact_name: z.string().max(191).nullable().optional(),
        mobile: z.string().max(32).nullable().optional(),
        email: z.string().max(191).nullable().optional(),
        address: z.string().max(255).nullable().optional(),
        industry: z.string().max(128).nullable().optional(),
        product_interest: z.string().max(64).nullable().optional(),
        need: z.string().nullable().optional(),
        stage_id: z.number().int().optional(),
        tag_ids: z.array(z.number().int()).optional(),
    })
    .refine((v) => Boolean(v.mobile?.trim()) || Boolean(v.email?.trim()), {
        message: "A lead needs a mobile number or an email address",
        path: ["mobile"],
    });

export const LeadUpdateSchema = z
    .object({
        company_name: z.string().min(1).max(191).optional(),
        contact_name: z.string().max(191).nullable().optional(),
        mobile: z.string().max(32).nullable().optional(),
        email: z.string().max(191).nullable().optional(),
        address: z.string().max(255).nullable().optional(),
        industry: z.string().max(128).nullable().optional(),
        product_interest: z.string().max(64).nullable().optional(),
        need: z.string().nullable().optional(),
        stage_id: z.number().int().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type Lead = z.infer<typeof LeadSchema>;
export type LeadCreate = z.infer<typeof LeadCreateSchema>;
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;
