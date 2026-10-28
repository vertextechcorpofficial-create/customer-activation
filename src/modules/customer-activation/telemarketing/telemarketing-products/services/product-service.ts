/**
 * Product service — server-only.
 *
 * Single owner of every read/write against the Directus collection
 * `telemarketing_products`. The DDL declares no `DEFAULT CURRENT_TIMESTAMP` and
 * no `ON UPDATE`, so Philippine time is written explicitly on every mutation.
 *
 * Products are never hard-deleted — `telemarketing_lead.product_id` references
 * them. Removal means deactivating via `updateProduct(id, { is_active: false })`.
 */

import type { Product, ProductCreate, ProductUpdate } from "../types/product.schema";
import { dFetch } from "../utils/directus";

const COLLECTION = "telemarketing_products";

interface DirectusEnvelope<T> {
    data?: T;
    meta?: { filter_count?: number };
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

/** Philippine time, written explicitly by the app. */
function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class ProductServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "ProductServiceError";
        this.status = status;
    }
}

const DIRECTUS_ERROR_STATUS: Record<string, number> = {
    INVALID_PAYLOAD: 400,
    RECORD_NOT_FOUND: 404,
    RECORD_NOT_UNIQUE: 409,
    FORBIDDEN: 403,
};

/** `dFetch` hands back the parsed error body on a non-ok response. */
function throwDirectusError(body: DirectusEnvelope<unknown>): never {
    const first = body.errors?.[0];
    const code = first?.extensions?.code ?? "";
    const status = DIRECTUS_ERROR_STATUS[code] ?? 500;
    const message =
        status === 409 ? "A product with this code already exists." : (first?.message ?? "Directus request failed");
    throw new ProductServiceError(message, status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
    return body;
}

/**
 * Fail fast with a clear 409 when another product already owns this code,
 * instead of surfacing a raw Directus unique-constraint error.
 */
async function assertCodeUnique(code: string, exceptId?: number): Promise<void> {
    const filter = encodeURIComponent(JSON.stringify({ product_code: { _eq: code } }));
    const body = await request<Product[]>(`/items/${COLLECTION}?fields=product_id&filter=${filter}`);
    const clash = (body.data ?? []).find((row) => row.product_id !== exceptId);
    if (clash) throw new ProductServiceError("A product with this code already exists.", 409);
}

function productPatch(input: ProductUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.product_code !== undefined) patch.product_code = input.product_code.trim();
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
    return patch;
}

/**
 * Every product, active first by `sort_order`, then name. Inactive ones stay
 * listed so they can be reactivated.
 */
export async function listProducts(): Promise<Product[]> {
    const body = await request<Product[]>(
        `/items/${COLLECTION}?fields=*&sort=-is_active,sort_order,name&limit=-1`,
    );
    return body.data ?? [];
}

export async function createProduct(input: ProductCreate, actorId: number | null): Promise<Product> {
    await assertCodeUnique(input.product_code.trim());
    const now = phNow();
    const body = await request<Product>(`/items/${COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            product_code: input.product_code.trim(),
            name: input.name.trim(),
            description: input.description ?? null,
            sort_order: input.sort_order ?? 0,
            is_active: input.is_active ? 1 : 0,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new ProductServiceError("Product was not created", 500);
    return body.data;
}

export async function updateProduct(
    id: number,
    input: ProductUpdate,
    actorId: number | null,
): Promise<Product> {
    if (input.product_code !== undefined) await assertCodeUnique(input.product_code.trim(), id);
    const body = await request<Product>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(productPatch(input, actorId)),
    });
    if (!body.data) throw new ProductServiceError("Product was not updated", 500);
    return body.data;
}

/** Products are never hard-deleted — leads keep pointing at them. */
export async function deactivateProduct(id: number, actorId: number | null): Promise<Product> {
    return updateProduct(id, { is_active: false }, actorId);
}
