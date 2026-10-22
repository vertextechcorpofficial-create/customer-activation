// Server-only: owns every Directus read for the asset reports (entirely read-only).
// Only ever imported from route handlers, never from client components.

import type {
    AssetReportDetail,
    AssetReportHolder,
    AssetReportRow,
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
const ITEM_TAG_COLLECTION = "customer_asset_item_tag";
const TAG_COLLECTION = "customer_asset_tag";
const GROUP_COLLECTION = "customer_asset_group";
const HISTORY_COLLECTION = "customer_asset_history";

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

function unitValueFor(item: ItemRow, now: Date): number {
    return unitValue({
        costPerItem: toNumber(item.cost_per_item),
        lifeSpanMonths: Math.floor(toNumber(item.life_span_months)),
        // ponytail: slice guards datetime strings; day math only needs the date part.
        dateAcquired: (item.date_acquired ?? "").slice(0, 10),
        now,
    });
}

export async function assetReport(asOf?: string): Promise<AssetReportRow[]> {
    // One batched fetch per collection; joins happen in JS below (no N+1).
    const now = asOf && !Number.isNaN(Date.parse(asOf)) ? new Date(asOf) : new Date();
    const [items, taggings, customers] = await Promise.all([
        directus<ItemRow>(`/items/${ITEM_COLLECTION}?limit=-1&fields=${ITEM_FIELDS}`),
        directus<TaggingRow>(
            `/items/${TAGGING_COLLECTION}?limit=-1&fields=id,customer_id,item_id,quantity,returned_quantity,assignment_status`,
        ),
        directus<CustomerRef>(
            `/items/${CUSTOMER_COLLECTION}?limit=-1&fields=id,customer_code,customer_name`,
        ),
    ]);

    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const holdersByItem = new Map<number, AssetReportHolder[]>();

    for (const tagging of taggings) {
        const quantityOut = Math.max(0, tagging.quantity - (tagging.returned_quantity ?? 0));
        if (quantityOut <= 0) continue;
        if (tagging.assignment_status !== "open" && tagging.assignment_status !== "partial") continue;
        if (tagging.customer_id == null || tagging.item_id == null) continue;
        const customer = customerById.get(tagging.customer_id);
        if (!customer) continue;
        const holders = holdersByItem.get(tagging.item_id) ?? [];
        holders.push({
            customer_id: customer.id,
            customer_code: customer.customer_code,
            customer_name: customer.customer_name,
            quantity_out: quantityOut,
            status: tagging.assignment_status,
        });
        holdersByItem.set(tagging.item_id, holders);
    }
    for (const holders of holdersByItem.values()) {
        holders.sort((a, b) => a.customer_code.localeCompare(b.customer_code));
    }

    return items
        .map((item): AssetReportRow => {
            const unit = unitValueFor(item, now);
            return {
                item_id: item.id,
                item_code: item.item_code,
                name: item.name,
                quantity: item.quantity,
                last_purchase_at: item.updated_at,
                unit_value: unit,
                total_value: round2(unit * item.quantity),
                is_retired: item.is_retired,
                is_fully_depreciated: unit === 0,
                holders: holdersByItem.get(item.id) ?? [],
            };
        })
        .sort((a, b) => a.item_code.localeCompare(b.item_code));
}

interface ItemTagRow {
    id: number;
    item_id: number | null;
    tag_id: number | null;
}

interface TagRow {
    id: number;
    tag_name: string;
    color: string | null;
}

interface TaggingDetailRow {
    id: number;
    customer_id: number | null;
    item_id: number | null;
    quantity: number | string;
    returned_quantity: number | string | null;
    assignment_status: string | null;
    tagged_at: string | null;
    expected_return_at: string | null;
}

interface HistoryRow {
    id: number;
    item_id: number | null;
    event: string;
    quantity_before: number | string | null;
    quantity_after: number | string | null;
    remarks: string | null;
    payload: unknown;
    occurred_at: string;
    reference_table: string | null;
    reference_id: number | string | null;
}

interface GroupRow {
    id: number;
    group_name: string;
}

async function directusOne<T>(path: string): Promise<T | null> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        },
    });
    const body = (await res.json().catch(() => null)) as DirectusEnvelope<T> | null;
    if (!res.ok) {
        if (res.status === 404 || res.status === 403) return null;
        throw new Error(body?.errors?.[0]?.message ?? "Directus request failed");
    }
    return body?.data ?? null;
}

function toIntOrNull(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function elapsedMonths(dateAcquired: string | null, now: Date): number {
    if (!dateAcquired) return 0;
    const part = dateAcquired.slice(0, 10).split("-").map(Number);
    const year = part[0];
    const month = part[1];
    const day = part[2];
    if (!year || !month || !day) return 0;
    let months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
    if (now.getDate() < day) months -= 1;
    return months > 0 ? months : 0;
}

function normalizeHistoryPayload(payload: unknown): unknown {
    if (typeof payload !== "string") return payload;
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        return null;
    }
}

function payloadCustomerId(payload: unknown): number | null {
    // Directus returns the JSON column as a string in this setup, so a raw
    // `payload.customer_id` read would be undefined. Normalise first.
    const normalised = normalizeHistoryPayload(payload);
    if (typeof normalised === "string") return payloadCustomerId(normalised);
    if (!normalised || typeof normalised !== "object") return null;
    const record = normalised as Record<string, unknown>;
    const raw = record.customer_id ?? record.customerId;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function isOverdue(status: string | null, expectedReturnAt: string | null, now: number): boolean {
    const s = String(status ?? "").toLowerCase();
    if (s !== "open" && s !== "partial") return false;
    if (!expectedReturnAt) return false;
    const t = new Date(expectedReturnAt.replace(" ", "T")).getTime();
    return Number.isFinite(t) && t < now;
}

export async function getAssetReportHeader(
    itemId: number,
): Promise<{ item_code: string; name: string } | null> {
    if (!Number.isInteger(itemId) || itemId <= 0) return null;
    const item = await directusOne<{ item_code: string; name: string }>(
        `/items/${ITEM_COLLECTION}/${itemId}?fields=id,item_code,name`,
    ).catch(() => null);
    if (!item) return null;
    return { item_code: String(item.item_code ?? ""), name: String(item.name ?? "") };
}

export async function assetReportDetail(itemId: number): Promise<AssetReportDetail | null> {
    if (!Number.isInteger(itemId) || itemId <= 0) return null;
    const now = new Date();
    const nowTime = now.getTime();

    const [item, itemTags, tags, taggings, historyRows] = await Promise.all([
        directusOne<ItemRow>(
            `/items/${ITEM_COLLECTION}/${itemId}?fields=${ITEM_FIELDS}`,
        ).catch(() => null),
        directus<ItemTagRow>(
            `/items/${ITEM_TAG_COLLECTION}?limit=-1&filter[item_id][_eq]=${itemId}&fields=id,item_id,tag_id`,
        ).catch(() => [] as ItemTagRow[]),
        directus<TagRow>(
            `/items/${TAG_COLLECTION}?limit=-1&fields=id,tag_name,color`,
        ).catch(() => [] as TagRow[]),
        directus<TaggingDetailRow>(
            `/items/${TAGGING_COLLECTION}?limit=-1&filter[item_id][_eq]=${itemId}&fields=id,customer_id,item_id,quantity,returned_quantity,assignment_status,tagged_at,expected_return_at`,
        ).catch(() => [] as TaggingDetailRow[]),
        directus<HistoryRow>(
            `/items/${HISTORY_COLLECTION}?limit=-1&sort=-occurred_at&filter[item_id][_eq]=${itemId}&fields=id,item_id,event,quantity_before,quantity_after,remarks,payload,occurred_at,reference_table,reference_id`,
        ).catch(() => [] as HistoryRow[]),
    ]);

    if (!item) return null;

    const tagIds = new Set(
        itemTags.map((row) => row.tag_id).filter((v): v is number => typeof v === "number"),
    );
    const itemTagsOut = tags
        .filter((tag) => tagIds.has(tag.id))
        .map((tag) => ({ id: tag.id, tag_name: tag.tag_name, color: tag.color ?? null }))
        .sort((a, b) => a.tag_name.localeCompare(b.tag_name));

    const taggingCustomerId = new Map<number, number>();
    for (const tagging of taggings) {
        if (typeof tagging.id === "number" && typeof tagging.customer_id === "number" && tagging.customer_id > 0) {
            taggingCustomerId.set(tagging.id, tagging.customer_id);
        }
    }

    const customerIds = new Set<number>();
    for (const tagging of taggings) {
        if (typeof tagging.customer_id === "number" && tagging.customer_id > 0) {
            customerIds.add(tagging.customer_id);
        }
    }
    const historyCustomerIdByRow = new Map<number, number | null>();
    for (const row of historyRows) {
        const payload = normalizeHistoryPayload(row.payload);
        const payloadId = payloadCustomerId(payload);
        const referenceId = toIntOrNull(row.reference_id);
        const referenceCustomerId =
            row.reference_table === "customer_asset_tagging" && referenceId != null
                ? (taggingCustomerId.get(referenceId) ?? null)
                : null;
        const cid = payloadId ?? referenceCustomerId;
        historyCustomerIdByRow.set(row.id, cid);
        if (cid !== null) customerIds.add(cid);
    }

    const [customers, group] = await Promise.all([
        customerIds.size > 0
            ? directus<CustomerRef>(
                  `/items/${CUSTOMER_COLLECTION}?limit=-1&filter[id][_in]=${[...customerIds].join(",")}&fields=id,customer_code,customer_name`,
              ).catch(() => [] as CustomerRef[])
            : Promise.resolve([] as CustomerRef[]),
        item.group_id != null
            ? directusOne<GroupRow>(
                  `/items/${GROUP_COLLECTION}/${item.group_id}?fields=id,group_name`,
              ).catch(() => null)
            : Promise.resolve(null),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    const openTaggings = taggings.filter((tagging) => {
        const s = String(tagging.assignment_status ?? "").toLowerCase();
        return s === "open" || s === "partial";
    });
    const out = openTaggings.reduce(
        (sum, tagging) => sum + Math.max(0, toNumber(tagging.quantity) - toNumber(tagging.returned_quantity)),
        0,
    );
    const total = Math.max(0, Math.trunc(toNumber(item.quantity)));

    const holders: AssetReportDetail["holders"] = openTaggings
        .map((tagging) => {
            const customer =
                tagging.customer_id != null ? customerById.get(tagging.customer_id) : undefined;
            if (!customer || tagging.customer_id == null) return null;
            const quantityOut = Math.max(
                0,
                toNumber(tagging.quantity) - toNumber(tagging.returned_quantity),
            );
            if (quantityOut <= 0) return null;
            const status = String(tagging.assignment_status ?? "").toLowerCase();
            if (status !== "open" && status !== "partial") return null;
            return {
                customer_id: customer.id,
                customer_code: customer.customer_code,
                customer_name: customer.customer_name,
                quantity_out: quantityOut,
                status: status as "open" | "partial",
                expected_return_at: tagging.expected_return_at ?? null,
                tagged_at: tagging.tagged_at ?? null,
                overdue: isOverdue(tagging.assignment_status, tagging.expected_return_at, nowTime),
            };
        })
        .filter((holder): holder is NonNullable<typeof holder> => holder !== null)
        .sort((a, b) => a.customer_code.localeCompare(b.customer_code));

    const cost = toNumber(item.cost_per_item);
    const unit = unitValueFor(item, now);
    const lifeSpanRaw = item.life_span_months == null ? null : Math.floor(toNumber(item.life_span_months));
    const depreciationPct =
        cost > 0 ? Math.min(100, Math.max(0, round2((1 - unit / cost) * 100))) : 0;

    const history: AssetReportDetail["history"] = [...historyRows]
        .sort((a, b) => String(b.occurred_at ?? "").localeCompare(String(a.occurred_at ?? "")))
        .map((row) => {
            const customerId = historyCustomerIdByRow.get(row.id) ?? null;
            const customer = customerId != null ? customerById.get(customerId) : undefined;
            const event = String(row.event ?? "").toLowerCase();
            const allowed = ["registered", "tagged_to_customer", "returned", "adjusted", "retired"] as const;
            return {
                id: row.id,
                event: (allowed as readonly string[]).includes(event)
                    ? (event as (typeof allowed)[number])
                    : "adjusted",
                occurred_at: row.occurred_at,
                quantity_before: toIntOrNull(row.quantity_before),
                quantity_after: toIntOrNull(row.quantity_after),
                remarks: row.remarks ?? null,
                customer_id: customerId,
                customer_name: customer?.customer_name ?? null,
            };
        });

    return {
        item: {
            id: item.id,
            item_code: item.item_code,
            name: item.name,
            group_name: group?.group_name ?? null,
            is_retired: item.is_retired,
            last_purchase_at: item.updated_at,
            date_acquired: item.date_acquired,
            life_span_months: item.life_span_months == null ? null : item.life_span_months,
            cost_per_item: item.cost_per_item ?? 0,
        },
        tags: itemTagsOut,
        stock: { total, out, available: Math.max(0, total - out) },
        valuation: {
            unit_value: unit,
            total_value: round2(unit * total),
            is_fully_depreciated: unit === 0,
            depreciation_pct: depreciationPct,
            elapsed_months: elapsedMonths(item.date_acquired, now),
            life_span_months: lifeSpanRaw,
        },
        holders,
        history,
    };
}
