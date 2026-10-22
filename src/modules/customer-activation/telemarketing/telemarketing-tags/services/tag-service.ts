/**
 * Tag service — server-only.
 *
 * Single owner of every read/write against the Directus collection
 * `telemarketing_tag`. The DDL declares no `DEFAULT CURRENT_TIMESTAMP` and
 * no `ON UPDATE`, so Philippine time is written explicitly on every mutation.
 */

import type { Tag, TagCreate, TagUpdate } from "../types/tag.schema";
import { dFetch } from "../utils/directus";

const COLLECTION = "telemarketing_tag";

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
export class TagServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "TagServiceError";
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
    const status = DIRECTUS_ERROR_STATUS[first?.extensions?.code ?? ""] ?? 500;
    throw new TagServiceError(first?.message ?? "Directus request failed", status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
    return body;
}

function tagPatch(input: TagUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.tag_code !== undefined) patch.tag_code = input.tag_code.trim();
    if (input.tag_name !== undefined) patch.tag_name = input.tag_name.trim();
    if (input.color !== undefined) patch.color = input.color?.trim() ? input.color.trim() : null;
    if (input.description !== undefined)
        patch.description = input.description?.trim() ? input.description.trim() : null;
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
    return patch;
}

export interface TagPage {
    items: Tag[];
    total: number;
    page: number;
    limit: number;
}

/**
 * One page of tags, name order. Inactive ones stay listed so they can be reactivated.
 * `filter_count` (not `total_count`) is the filtered total — `total_count` is the
 * whole collection and would make every page count wrong.
 */
export async function listTags(
    opts: { page?: number; limit?: number; search?: string } = {},
): Promise<TagPage> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim() ?? "";

    const filter = search
        ? `&filter=${encodeURIComponent(
              JSON.stringify({
                  _or: [
                      { tag_name: { _icontains: search } },
                      { tag_code: { _icontains: search } },
                  ],
              }),
          )}`
        : "";

    const body = await request<Tag[]>(
        `/items/${COLLECTION}?fields=*&sort=tag_name&limit=${limit}&offset=${(page - 1) * limit}&meta=filter_count${filter}`,
    );

    return {
        items: body.data ?? [],
        total: body.meta?.filter_count ?? body.data?.length ?? 0,
        page,
        limit,
    };
}

export async function createTag(input: TagCreate, actorId: number | null): Promise<Tag> {
    const now = phNow();
    const body = await request<Tag>(`/items/${COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            tag_code: input.tag_code.trim(),
            tag_name: input.tag_name.trim(),
            color: input.color?.trim() ? input.color.trim() : null,
            description: input.description?.trim() ? input.description.trim() : null,
            is_active: input.is_active ? 1 : 0,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new TagServiceError("Tag was not created", 500);
    return body.data;
}

export async function updateTag(id: number, input: TagUpdate, actorId: number | null): Promise<Tag> {
    const body = await request<Tag>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(tagPatch(input, actorId)),
    });
    if (!body.data) throw new TagServiceError("Tag was not updated", 500);
    return body.data;
}

/** Tags are never hard-deleted — leads keep pointing at them. */
export async function deactivateTag(id: number, actorId: number | null): Promise<Tag> {
    return updateTag(id, { is_active: false }, actorId);
}
