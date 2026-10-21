// Server-only: owns every Directus read for the asset reports (entirely read-only).
// Only ever imported from route handlers, never from client components.

import type {
    CustomerAssetRow,
    LastPurchaseRow,
    ValuationRow,
} from "../types/asset-reports.schema";
import { round2, unitValue } from "../utils/valuation";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";

const ITEM_COLLECTION = "customer_asset_item";
const TAGGING_COLLECTION = "customer_asset_tagging";
const CUSTOMER_COLLECTION = "customer";

interface DirectusEnvelope<T> {
    data?: T;
    errors?: Array<{ message?: string }>;
}

async function directus<T>(path: string): Promise<T[]> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        },
    });
    const body = (await res.json().catch(() => null)) as DirectusEnvelope<T[]> | null;
    if (!res.ok) {
        throw new Error(body?.errors?.[0]?.message ?? "Directus request failed");
    }
    return body?.data ?? [];
}

function toNumber(value: number | string | null | undefined): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

interface ItemRow {
    id: number;
    item_code: string;
    name: string;
    quantity: number;
    cost_per_item: number | string | null;
    life_span_months: number | string | null;
    date_acquired: string | null;
    is_retired: boolean | 0 | 1;
    updated_at: string;
    group_id: number | null;
}

const ITEM_FIELDS =
    "id,item_code,name,quantity,cost_per_item,life_span_months,date_acquired,is_retired,updated_at,group_id";

export async function lastPurchase(): Promise<LastPurchaseRow[]> {
    const items = await directus<ItemRow>(
        `/items/${ITEM_COLLECTION}?limit=-1&sort=-updated_at&fields=${ITEM_FIELDS}`,
    );
    return items.map((item) => ({
        item_id: item.id,
        item_code: item.item_code,
        name: item.name,
        quantity: item.quantity,
        last_purchase_at: item.updated_at,
        is_retired: item.is_retired,
    }));
}

interface TaggingRow {
    id: number;
    customer_id: number | null;
    item_id: number | null;
    quantity: number;
    returned_quantity: number | null;
    assignment_status: string | null;
}

interface ItemRef {
    id: number;
    item_code: string;
    name: string;
}

interface CustomerRef {
    id: number;
    customer_code: string;
    customer_name: string;
}

export async function customerAssets(): Promise<CustomerAssetRow[]> {
    // One batched fetch per collection; grouping happens in JS below (no N+1).
    const [taggings, items, customers] = await Promise.all([
        directus<TaggingRow>(
            `/items/${TAGGING_COLLECTION}?limit=-1&fields=id,customer_id,item_id,quantity,returned_quantity,assignment_status`,
        ),
        directus<ItemRef>(`/items/${ITEM_COLLECTION}?limit=-1&fields=id,item_code,name`),
        directus<CustomerRef>(
            `/items/${CUSTOMER_COLLECTION}?limit=-1&fields=id,customer_code,customer_name`,
        ),
    ]);

    const itemById = new Map(items.map((item) => [item.id, item]));
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const byCustomer = new Map<number, CustomerAssetRow>();

    for (const tagging of taggings) {
        const quantityOut = Math.max(0, tagging.quantity - (tagging.returned_quantity ?? 0));
        if (quantityOut <= 0) continue;
        if (tagging.customer_id == null || tagging.item_id == null) continue;
        const customer = customerById.get(tagging.customer_id);
        const item = itemById.get(tagging.item_id);
        if (!customer || !item) continue;
        const row = byCustomer.get(customer.id) ?? {
            customer_id: customer.id,
            customer_code: customer.customer_code,
            customer_name: customer.customer_name,
            items: [],
        };
        row.items.push({
            item_id: item.id,
            item_code: item.item_code,
            name: item.name,
            quantity_out: quantityOut,
        });
        byCustomer.set(customer.id, row);
    }

    return [...byCustomer.values()]
        .map((row) => ({
            ...row,
            items: [...row.items].sort((a, b) => a.item_code.localeCompare(b.item_code)),
        }))
        .sort((a, b) => a.customer_code.localeCompare(b.customer_code));
}

export async function valuation(asOf?: string): Promise<ValuationRow[]> {
    const items = await directus<ItemRow>(
        `/items/${ITEM_COLLECTION}?limit=-1&fields=id,item_code,name,quantity,cost_per_item,life_span_months,date_acquired`,
    );
    const now = asOf && !Number.isNaN(Date.parse(asOf)) ? new Date(asOf) : new Date();
    return items.map((item) => {
        const unit = unitValue({
            costPerItem: toNumber(item.cost_per_item),
            lifeSpanMonths: Math.floor(toNumber(item.life_span_months)),
            // ponytail: slice guards datetime strings; day math only needs the date part.
            dateAcquired: (item.date_acquired ?? "").slice(0, 10),
            now,
        });
        return {
            item_id: item.id,
            item_code: item.item_code,
            name: item.name,
            quantity: item.quantity,
            unit_value: unit,
            total_value: round2(unit * item.quantity),
            is_fully_depreciated: unit === 0,
        };
    });
}
