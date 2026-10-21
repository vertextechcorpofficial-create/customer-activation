import type {
    CreateTaggingInput,
    ReturnTaggingInput,
    Tagging,
} from "../types/asset-tagging-remarks.schema";
import type {
    AssignmentView,
    AvailableItem,
    CustomerOption,
} from "../types/asset-tagging-remarks.view";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const TAGGING = "customer_asset_tagging";
const ITEM = "customer_asset_item";
const CUSTOMER = "customer";
const HISTORY = "customer_asset_history";

// Thrown for guard violations (availability, over-return). API maps these to 400.
export class TaggingUserError extends Error {}

// WHY: the tables have no DB timestamp defaults, so PH wall time is written explicitly.
export function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.DIRECTUS_STATIC_TOKEN) {
        headers.Authorization = `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`;
    }
    return headers;
}

interface DirectusEnvelope<T> {
    data?: T;
}

async function directusGet<T>(path: string): Promise<T[]> {
    const res = await fetch(`${BASE}/items/${path}`, { headers: authHeaders(), cache: "no-store" });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tagging-remarks] GET ${path} failed (${res.status}):`, text);
        throw new Error(`Could not load records (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<T[]> | null;
    return payload?.data ?? [];
}

async function directusGetOne<T>(collection: string, id: number): Promise<T> {
    const res = await fetch(`${BASE}/items/${collection}/${id}`, {
        headers: authHeaders(),
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tagging-remarks] GET ${collection}/${id} failed (${res.status}):`, text);
        throw new Error(`Record not found (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<T> | null;
    if (!payload?.data) throw new Error("Record not found (upstream 500)");
    return payload.data;
}

async function directusPost<T>(collection: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${BASE}/items/${collection}`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tagging-remarks] POST ${collection} failed (${res.status}):`, text);
        throw new Error(`Could not save the record (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<T> | null;
    if (!payload?.data) throw new Error("Could not save the record (upstream 500)");
    return payload.data;
}

async function directusPatch<T>(
    collection: string,
    id: number,
    body: Record<string, unknown>,
): Promise<T> {
    const res = await fetch(`${BASE}/items/${collection}/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tagging-remarks] PATCH ${collection}/${id} failed (${res.status}):`, text);
        throw new Error(`Could not update the record (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<T> | null;
    if (!payload?.data) throw new Error("Could not update the record (upstream 500)");
    return payload.data;
}

async function directusDelete(collection: string, id: number): Promise<void> {
    const res = await fetch(`${BASE}/items/${collection}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tagging-remarks] DELETE ${collection}/${id} failed (${res.status}):`, text);
        throw new Error(`Could not delete the record (upstream ${res.status})`);
    }
}

// Local copy of the registration valuation math — no cross-module imports.
interface AssignmentLike {
    quantity: number;
    returned_quantity: number;
}

function quantityOut(assignments: readonly AssignmentLike[]): number {
    return assignments.reduce(
        (total, row) => total + Math.max(0, row.quantity - row.returned_quantity),
        0,
    );
}

function quantityAvailable(quantity: number, assignments: readonly AssignmentLike[]): number {
    const available = quantity - quantityOut(assignments);
    return available > 0 ? available : 0;
}

interface AssetItemRow {
    id: number;
    item_code: string;
    name: string;
    quantity: number;
    is_retired: boolean | 0 | 1;
}

interface CustomerRow {
    id: number;
    customer_code: string | null;
    customer_name: string;
}

const isRetired = (value: AssetItemRow["is_retired"]): boolean => value === true || value === 1;

export async function listAssignments(filter?: { customerId?: number }): Promise<AssignmentView[]> {
    const customerFilter = filter?.customerId
        ? `&filter[customer_id][_eq]=${filter.customerId}`
        : "";
    const rows = await directusGet<Tagging>(
        `${TAGGING}?limit=-1&sort=-tagged_at${customerFilter}`,
    );
    if (rows.length === 0) return [];

    const itemIds = [...new Set(rows.map((r) => r.item_id))];
    const customerIds = [...new Set(rows.map((r) => r.customer_id))];
    const [items, customers] = await Promise.all([
        directusGet<AssetItemRow>(`${ITEM}?limit=-1&filter[id][_in]=${itemIds.join(",")}`),
        directusGet<CustomerRow>(
            `${CUSTOMER}?limit=-1&filter[id][_in]=${customerIds.join(",")}&fields=id,customer_code,customer_name`,
        ),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const now = Date.now();

    return rows.map((row) => {
        const item = itemById.get(row.item_id);
        const customer = customerById.get(row.customer_id);
        const remaining = Math.max(0, row.quantity - row.returned_quantity);
        return {
            id: row.id,
            customer_id: row.customer_id,
            customer_name: customer?.customer_name ?? `#${row.customer_id}`,
            customer_code: customer?.customer_code ?? null,
            item_id: row.item_id,
            item_code: item?.item_code ?? `#${row.item_id}`,
            item_name: item?.name ?? "Unknown item",
            quantity: row.quantity,
            returned_quantity: row.returned_quantity,
            remaining,
            remarks: row.remarks ?? null,
            tagged_at: row.tagged_at,
            expected_return_at: row.expected_return_at ?? null,
            closed_at: row.closed_at ?? null,
            condition_out: row.condition_out ?? null,
            condition_in: row.condition_in ?? null,
            return_remarks: row.return_remarks ?? null,
            assignment_status: row.assignment_status,
            overdue:
                row.assignment_status !== "returned" &&
                row.expected_return_at != null &&
                new Date(row.expected_return_at.replace(" ", "T")).getTime() < now,
        };
    });
}

export async function searchCustomers(query: string): Promise<CustomerOption[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await directusGet<CustomerRow>(
        `${CUSTOMER}?limit=20&filter[customer_name][_icontains]=${encodeURIComponent(q)}&fields=id,customer_code,customer_name,isActive`,
    );
    return rows.map((r) => ({
        id: r.id,
        customer_code: r.customer_code ?? null,
        customer_name: r.customer_name,
    }));
}

export async function listAvailableItems(): Promise<AvailableItem[]> {
    const items = await directusGet<AssetItemRow>(`${ITEM}?limit=-1&filter[is_retired][_eq]=0`);
    const active = items.filter((i) => !isRetired(i.is_retired));
    if (active.length === 0) return [];

    const outstanding = await directusGet<Tagging>(
        `${TAGGING}?limit=-1&filter[item_id][_in]=${active.map((i) => i.id).join(",")}&filter[assignment_status][_in]=open,partial&fields=id,item_id,quantity,returned_quantity,assignment_status`,
    );
    const byItem = new Map<number, AssignmentLike[]>();
    for (const row of outstanding) {
        const list = byItem.get(row.item_id) ?? [];
        list.push({ quantity: row.quantity, returned_quantity: row.returned_quantity });
        byItem.set(row.item_id, list);
    }
    return active.map((item) => ({
        id: item.id,
        item_code: item.item_code,
        name: item.name,
        quantity: item.quantity,
        quantity_available: quantityAvailable(item.quantity, byItem.get(item.id) ?? []),
    }));
}

export async function assignToCustomer(
    input: CreateTaggingInput,
    actorId: number | null,
): Promise<Tagging> {
    const item = await directusGetOne<AssetItemRow>(ITEM, input.item_id);
    if (isRetired(item.is_retired)) {
        throw new TaggingUserError(`"${item.name}" is retired and cannot be tagged out.`);
    }
    const outstanding = await directusGet<Tagging>(
        `${TAGGING}?limit=-1&filter[item_id][_eq]=${input.item_id}&filter[assignment_status][_in]=open,partial&fields=id,quantity,returned_quantity`,
    );
    const available = quantityAvailable(item.quantity, outstanding);
    if (input.quantity > available) {
        throw new TaggingUserError(
            `Only ${available} unit(s) of "${item.name}" are available; requested ${input.quantity}.`,
        );
    }

    const now = phNow();
    const tagging = await directusPost<Tagging>(TAGGING, {
        customer_id: input.customer_id,
        item_id: input.item_id,
        quantity: input.quantity,
        remarks: input.remarks?.trim() ? input.remarks.trim() : null,
        tagged_at: now,
        expected_return_at: input.expected_return_at ?? null,
        returned_quantity: 0,
        closed_at: null,
        condition_out: input.condition_out?.trim() ? input.condition_out.trim() : null,
        condition_in: null,
        return_remarks: null,
        assignment_status: "open",
        tagged_by: actorId,
        created_by: actorId,
        created_at: now,
        updated_by: actorId,
        updated_at: now,
        audit: { action: "tagged_to_customer", actor_id: actorId, at: now },
    });

    try {
        await directusPost(HISTORY, {
            item_id: input.item_id,
            event: "tagged_to_customer",
            quantity_delta: -input.quantity,
            quantity_before: available,
            quantity_after: available - input.quantity,
            payload: { customer_id: input.customer_id, expected_return_at: input.expected_return_at ?? null },
            reference_table: TAGGING,
            reference_id: tagging.id,
            remarks: tagging.remarks ?? null,
            actor_user_id: actorId,
            occurred_at: now,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
            audit: { action: "tagged_to_customer", actor_id: actorId, at: now },
        });
    } catch (historyError) {
        console.error(
            `[asset-tagging-remarks] history insert failed for tagging ${tagging.id}, rolling back tagging:`,
            historyError,
        );
        try {
            await directusDelete(TAGGING, tagging.id);
            console.error(`[asset-tagging-remarks] rolled back tagging ${tagging.id} after history failure`);
        } catch (rollbackError) {
            console.error(
                `[asset-tagging-remarks] rollback of tagging ${tagging.id} failed:`,
                rollbackError,
            );
        }
        throw historyError;
    }

    return tagging;
}

export async function returnFromCustomer(
    id: number,
    input: Omit<ReturnTaggingInput, "tagging_id">,
    actorId: number | null,
): Promise<Tagging> {
    const tagging = await directusGetOne<Tagging>(TAGGING, id);
    if (tagging.assignment_status === "returned") {
        throw new TaggingUserError("This assignment was already fully returned.");
    }
    const cumulative = tagging.returned_quantity + input.returned_quantity;
    if (cumulative > tagging.quantity) {
        throw new TaggingUserError(
            `Only ${tagging.quantity - tagging.returned_quantity} unit(s) remain to be returned.`,
        );
    }

    const now = phNow();
    const fullyReturned = cumulative >= tagging.quantity;
    const patched = await directusPatch<Tagging>(TAGGING, id, {
        returned_quantity: cumulative,
        condition_in: input.condition_in?.trim() ? input.condition_in.trim() : null,
        return_remarks: input.return_remarks?.trim() ? input.return_remarks.trim() : null,
        closed_at: fullyReturned ? now : null,
        assignment_status: fullyReturned ? "returned" : "partial",
        updated_by: actorId,
        updated_at: now,
        audit: { action: "returned", actor_id: actorId, at: now },
    });

    const item = await directusGetOne<AssetItemRow>(ITEM, tagging.item_id).catch(() => null);
    const outstanding = await directusGet<Tagging>(
        `${TAGGING}?limit=-1&filter[item_id][_eq]=${tagging.item_id}&filter[assignment_status][_in]=open,partial&fields=id,quantity,returned_quantity`,
    );
    // The patched row still reads "open/partial" upstream, so compute availability
    // against the pre-return snapshot, then add this return back.
    const availableBefore = item ? quantityAvailable(item.quantity, outstanding) : 0;

    try {
        await directusPost(HISTORY, {
            item_id: tagging.item_id,
            event: "returned",
            quantity_delta: input.returned_quantity,
            quantity_before: availableBefore,
            quantity_after: availableBefore + input.returned_quantity,
            payload: {
                returned_quantity: input.returned_quantity,
                condition_in: patched.condition_in ?? null,
                return_remarks: patched.return_remarks ?? null,
            },
            reference_table: TAGGING,
            reference_id: id,
            remarks: patched.return_remarks ?? null,
            actor_user_id: actorId,
            occurred_at: now,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
            audit: { action: "returned", actor_id: actorId, at: now },
        });
    } catch (historyError) {
        console.error(
            `[asset-tagging-remarks] return ${id} succeeded but history insert failed (no retry needed):`,
            historyError,
        );
    }

    return patched;
}
