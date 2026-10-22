import { z } from "zod";

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// PH wall time, per conventions §6.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected a PH timestamp (YYYY-MM-DD HH:mm:ss or ISO-8601)");

export const IsoDateSchema = z.string().regex(ISO_DATE, "Expected YYYY-MM-DD");

// Directus returns tinyint as boolean or 0/1, and DECIMAL as number or string.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);

export const AssignmentStatusSchema = z.enum(["open", "partial", "returned"]);

export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const TaggingSchema = z.object({
    id: z.number().int(),
    customer_id: z.number().int(),
    item_id: z.number().int(),
    quantity: z.number().int().positive(),
    remarks: z.string().nullable().optional(),
    tagged_at: PhTimestampSchema,
    expected_return_at: PhTimestampSchema.nullable().optional(),
    returned_quantity: z.number().int().min(0),
    closed_at: PhTimestampSchema.nullable().optional(),
    condition_out: z.string().max(64).nullable().optional(),
    condition_in: z.string().max(64).nullable().optional(),
    return_remarks: z.string().nullable().optional(),
    tagged_by: z.number().int().nullable().optional(),
    assignment_status: AssignmentStatusSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type Tagging = z.infer<typeof TaggingSchema>;

export const CreateTaggingSchema = z.object({
    customer_id: z.number().int().positive(),
    item_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    expected_return_at: PhTimestampSchema.nullable().optional(),
    condition_out: z.string().max(64).nullable().optional(),
    remarks: z.string().max(4000).nullable().optional(),
});

export type CreateTaggingInput = z.infer<typeof CreateTaggingSchema>;

export const ReturnTaggingSchema = z
    .object({
        tagging_id: z.number().int().positive(),
        returned_quantity: z.number().int().positive(),
        condition_in: z.string().max(64).nullable().optional(),
        return_remarks: z.string().max(4000).nullable().optional(),
    })
    .refine((data) => data.returned_quantity >= 1, {
        message: "Returned quantity must be at least 1",
        path: ["returned_quantity"],
    });

export type ReturnTaggingInput = z.infer<typeof ReturnTaggingSchema>;
