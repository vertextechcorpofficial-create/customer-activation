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

export const CustomerRefSchema = z.object({
    id: z.number().int(),
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    is_active: DbFlagSchema,
});

export type CustomerRef = z.infer<typeof CustomerRefSchema>;

export const AssignedItemRefSchema = z.object({
    id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().min(0),
    is_retired: DbFlagSchema,
});

export type AssignedItemRef = z.infer<typeof AssignedItemRefSchema>;

export const NoteSchema = z.object({
    id: z.number().int(),
    customer_id: z.number().int(),
    body: z.string().min(1).max(20000),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
    preview: z.string().optional(),
});

export type Note = z.infer<typeof NoteSchema>;

// Sanitised note with a derived plain-text preview (computed server-side,
// never stored). `preview` stays optional so Directus rows still validate.
export type NoteWithPreview = Note & { preview: string };

export const CreateNoteSchema = z.object({
    customer_id: z.number().int().positive(),
    body: z.string().min(1).max(20000),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
    body: z.string().min(1).max(20000),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;
