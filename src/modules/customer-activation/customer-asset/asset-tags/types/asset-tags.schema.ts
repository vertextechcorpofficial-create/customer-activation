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

export const AssetTagSchema = z.object({
    id: z.number().int(),
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

export type AssetTag = z.infer<typeof AssetTagSchema>;

export const CreateAssetTagSchema = z.object({
    tag_code: z.string().min(1).max(64),
    tag_name: z.string().min(1).max(191),
    color: z.string().max(32).nullable().optional(),
    description: z.string().max(4000).nullable().optional(),
    is_active: z.boolean().optional(),
});

export type CreateAssetTagInput = z.infer<typeof CreateAssetTagSchema>;

export const UpdateAssetTagSchema = CreateAssetTagSchema.partial();

export type UpdateAssetTagInput = z.infer<typeof UpdateAssetTagSchema>;
