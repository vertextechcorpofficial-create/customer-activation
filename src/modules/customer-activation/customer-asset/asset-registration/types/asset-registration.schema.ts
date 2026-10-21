// Contracts for the Asset Registry module.
import { z } from "zod";

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PH wall time, per conventions §6.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected a PH timestamp (YYYY-MM-DD HH:mm:ss or ISO-8601)");

export const IsoDateSchema = z.string().regex(ISO_DATE, "Expected YYYY-MM-DD");

export const UuidSchema = z.string().regex(UUID, "Expected a UUID");

// Directus returns tinyint as boolean or 0/1, and DECIMAL as number or string.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);

export const DbDecimalSchema = z.union([
    z.number(),
    z.string().regex(/^-?\d+(\.\d+)?$/, "Expected a numeric string"),
]);

export const AssetGroupSchema = z.object({
    id: z.number().int(),
    group_code: z.string().min(1),
    group_name: z.string().min(1),
    description: z.string().nullable().optional(),
    is_active: DbFlagSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type AssetGroup = z.infer<typeof AssetGroupSchema>;

export const AssetTagSchema = z.object({
    id: z.number().int(),
    tag_code: z.string().min(1),
    tag_name: z.string().min(1),
    color: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    is_active: DbFlagSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type AssetTag = z.infer<typeof AssetTagSchema>;

export const AssetItemSchema = z.object({
    id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    category: z.string().nullable().optional(),
    quantity: z.number().int().min(0),
    cost_per_item: DbDecimalSchema,
    life_span_months: z.number().int().positive(),
    date_acquired: IsoDateSchema,
    serial: z.string().nullable().optional(),
    rfid_code: z.string().nullable().optional(),
    barcode: z.string().nullable().optional(),
    image: UuidSchema.nullable().optional(),
    group_id: z.number().int().nullable().optional(),
    is_retired: DbFlagSchema,
    remarks: z.string().nullable().optional(),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type AssetItem = z.infer<typeof AssetItemSchema>;

export const CreateAssetItemSchema = z
    .object({
        item_code: z.string().min(1).max(64).optional(),
        name: z.string().min(1).max(191),
        category: z.string().max(191).nullable().optional(),
        quantity: z.number().int().min(0),
        cost_per_item: z.number().min(0),
        life_span_months: z.number().int().positive(),
        date_acquired: IsoDateSchema,
        serial: z.string().max(191).nullable().optional(),
        rfid_code: z.string().max(191).nullable().optional(),
        barcode: z.string().max(191).nullable().optional(),
        image: UuidSchema.nullable().optional(),
        group_id: z.number().int().nullable().optional(),
        remarks: z.string().max(4000).nullable().optional(),
    })
    .refine((data) => data.quantity !== 1 || Boolean(data.serial?.trim()), {
        message: "A serial is required when registering a single unit",
        path: ["serial"],
    })
    .refine((data) => data.date_acquired <= new Date().toISOString().slice(0, 10), {
        message: "Acquisition date cannot be in the future",
        path: ["date_acquired"],
    });

export type CreateAssetItemInput = z.infer<typeof CreateAssetItemSchema>;

// Restock is an edit of this row; the service refuses to drop quantity below units currently assigned.
export const UpdateAssetItemSchema = z.object({
    name: z.string().min(1).max(191).optional(),
    category: z.string().max(191).nullable().optional(),
    quantity: z.number().int().min(0).optional(),
    cost_per_item: z.number().min(0).optional(),
    life_span_months: z.number().int().positive().optional(),
    date_acquired: IsoDateSchema.optional(),
    serial: z.string().max(191).nullable().optional(),
    rfid_code: z.string().max(191).nullable().optional(),
    barcode: z.string().max(191).nullable().optional(),
    image: UuidSchema.nullable().optional(),
    group_id: z.number().int().nullable().optional(),
    is_retired: z.boolean().optional(),
    remarks: z.string().max(4000).nullable().optional(),
});

export type UpdateAssetItemInput = z.infer<typeof UpdateAssetItemSchema>;

export const AssetItemTagSchema = z.object({
    id: z.number().int(),
    item_id: z.number().int(),
    tag_id: z.number().int(),
    tagged_at: PhTimestampSchema,
    tagged_by: z.number().int().nullable().optional(),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type AssetItemTag = z.infer<typeof AssetItemTagSchema>;

export const SetAssetItemTagsSchema = z.object({
    item_id: z.number().int().positive(),
    tag_ids: z.array(z.number().int().positive()).max(50),
});

export type SetAssetItemTagsInput = z.infer<typeof SetAssetItemTagsSchema>;

export const AssignmentLineSchema = z.object({
    id: z.number().int(),
    item_id: z.number().int(),
    quantity: z.number().int().positive(),
    returned_quantity: z.number().int().min(0),
    assignment_status: z.enum(["open", "partial", "returned"]),
});

export type AssignmentLine = z.infer<typeof AssignmentLineSchema>;

export const HistoryEventSchema = z.enum([
    "registered",
    "tagged_to_customer",
    "returned",
    "adjusted",
    "retired",
]);

export type HistoryEvent = z.infer<typeof HistoryEventSchema>;

export const AssetHistorySchema = z.object({
    id: z.number().int(),
    item_id: z.number().int(),
    event: HistoryEventSchema,
    quantity_delta: z.number().int().nullable().optional(),
    quantity_before: z.number().int().nullable().optional(),
    quantity_after: z.number().int().nullable().optional(),
    cost_before: DbDecimalSchema.nullable().optional(),
    cost_after: DbDecimalSchema.nullable().optional(),
    // Per-return condition/remarks.
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    reference_table: z.string().nullable().optional(),
    reference_id: z.number().int().nullable().optional(),
    remarks: z.string().nullable().optional(),
    actor_user_id: z.number().int().nullable().optional(),
    occurred_at: PhTimestampSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export type AssetHistory = z.infer<typeof AssetHistorySchema>;

export const CreateAssetHistoryEntrySchema = z.object({
    item_id: z.number().int().positive(),
    event: HistoryEventSchema,
    quantity_delta: z.number().int().nullable().optional(),
    quantity_before: z.number().int().nullable().optional(),
    quantity_after: z.number().int().nullable().optional(),
    cost_before: z.number().nullable().optional(),
    cost_after: z.number().nullable().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    reference_table: z.string().max(64).nullable().optional(),
    reference_id: z.number().int().nullable().optional(),
    remarks: z.string().max(4000).nullable().optional(),
    actor_user_id: z.number().int().nullable().optional(),
    occurred_at: PhTimestampSchema,
});

export type CreateAssetHistoryEntryInput = z.infer<typeof CreateAssetHistoryEntrySchema>;
