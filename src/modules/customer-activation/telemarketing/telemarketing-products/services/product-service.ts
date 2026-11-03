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
    readonly field?: string;

    constructor(message: string, status = 500, field?: string) {
        super(message);
        this.name = "ProductServiceError";
        this.status = status;
        this.field = field;
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

const WEBSITE_COLLECTION = "referrals_website";

export interface ReferralWebsite {
    website_id: number;
    website_code: string;
    name: string;
    status: string;
}

/** All websites, sorted by name ascending. No writes from this module. */
export async function listWebsites(): Promise<ReferralWebsite[]> {
    const body = await request<ReferralWebsite[]>(
        `/items/${WEBSITE_COLLECTION}?fields=website_id,website_code,name,status&sort=name&limit=-1`,
    );
    return body.data ?? [];
}

async function websiteMap(): Promise<Map<number, ReferralWebsite>> {
    const sites = await listWebsites();
    return new Map(sites.map((site) => [site.website_id, site]));
}

/** Enrich a product row with its website's code and name, mapped in code. */
function withWebsite(product: Product, sites: Map<number, ReferralWebsite>): Product {
    const site = sites.get((product as Product & { website_id?: number }).website_id ?? -1);
    return {
        ...product,
        website_code: site?.website_code,
        website_name: site?.name,
    } as Product;
}

/** Fail fast with a 400 naming the field when the website is unknown. */
async function assertWebsiteExists(websiteId: number): Promise<void> {
    const sites = await websiteMap();
    if (!sites.has(websiteId)) {
        throw new ProductServiceError("Unknown website_id.", 400, "website_id");
    }
}

/**
 * Fail fast with a clear 409 when another product on the same website
 * already owns this code, instead of surfacing a raw Directus
 * unique-constraint error. `product_code` is unique per site.
 */
async function assertCodeUnique(code: string, websiteId: number, exceptId?: number): Promise<void> {
    const filter = encodeURIComponent(
        JSON.stringify({ _and: [{ product_code: { _eq: code } }, { website_id: { _eq: websiteId } }] }),
    );
    const body = await request<Product[]>(`/items/${COLLECTION}?fields=product_id&filter=${filter}`);
    const clash = (body.data ?? []).find((row) => row.product_id !== exceptId);
    if (clash) {
        const site = (await websiteMap()).get(websiteId);
        const where = site ? ` on website "${site.website_code}"` : "";
        throw new ProductServiceError(`A product with this code already exists${where}.`, 409);
    }
}

function productPatch(input: ProductUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.product_code !== undefined) patch.product_code = input.product_code.trim();
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
    if (input.website_id !== undefined) patch.website_id = input.website_id;
    return patch;
}

export interface ProductPage {
    items: Product[];
    total: number;
    page: number;
    limit: number;
}

export type ProductStatusFilter = "active" | "inactive";

function productListFilter(search: string, status?: ProductStatusFilter, websiteId?: number): string {
    const and: Array<Record<string, unknown>> = [];
    if (websiteId !== undefined) {
        and.push({ website_id: { _eq: websiteId } });
    }
    if (search) {
        and.push({
            _or: [{ product_code: { _icontains: search } }, { name: { _icontains: search } }],
        });
    }
    if (status) {
        and.push({ is_active: { _eq: status === "active" ? 1 : 0 } });
    }
    if (and.length === 0) return "";
    return `&filter=${encodeURIComponent(JSON.stringify(and.length === 1 ? and[0] : { _and: and }))}`;
}

/**
 * One page of products, active first by `sort_order`, then name.
 * `filter_count` (not `total_count`) is the filtered total — `total_count` is the
 * whole collection and would make every page count wrong.
 */
export async function listProductPage(
    opts: { page?: number; limit?: number; search?: string; status?: ProductStatusFilter; websiteId?: number } = {},
): Promise<ProductPage> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim() ?? "";

    const body = await request<Product[]>(
        `/items/${COLLECTION}?fields=*&sort=-is_active,sort_order,name&limit=${limit}&offset=${(page - 1) * limit}&meta=filter_count${productListFilter(search, opts.status, opts.websiteId)}`,
    );

    const sites = await websiteMap();
    const items = (body.data ?? []).map((item) => withWebsite(item, sites));
    return {
        items,
        total: body.meta?.filter_count ?? items.length,
        page,
        limit,
    };
}

/**
 * Every product, active first by `sort_order`, then name. Inactive ones stay
 * listed so they can be reactivated.
 */
export async function listProducts(opts: { websiteId?: number } = {}): Promise<Product[]> {
    const and: Array<Record<string, unknown>> = [];
    if (opts.websiteId !== undefined) {
        and.push({ website_id: { _eq: opts.websiteId } });
    }
    const filter =
        and.length > 0
            ? `&filter=${encodeURIComponent(JSON.stringify(and.length === 1 ? and[0] : { _and: and }))}`
            : "";
    const body = await request<Product[]>(
        `/items/${COLLECTION}?fields=*&sort=-is_active,sort_order,name&limit=-1${filter}`,
    );
    const sites = await websiteMap();
    return (body.data ?? []).map((item) => withWebsite(item, sites));
}

export async function createProduct(input: ProductCreate, actorId: number | null): Promise<Product> {
    await assertWebsiteExists(input.website_id);
    await assertCodeUnique(input.product_code.trim(), input.website_id);
    const now = phNow();
    const body = await request<Product>(`/items/${COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            product_code: input.product_code.trim(),
            name: input.name.trim(),
            description: input.description ?? null,
            sort_order: input.sort_order ?? 0,
            is_active: input.is_active ? 1 : 0,
            website_id: input.website_id,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new ProductServiceError("Product was not created", 500);
    return withWebsite(body.data, await websiteMap());
}

export async function updateProduct(
    id: number,
    input: ProductUpdate,
    actorId: number | null,
): Promise<Product> {
    if (input.website_id !== undefined) await assertWebsiteExists(input.website_id);
    if (input.product_code !== undefined || input.website_id !== undefined) {
        const current = await getProduct(id);
        await assertCodeUnique(
            (input.product_code ?? current.product_code).trim(),
            input.website_id ?? current.website_id,
            id,
        );
    }
    const body = await request<Product>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(productPatch(input, actorId)),
    });
    if (!body.data) throw new ProductServiceError("Product was not updated", 500);
    return withWebsite(body.data, await websiteMap());
}

export async function getProduct(id: number): Promise<Product> {
    const body = await request<Product>(`/items/${COLLECTION}/${id}?fields=*`);
    if (!body.data) throw new ProductServiceError("Product not found", 404);
    return withWebsite(body.data, await websiteMap());
}

/** Products are never hard-deleted — leads keep pointing at them. */
export async function deactivateProduct(id: number, actorId: number | null): Promise<Product> {
    return updateProduct(id, { is_active: false }, actorId);
}
