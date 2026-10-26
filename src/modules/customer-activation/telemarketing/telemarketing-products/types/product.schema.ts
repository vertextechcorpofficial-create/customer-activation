import { z } from "zod";

/**
 * Contracts for the Telemarketing Products module.
 *
 * Self-contained by design: primitives are duplicated here rather than imported
 * from the telemarketing module or any sibling lane. Never import across feature
 * modules and never hoist these into a shared folder.
 *
 * Field names mirror `telemarketing_products` exactly.
 * Directus/MySQL returns `0`/`1` for tinyint flags, so `DbFlag` tolerates both.
 */

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// PH wall time, per conventions §6.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

// Directus returns tinyint as boolean or 0/1.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);
export type DbFlag = z.infer<typeof DbFlagSchema>;

export const ProductSchema = z.object({
    product_id: z.number().int(),
    product_code: z.string().min(1).max(64),
    name: z.string().min(1).max(191),
    is_active: DbFlagSchema,
    sort_order: z.number().int(),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export const ProductCreateSchema = z.object({
    product_code: z.string().min(1).max(64),
    name: z.string().min(1).max(191),
    sort_order: z.number().int().min(0).default(0),
    is_active: z.boolean().default(true),
});

export const ProductUpdateSchema = ProductCreateSchema.partial().refine(
    (v) => Object.keys(v).length > 0,
    { message: "Nothing to update" },
);

export type Product = z.infer<typeof ProductSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
