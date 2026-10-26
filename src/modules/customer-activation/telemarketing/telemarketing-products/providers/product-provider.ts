import type { Product, ProductCreate, ProductUpdate } from "../types/product.schema";

/**
 * Client-safe wrappers around `/api/customer-activation/telemarketing/telemarketing-products`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-products";

interface Envelope<T> {
    success: boolean;
    data?: T;
    meta?: { total: number };
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok || !body?.success) {
        throw new Error(
            body?.errors?.[0]?.message ?? body?.message ?? "Something went wrong. Please try again.",
        );
    }
    return body.data as T;
}

export function getProducts(): Promise<Product[]> {
    return request<Product[]>(BASE);
}

export function createProduct(input: ProductCreate): Promise<Product> {
    return request<Product>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(productId: number, input: ProductUpdate): Promise<Product> {
    return request<Product>(`${BASE}/${productId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** Activation state flips through PATCH — products are never hard-deleted. */
export function setProductActive(productId: number, isActive: boolean): Promise<Product> {
    return updateProduct(productId, { is_active: isActive });
}
