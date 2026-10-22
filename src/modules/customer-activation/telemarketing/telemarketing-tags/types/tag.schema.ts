import { z } from "zod";

/**
 * Contracts for the Tag Creation module.
 *
 * Self-contained by design: primitives are duplicated here rather than imported
 * from the telemarketing module or any sibling lane. Never import across feature
 * modules and never hoist these into a shared folder.
 *
 * Field names mirror `telemarketing_tag` exactly.
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

export const TagSchema = z.object({
    tag_id: z.number().int(),
    tag_code: z.string().min(1).max(64),
    tag_name: z.string().min(1).max(191),
    color: z.string().max(32).nullable().optional(),
    description: z.string().nullable().optional(),
    is_active: DbFlagSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export const TagCreateSchema = z.object({
    tag_code: z.string().min(1).max(64),
    tag_name: z.string().min(1).max(191),
    color: z.string().max(32).nullable().optional(),
    description: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
});

export const TagUpdateSchema = TagCreateSchema.partial().refine(
    (v) => Object.keys(v).length > 0,
    { message: "Nothing to update" },
);

export type Tag = z.infer<typeof TagSchema>;
export type TagCreate = z.infer<typeof TagCreateSchema>;
export type TagUpdate = z.infer<typeof TagUpdateSchema>;
