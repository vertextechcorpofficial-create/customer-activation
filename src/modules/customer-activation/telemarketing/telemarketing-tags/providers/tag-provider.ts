import type { Tag, TagCreate, TagUpdate } from "../types/tag.schema";

/**
 * Client-safe wrappers around `/api/customer-activation/telemarketing/telemarketing-tags`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-tags";

interface Envelope<T> {
    success: boolean;
    data?: T;
    meta?: { total: number; page: number; limit: number };
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const body = await requestEnvelope<T>(url, init);
    return body.data as T;
}

async function requestEnvelope<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
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
    return body;
}

export interface TagPageResult {
    items: Tag[];
    total: number;
    page: number;
    limit: number;
}

export function getTagsPage(params: {
    page: number;
    limit: number;
    search?: string;
}): Promise<TagPageResult> {
    const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
    });
    if (params.search?.trim()) qs.set("search", params.search.trim());
    return requestEnvelope<Tag[]>(`${BASE}?${qs.toString()}`).then((body) => ({
        items: body.data ?? [],
        total: body.meta?.total ?? body.data?.length ?? 0,
        page: body.meta?.page ?? params.page,
        limit: body.meta?.limit ?? params.limit,
    }));
}

export function getTags(): Promise<Tag[]> {
    return request<Tag[]>(`${BASE}?limit=100`);
}

export function createTag(input: TagCreate): Promise<Tag> {
    return request<Tag>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateTag(tagId: number, input: TagUpdate): Promise<Tag> {
    return request<Tag>(`${BASE}/${tagId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deactivateTag(tagId: number): Promise<Tag> {
    return request<Tag>(`${BASE}/${tagId}`, { method: "DELETE" });
}
