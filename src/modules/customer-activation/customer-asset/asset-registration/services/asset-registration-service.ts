// Server-only: owns every Directus read/write for the asset registry.
import type {
    AssetGroup,
    AssetHistory,
    AssetItem,
    AssetItemTag,
    AssetTag,
    AssignmentLine,
    CreateAssetItemInput,
    UpdateAssetItemInput,
} from "../types/asset-registration.schema";
import { quantityAvailable, quantityOut, unitValue } from "../utils/valuation";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";

const ITEM = "customer_asset_item";
const ITEM_TAG = "customer_asset_item_tag";
const TAGGING = "customer_asset_tagging";
const HISTORY = "customer_asset_history";
const GROUP = "customer_asset_group";
const TAG = "customer_asset_tag";

interface DirectusEnvelope<T> {
    data?: T;
    errors?: Array<{ message?: string }>;
}

// WHY: the tables have no DB timestamp defaults, so PH wall time is written explicitly.
export function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function toNum(value: unknown): number {
    const n = typeof value === "string" ? Number(value) : (value as number);
    return Number.isFinite(n) ? n : 0;
}

function isOn(value: unknown): boolean {
    return value === true || value === 1;
}

async function directus<T>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            ...(init?.headers ?? {}),
        },
    });
    const body = (await res.json().catch(() => null)) as DirectusEnvelope<T> | null;
    if (!res.ok) {
        throw new Error(body?.errors?.[0]?.message ?? "Directus request failed");
    }
    return body ?? {};
}

export interface EnrichedAssetItem extends AssetItem {
    group_name: string | null;
    tags: AssetTag[];
    quantity_out: number;
    quantity_available: number;
    unit_value: number;
}

export interface HoldingRow extends AssignmentLine {
    customer_id: number | null;
    expected_return: string | null;
}

export interface AssetItemDetail {
    item: AssetItem;
    group_name: string | null;
    tags: AssetTag[];
    holdings: HoldingRow[];
    history: AssetHistory[];
    quantity_out: number;
    quantity_available: number;
    unit_value: number;
    lot_value: number;
}

export interface Catalogs {
    groups: AssetGroup[];
    tags: AssetTag[];
}

function enrich(
    item: AssetItem,
    groupsById: Map<number, AssetGroup>,
    tagsById: Map<number, AssetTag>,
    itemTags: AssetItemTag[],
    taggings: HoldingRow[],
): EnrichedAssetItem {
    const tags = itemTags
        .filter((r) => r.item_id === item.id)
        .map((r) => tagsById.get(r.tag_id))
        .filter((t): t is AssetTag => Boolean(t));
    const held = taggings.filter((t) => t.item_id === item.id);
    const out = quantityOut(held);
    const cost = toNum(item.cost_per_item);
    return {
        ...item,
        group_name: item.group_id != null ? (groupsById.get(item.group_id)?.group_name ?? null) : null,
        tags,
        quantity_out: out,
        quantity_available: quantityAvailable(item.quantity, held),
        unit_value: unitValue({
            costPerItem: cost,
            lifeSpanMonths: item.life_span_months,
            dateAcquired: item.date_acquired.slice(0, 10),
        }),
    };
}

export async function listItems(): Promise<EnrichedAssetItem[]> {
    const [itemsBody, tagsBody, taggingsBody, groupsBody, allTagsBody] = await Promise.all([
        directus<AssetItem[]>(`/items/${ITEM}?limit=-1&sort=name`),
        directus<AssetItemTag[]>(`/items/${ITEM_TAG}?limit=-1&fields=id,item_id,tag_id`),
        directus<HoldingRow[]>(`/items/${TAGGING}?limit=-1&filter[assignment_status][_in]=open,partial&fields=id,item_id,quantity,returned_quantity,assignment_status`),
        directus<AssetGroup[]>(`/items/${GROUP}?limit=-1&sort=group_name&fields=id,group_name`),
        directus<AssetTag[]>(`/items/${TAG}?limit=-1&sort=tag_name&fields=id,tag_code,tag_name,color,description,is_active`),
    ]);
    const items = itemsBody.data ?? [];
    const tagsById = new Map((allTagsBody.data ?? []).map((t) => [t.id, t]));
    const groupsById = new Map((groupsBody.data ?? []).map((g) => [g.id, g]));
    const itemTags = tagsBody.data ?? [];
    const taggings = taggingsBody.data ?? [];
    return items.map((item) => enrich(item, groupsById, tagsById, itemTags, taggings));
}

async function getOutstanding(itemId: number): Promise<HoldingRow[]> {
    const body = await directus<HoldingRow[]>(
        `/items/${TAGGING}?limit=-1&filter[item_id][_eq]=${itemId}&filter[assignment_status][_in]=open,partial`,
    );
    return body.data ?? [];
}

export async function getItem(id: number): Promise<AssetItemDetail | null> {
    const itemBody = await directus<AssetItem>(`/items/${ITEM}/${id}`);
    const item = itemBody.data;
    if (!item) return null;
    const [itemTagBody, historyBody, taggingsBody, groupsBody, allTagsBody] = await Promise.all([
        directus<AssetItemTag[]>(`/items/${ITEM_TAG}?limit=-1&filter[item_id][_eq]=${id}`),
        directus<AssetHistory[]>(`/items/${HISTORY}?limit=-1&filter[item_id][_eq]=${id}&sort=-occurred_at`),
        getOutstanding(id),
        directus<AssetGroup[]>(`/items/${GROUP}?limit=-1`),
        directus<AssetTag[]>(`/items/${TAG}?limit=-1`),
    ]);
    const tagsById = new Map((allTagsBody.data ?? []).map((t) => [t.id, t]));
    const tags = (itemTagBody.data ?? [])
        .map((r) => tagsById.get(r.tag_id))
        .filter((t): t is AssetTag => Boolean(t));
    const holdings = taggingsBody;
    const history = historyBody.data ?? [];
    const out = quantityOut(holdings);
    const cost = toNum(item.cost_per_item);
    const unit = unitValue({
        costPerItem: cost,
        lifeSpanMonths: item.life_span_months,
        dateAcquired: item.date_acquired.slice(0, 10),
    });
    return {
        item,
        group_name:
            item.group_id != null
                ? ((groupsBody.data ?? []).find((g) => g.id === item.group_id)?.group_name ?? null)
                : null,
        tags,
        holdings,
        history,
        quantity_out: out,
        quantity_available: quantityAvailable(item.quantity, holdings),
        unit_value: unit,
        lot_value: Math.round(unit * item.quantity * 100) / 100,
    };
}

export async function listHistory(itemId: number): Promise<AssetHistory[]> {
    const body = await directus<AssetHistory[]>(
        `/items/${HISTORY}?limit=-1&filter[item_id][_eq]=${itemId}&sort=-occurred_at`,
    );
    return body.data ?? [];
}

function cleanText(value: string | null | undefined): string | null {
    const t = value?.trim();
    return t ? t : null;
}

export async function createItem(
    input: CreateAssetItemInput,
    actorId: number | null,
    tagIds: number[] = [],
): Promise<AssetItem> {
    const now = phNow();
    const body = await directus<AssetItem>(`/items/${ITEM}`, {
        method: "POST",
        body: JSON.stringify({
            item_code:
                input.item_code?.trim() ||
                `AST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString(36).toUpperCase()}`,
            name: input.name.trim(),
            category: cleanText(input.category),
            quantity: input.quantity,
            cost_per_item: input.cost_per_item,
            life_span_months: input.life_span_months,
            date_acquired: input.date_acquired,
            serial: cleanText(input.serial),
            rfid_code: cleanText(input.rfid_code),
            barcode: cleanText(input.barcode),
            image: input.image ?? null,
            group_id: input.group_id ?? null,
            is_retired: 0,
            remarks: cleanText(input.remarks),
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    const created = body.data;
    if (!created) throw new Error("Asset was not created");

    const uniqueTags = [...new Set(tagIds.filter((t) => Number.isInteger(t) && t > 0))];
    try {
        if (uniqueTags.length > 0) {
            await directus(`/items/${ITEM_TAG}`, {
                method: "POST",
                body: JSON.stringify(
                    uniqueTags.map((tag_id) => ({
                        item_id: created.id,
                        tag_id,
                        tagged_at: now,
                        tagged_by: actorId,
                        created_by: actorId,
                        created_at: now,
                        updated_by: actorId,
                        updated_at: now,
                    })),
                ),
            });
        }

        await directus(`/items/${HISTORY}`, {
            method: "POST",
            body: JSON.stringify({
                item_id: created.id,
                event: "registered",
                quantity_delta: created.quantity,
                quantity_before: 0,
                quantity_after: created.quantity,
                cost_before: null,
                cost_after: created.cost_per_item,
                payload: null,
                reference_table: null,
                reference_id: null,
                remarks: "Asset registered",
                actor_user_id: actorId,
                occurred_at: now,
                created_by: actorId,
                created_at: now,
                updated_by: actorId,
                updated_at: now,
            }),
        });
    } catch (error) {
        try {
            const written = await directus<AssetItemTag[]>(
                `/items/${ITEM_TAG}?limit=-1&filter[item_id][_eq]=${created.id}&fields=id`,
            );
            await Promise.all(
                (written.data ?? []).map((r) =>
                    directus(`/items/${ITEM_TAG}/${r.id}`, { method: "DELETE" }).catch(() => null),
                ),
            );
            await directus(`/items/${ITEM}/${created.id}`, { method: "DELETE" }).catch(() => null);
        } catch {
            // best-effort cleanup only
        }
        throw error;
    }
    return created;
}

export async function updateItem(
    id: number,
    input: UpdateAssetItemInput,
    actorId: number | null,
): Promise<AssetItem> {
    const currentBody = await directus<AssetItem>(`/items/${ITEM}/${id}`);
    const current = currentBody.data;
    if (!current) throw new Error("Asset was not found");

    // Guard: stock can never drop below units currently assigned out.
    if (input.quantity !== undefined) {
        const out = quantityOut(await getOutstanding(id));
        if (input.quantity < out) {
            throw new Error(
                `Cannot set quantity to ${input.quantity} — ${out} unit(s) are still assigned out. Return units before reducing stock.`,
            );
        }
    }

    const patch: Record<string, unknown> = { updated_by: actorId };
    // updated_at is the "last purchase" date — only restocking rewrites it.
    if (input.quantity !== undefined) patch.updated_at = phNow();
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.category !== undefined) patch.category = cleanText(input.category);
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.cost_per_item !== undefined) patch.cost_per_item = input.cost_per_item;
    if (input.life_span_months !== undefined) patch.life_span_months = input.life_span_months;
    if (input.date_acquired !== undefined) patch.date_acquired = input.date_acquired;
    if (input.serial !== undefined) patch.serial = cleanText(input.serial);
    if (input.rfid_code !== undefined) patch.rfid_code = cleanText(input.rfid_code);
    if (input.barcode !== undefined) patch.barcode = cleanText(input.barcode);
    if (input.image !== undefined) patch.image = input.image ?? null;
    if (input.group_id !== undefined) patch.group_id = input.group_id ?? null;
    if (input.is_retired !== undefined) patch.is_retired = input.is_retired ? 1 : 0;
    if (input.remarks !== undefined) patch.remarks = cleanText(input.remarks);

    const body = await directus<AssetItem>(`/items/${ITEM}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    if (!body.data) throw new Error("Asset was not updated");

    // Post-write guard: a concurrent tag-out may have raised units-out above the new quantity.
    if (input.quantity !== undefined) {
        const outAfter = quantityOut(await getOutstanding(id));
        if (input.quantity < outAfter) {
            try {
                await directus(`/items/${ITEM}/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ quantity: current.quantity }),
                });
            } catch {
                // best-effort revert only
            }
            throw new Error(
                `Cannot set quantity to ${input.quantity} — ${outAfter} unit(s) are still assigned out. Return units before reducing stock.`,
            );
        }
    }

    const now = phNow();
    await directus(`/items/${HISTORY}`, {
        method: "POST",
        body: JSON.stringify({
            item_id: id,
            event: "adjusted",
            quantity_delta:
                input.quantity !== undefined ? input.quantity - current.quantity : 0,
            quantity_before: current.quantity,
            quantity_after: input.quantity ?? current.quantity,
            cost_before: current.cost_per_item,
            cost_after: input.cost_per_item ?? current.cost_per_item,
            payload: null,
            reference_table: null,
            reference_id: null,
            remarks: "Asset adjusted",
            actor_user_id: actorId,
            occurred_at: now,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    return body.data;
}

export async function setItemTags(
    id: number,
    tagIds: number[],
    actorId: number | null,
): Promise<AssetItemTag[]> {
    const existingBody = await directus<AssetItemTag[]>(
        `/items/${ITEM_TAG}?limit=-1&filter[item_id][_eq]=${id}`,
    );
    const existing = existingBody.data ?? [];
    const wanted = new Set(tagIds.filter((t) => Number.isInteger(t) && t > 0));
    const now = phNow();

    const have = new Set(existing.map((r) => r.tag_id));
    const fresh = [...wanted].filter((t) => !have.has(t));
    if (fresh.length > 0) {
        await directus(`/items/${ITEM_TAG}`, {
            method: "POST",
            body: JSON.stringify(
                fresh.map((tag_id) => ({
                    item_id: id,
                    tag_id,
                    tagged_at: now,
                    tagged_by: actorId,
                    created_by: actorId,
                    created_at: now,
                    updated_by: actorId,
                    updated_at: now,
                })),
            ),
        });
    }

    const stale = existing.filter((r) => !wanted.has(r.tag_id));
    await Promise.all(
        stale.map((r) => directus(`/items/${ITEM_TAG}/${r.id}`, { method: "DELETE" })),
    );

    const after = await directus<AssetItemTag[]>(
        `/items/${ITEM_TAG}?limit=-1&filter[item_id][_eq]=${id}`,
    );
    return after.data ?? [];
}

export async function listCatalogs(): Promise<Catalogs> {
    const [groupsBody, tagsBody] = await Promise.all([
        directus<AssetGroup[]>(`/items/${GROUP}?limit=-1&sort=group_name&fields=id,group_code,group_name,description,is_active`),
        directus<AssetTag[]>(`/items/${TAG}?limit=-1&sort=tag_name&fields=id,tag_code,tag_name,color,description,is_active`),
    ]);
    return {
        groups: groupsBody.data ?? [],
        tags: (tagsBody.data ?? []).filter((t) => isOn(t.is_active)),
    };
}
