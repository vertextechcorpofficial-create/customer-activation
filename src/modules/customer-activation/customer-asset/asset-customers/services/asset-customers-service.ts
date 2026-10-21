// Server-only: owns every Directus read/write for asset-customers.
// READ-ONLY on `customer` — this module never POSTs/PATCHes/DELETEs it.
import type { Note } from "../types/asset-customers.schema";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";
const CUSTOMER_COLLECTION = "customer";
const TAGGING_COLLECTION = "customer_asset_tagging";
const ITEM_COLLECTION = "customer_asset_item";
const NOTE_COLLECTION = "customer_asset_note";

interface DirectusEnvelope<T> {
    data?: T;
    errors?: Array<{ message?: string }>;
}

// WHY: DDL has no default timestamps, so PH wall time is stamped explicitly.
export function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
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

function toNumber(value: unknown): number {
    const n = typeof value === "string" ? Number(value) : (value as number);
    return Number.isFinite(n) ? n : 0;
}

// `isActive` arrives as boolean or 0/1 depending on the driver — normalise.
// Accepts `is_active` too: the zod schema names the field `is_active` while
// the table description calls it `isActive`.
export function isActiveCustomer(row: Record<string, unknown>): boolean {
    const value = row.isActive ?? row.is_active;
    return value === true || value === 1 || value === "1";
}

function isOpenStatus(status: unknown): boolean {
    const s = String(status ?? "").toLowerCase();
    return s === "open" || s === "partial";
}

export interface CustomerListRow {
    id: number;
    customer_code: string;
    customer_name: string;
    isActive: boolean;
    assetsHeld: number;
    openAssignments: number;
}

export interface CustomerCounts {
    assetsHeld: number;
    openAssignments: number;
}

// One tagging fetch, grouped in JS: open/partial rows contribute
// quantity−returned to assetsHeld and one open assignment each.
export async function countsByCustomer(): Promise<Map<number, CustomerCounts>> {
    const body = await directus<
        Array<{
            customer_id: number;
            quantity: number | string;
            returned_quantity: number | string;
            assignment_status: string;
        }>
    >(
        `/items/${TAGGING_COLLECTION}?limit=-1&fields=customer_id,quantity,returned_quantity,assignment_status`,
    );
    const counts = new Map<number, CustomerCounts>();
    for (const row of body.data ?? []) {
        const id = Number(row.customer_id);
        if (!Number.isFinite(id)) continue;
        const entry = counts.get(id) ?? { assetsHeld: 0, openAssignments: 0 };
        if (isOpenStatus(row.assignment_status)) {
            entry.assetsHeld += Math.max(0, toNumber(row.quantity) - toNumber(row.returned_quantity));
            entry.openAssignments += 1;
        } else if (!counts.has(id)) {
            counts.set(id, entry);
            continue;
        }
        counts.set(id, entry);
    }
    return counts;
}

export async function listCustomers(options?: {
    q?: string;
    onlyWithAssets?: boolean;
}): Promise<CustomerListRow[]> {
    const q = options?.q?.trim();
    const params = new URLSearchParams({
        "sort": "customer_name",
        "limit": "-1",
        "fields": "id,customer_code,customer_name,isActive",
    });
    // Directus filter params use bracket syntax; URLSearchParams encodes them.
    const filterKey = "filter[customer_name][_icontains]";
    const base = `/items/${CUSTOMER_COLLECTION}?${params.toString()}`;
    const url = q ? `${base}&${encodeURIComponent(filterKey)}=${encodeURIComponent(q)}` : base;
    const [body, counts] = await Promise.all([
        directus<Array<Record<string, unknown>>>(url),
        countsByCustomer(),
    ]);
    const rows: CustomerListRow[] = (body.data ?? [])
        .filter((row) => Number.isFinite(Number(row.id)))
        .map((row) => {
            const id = Number(row.id);
            const count = counts.get(id);
            return {
                id,
                customer_code: String(row.customer_code ?? ""),
                customer_name: String(row.customer_name ?? ""),
                isActive: isActiveCustomer(row),
                assetsHeld: count?.assetsHeld ?? 0,
                openAssignments: count?.openAssignments ?? 0,
            };
        });
    // "with assets only" keeps ids present in taggings (any tagging row).
    return options?.onlyWithAssets ? rows.filter((row) => counts.has(row.id)) : rows;
}

export interface Holding {
    taggingId: number;
    itemCode: string;
    itemName: string;
    quantity: number;
    returnedQuantity: number;
    held: number;
    status: string;
    expectedReturnAt: string | null;
    taggedAt: string | null;
}

export interface AssignmentRecord extends Holding {
    closedAt: string | null;
}

export interface CustomerDetail {
    customer: { id: number; customer_code: string; customer_name: string; isActive: boolean };
    holdings: Holding[];
    history: AssignmentRecord[];
    notes: Note[];
    assetsHeld: number;
    openAssignments: number;
}

interface TaggingRow {
    id: number;
    customer_id: number;
    item_id: number | null;
    quantity: number | string;
    returned_quantity: number | string;
    assignment_status: string;
    tagged_at: string | null;
    expected_return_at: string | null;
    closed_at: string | null;
}

export async function getCustomer(id: number): Promise<CustomerDetail | null> {
    const [customerBody, taggingBody, notes] = await Promise.all([
        directus<Record<string, unknown>>(
            `/items/${CUSTOMER_COLLECTION}/${id}?fields=id,customer_code,customer_name,isActive`,
        ).catch(() => null),
        directus<TaggingRow[]>(
            `/items/${TAGGING_COLLECTION}?limit=-1&sort=-tagged_at&filter[customer_id][_eq]=${id}&fields=id,customer_id,item_id,quantity,returned_quantity,assignment_status,tagged_at,expected_return_at,closed_at`,
        ),
        listNotes(id),
    ]);
    if (!customerBody?.data) return null;
    const raw = customerBody.data;
    const taggings = taggingBody?.data ?? [];

    const itemIds = [...new Set(taggings.map((t) => t.item_id).filter((v): v is number => typeof v === "number" && Number.isFinite(v)))];
    const itemMap = new Map<number, { item_code: string; name: string }>();
    if (itemIds.length > 0) {
        const itemsBody = await directus<Array<{ id: number; item_code: string; name: string }>>(
            `/items/${ITEM_COLLECTION}?limit=-1&filter[id][_in]=${itemIds.join(",")}&fields=id,item_code,name`,
        );
        for (const item of itemsBody.data ?? []) itemMap.set(item.id, item);
    }

    const toRecord = (t: TaggingRow): AssignmentRecord => {
        const item = t.item_id != null ? itemMap.get(t.item_id) : undefined;
        const quantity = toNumber(t.quantity);
        const returnedQuantity = toNumber(t.returned_quantity);
        return {
            taggingId: t.id,
            itemCode: item?.item_code ?? "—",
            itemName: item?.name ?? "Unknown item",
            quantity,
            returnedQuantity,
            held: Math.max(0, quantity - returnedQuantity),
            status: t.assignment_status,
            expectedReturnAt: t.expected_return_at,
            taggedAt: t.tagged_at,
            closedAt: t.closed_at,
        };
    };
    // Directus sorted newest-first; holdings keep only open/partial.
    const history = taggings.map(toRecord);
    const holdings = history.filter((h) => isOpenStatus(h.status));

    return {
        customer: {
            id: Number(raw.id),
            customer_code: String(raw.customer_code ?? ""),
            customer_name: String(raw.customer_name ?? ""),
            isActive: isActiveCustomer(raw),
        },
        holdings,
        history,
        notes,
        assetsHeld: holdings.reduce((sum, h) => sum + h.held, 0),
        openAssignments: holdings.length,
    };
}

export async function listNotes(customerId: number): Promise<Note[]> {
    const body = await directus<Note[]>(
        `/items/${NOTE_COLLECTION}?limit=-1&sort=-created_at&filter[customer_id][_eq]=${customerId}&fields=id,customer_id,body,created_by,created_at,updated_by,updated_at`,
    );
    return body.data ?? [];
}

export async function createNote(customerId: number, body: string, actorId: number | null): Promise<Note> {
    const now = phNow();
    const res = await directus<Note>(`/items/${NOTE_COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            customer_id: customerId,
            body: body.trim(),
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!res.data) throw new Error("Note was not created");
    return res.data;
}

export async function updateNote(id: number, body: string, actorId: number | null): Promise<Note> {
    const res = await directus<Note>(`/items/${NOTE_COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: body.trim(), updated_by: actorId, updated_at: phNow() }),
    });
    if (!res.data) throw new Error("Note was not updated");
    return res.data;
}

export async function deleteNote(id: number): Promise<void> {
    await directus(`/items/${NOTE_COLLECTION}/${id}`, { method: "DELETE" });
}
