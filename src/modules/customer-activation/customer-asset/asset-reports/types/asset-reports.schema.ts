// Contracts for the Reports module; primitives duplicated deliberately for self-containment.
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

export const DbDecimalSchema = z.union([
    z.number(),
    z.string().regex(/^-?\d+(\.\d+)?$/, "Expected a numeric string"),
]);

export const ReportFilterSchema = z.object({
    as_of: IsoDateSchema.optional(),
    group_id: z.number().int().positive().optional(),
    customer_id: z.number().int().positive().optional(),
});

export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const LastPurchaseRowSchema = z.object({
    item_id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().min(0),
    last_purchase_at: PhTimestampSchema,
    is_retired: DbFlagSchema,
});

export type LastPurchaseRow = z.infer<typeof LastPurchaseRowSchema>;

const CustomerAssetItemSchema = z.object({
    item_id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    quantity_out: z.number().int().min(0),
});

export type CustomerAssetItem = z.infer<typeof CustomerAssetItemSchema>;

export const CustomerAssetRowSchema = z.object({
    customer_id: z.number().int(),
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    items: z.array(CustomerAssetItemSchema),
});

export type CustomerAssetRow = z.infer<typeof CustomerAssetRowSchema>;

export const ValuationRowSchema = z.object({
    item_id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().min(0),
    unit_value: DbDecimalSchema,
    total_value: DbDecimalSchema,
    is_fully_depreciated: z.boolean(),
});

export type ValuationRow = z.infer<typeof ValuationRowSchema>;

export const ReportsPayloadSchema = z.object({
    last_purchase: z.array(LastPurchaseRowSchema),
    customer_assets: z.array(CustomerAssetRowSchema),
    valuation: z.array(ValuationRowSchema),
    generated_at: PhTimestampSchema,
});

export type ReportsPayload = z.infer<typeof ReportsPayloadSchema>;
