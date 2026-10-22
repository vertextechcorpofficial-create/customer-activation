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

export const AssetReportHolderSchema = z.object({
    customer_id: z.number().int(),
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    quantity_out: z.number().int().min(0),
    status: z.enum(["open", "partial"]),
});

export type AssetReportHolder = z.infer<typeof AssetReportHolderSchema>;

export const AssetReportRowSchema = z.object({
    item_id: z.number().int(),
    item_code: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().min(0),
    last_purchase_at: PhTimestampSchema,
    unit_value: DbDecimalSchema,
    total_value: DbDecimalSchema,
    is_retired: DbFlagSchema,
    is_fully_depreciated: z.boolean(),
    holders: z.array(AssetReportHolderSchema),
});

export type AssetReportRow = z.infer<typeof AssetReportRowSchema>;

export const ReportsPayloadSchema = z.object({
    last_purchase: z.array(LastPurchaseRowSchema),
    customer_assets: z.array(CustomerAssetRowSchema),
    valuation: z.array(ValuationRowSchema),
    generated_at: PhTimestampSchema,
});

export type ReportsPayload = z.infer<typeof ReportsPayloadSchema>;

export const AssetReportDetailHolderSchema = z.object({
    customer_id: z.number().int(),
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    quantity_out: z.number().int().min(0),
    status: z.enum(["open", "partial"]),
    expected_return_at: PhTimestampSchema.nullable(),
    tagged_at: PhTimestampSchema.nullable(),
    overdue: z.boolean(),
});

export type AssetReportDetailHolder = z.infer<typeof AssetReportDetailHolderSchema>;

export const AssetReportHistoryEventSchema = z.object({
    id: z.number().int(),
    event: z.enum(["registered", "tagged_to_customer", "returned", "adjusted", "retired"]),
    occurred_at: PhTimestampSchema,
    quantity_before: z.number().int().nullable(),
    quantity_after: z.number().int().nullable(),
    remarks: z.string().nullable(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string().nullable(),
});

export type AssetReportHistoryEvent = z.infer<typeof AssetReportHistoryEventSchema>;

export const AssetReportDetailSchema = z.object({
    item: z.object({
        id: z.number().int(),
        item_code: z.string().min(1),
        name: z.string().min(1),
        group_name: z.string().nullable(),
        is_retired: DbFlagSchema,
        last_purchase_at: PhTimestampSchema,
        date_acquired: z.string().nullable(),
        life_span_months: DbDecimalSchema.nullable(),
        cost_per_item: DbDecimalSchema,
    }),
    tags: z.array(
        z.object({
            id: z.number().int(),
            tag_name: z.string().min(1),
            color: z.string().nullable(),
        }),
    ),
    stock: z.object({
        total: z.number().int().min(0),
        out: z.number().int().min(0),
        available: z.number().int().min(0),
    }),
    valuation: z.object({
        unit_value: DbDecimalSchema,
        total_value: DbDecimalSchema,
        is_fully_depreciated: z.boolean(),
        depreciation_pct: z.number(),
        elapsed_months: z.number().int().min(0),
        life_span_months: z.number().int().nullable(),
    }),
    holders: z.array(AssetReportDetailHolderSchema),
    history: z.array(AssetReportHistoryEventSchema),
});

export type AssetReportDetail = z.infer<typeof AssetReportDetailSchema>;
