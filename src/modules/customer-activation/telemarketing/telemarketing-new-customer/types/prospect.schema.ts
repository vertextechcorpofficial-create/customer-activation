import { z } from "zod";

/**
 * Contracts for the new-customer lane (`telemarketing_prospect`).
 *
 * SELF-CONTAINED: primitives are duplicated here, never imported from a
 * sibling module folder. A prospect is a MANUAL ENTRY of a person/company
 * that never existed as a lead — this is NOT lead conversion. Conversion
 * happens automatically when a lead reaches Closed Won in the pipeline
 * module, which owns `status: "converted"` exclusively.
 */

// PH wall time, per conventions §6: YYYY-MM-DD HH:mm:ss in Asia/Manila.
export const PhTimestampSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

export const ProspectStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "rejected"]);
export type ProspectStatus = z.infer<typeof ProspectStatusSchema>;

export const ProspectSchema = z.object({
    prospect_id: z.number().int(),
    prospect_code: z.string().min(1).max(32),
    company_name: z.string().min(1).max(191),
    contact_name: z.string().max(191).nullable().optional(),
    contact_position: z.string().max(128).nullable().optional(),
    mobile: z.string().max(32).nullable().optional(),
    email: z.string().max(191).nullable().optional(),
    address: z.string().max(255).nullable().optional(),
    industry: z.string().max(128).nullable().optional(),
    product_interest: z.string().max(191).nullable().optional(),
    need: z.string().nullable().optional(),
    prospect_status: ProspectStatusSchema,
    converted_customer_id: z.number().int().nullable().optional(),
    converted_at: PhTimestampSchema.nullable().optional(),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

/**
 * Manual-entry payload. `prospect_code` and `status` are NOT client-supplied —
 * the service mints the code (`PR-000123`) and every entry starts as `new`.
 * At least one contact channel (mobile or email) is required so the record
 * is actionable and dedupe has something to match on.
 */
export const ProspectCreateSchema = z
    .object({
        company_name: z.string().trim().min(1, "Company name is required").max(191),
        contact_name: z.string().trim().max(191).nullish(),
        contact_position: z.string().trim().max(128).nullish(),
        mobile: z.string().trim().max(32).nullish(),
        email: z.string().trim().email("Enter a valid email").max(191).nullish(),
        address: z.string().trim().max(255).nullish(),
        industry: z.string().trim().max(128).nullish(),
        product_interest: z.string().trim().max(191).nullish(),
        need: z.string().trim().nullish(),
    })
    .refine((v) => (v.mobile?.trim() ?? "") !== "" || (v.email?.trim() ?? "") !== "", {
        message: "Mobile or email is required",
        path: ["mobile"],
    });

/**
 * Partial update. `status: "converted"` is deliberately absent — only the
 * pipeline module may convert, so this lane can never write it.
 */
export const ProspectUpdateSchema = z
    .object({
        company_name: z.string().trim().min(1).max(191).optional(),
        contact_name: z.string().trim().max(191).nullable().optional(),
        contact_position: z.string().trim().max(128).nullable().optional(),
        mobile: z.string().trim().max(32).nullable().optional(),
        email: z.string().trim().email("Enter a valid email").max(191).nullable().optional(),
        address: z.string().trim().max(255).nullable().optional(),
        industry: z.string().trim().max(128).nullable().optional(),
        product_interest: z.string().trim().max(191).nullable().optional(),
        need: z.string().trim().nullable().optional(),
        prospect_status: z.enum(["new", "contacted", "qualified", "rejected"]).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type Prospect = z.infer<typeof ProspectSchema>;
export type ProspectCreate = z.infer<typeof ProspectCreateSchema>;
export type ProspectUpdate = z.infer<typeof ProspectUpdateSchema>;
