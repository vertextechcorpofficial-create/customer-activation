import type {
    AssetTag,
    CreateAssetTagInput,
    UpdateAssetTagInput,
} from "../types/asset-tags.schema";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const COLLECTION = "customer_asset_tag";

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.DIRECTUS_STATIC_TOKEN) {
        headers.Authorization = `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`;
    }
    return headers;
}

// WHY: the table has no DB timestamp defaults, so PH wall time is written explicitly.
function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

interface DirectusEnvelope<T> {
    data?: T;
}

export async function listTags(): Promise<AssetTag[]> {
    const res = await fetch(`${BASE}/items/${COLLECTION}?sort=tag_name&limit=-1&fields=id,tag_code,tag_name,color,description,is_active,created_at,updated_at`, {
        headers: authHeaders(),
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tags] listTags failed (${res.status}):`, text);
        throw new Error(`Could not load tags (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<AssetTag[]> | null;
    return payload?.data ?? [];
}

export async function createTag(
    input: CreateAssetTagInput,
    actorId: number | null,
): Promise<AssetTag> {
    const now = phNow();
    const res = await fetch(`${BASE}/items/${COLLECTION}`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify({
            ...input,
            is_active: input.is_active ?? true ? 1 : 0,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tags] createTag failed (${res.status}):`, text);
        throw new Error(`Could not create the tag (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<AssetTag> | null;
    if (!payload?.data) throw new Error("Could not create the tag (upstream 500)");
    return payload.data;
}

export async function updateTag(
    id: number,
    input: UpdateAssetTagInput,
    actorId: number | null,
): Promise<AssetTag> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.tag_code !== undefined) {
        patch.tag_code = input.tag_code;
    }
    if (input.tag_name !== undefined) {
        patch.tag_name = input.tag_name;
    }
    if (input.color !== undefined) {
        patch.color = input.color;
    }
    if (input.description !== undefined) {
        patch.description = input.description;
    }
    if (input.is_active !== undefined) {
        patch.is_active = input.is_active ? 1 : 0;
    }
    const res = await fetch(`${BASE}/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`[asset-tags] updateTag failed (${res.status}):`, text);
        throw new Error(`Could not update the tag (upstream ${res.status})`);
    }
    const payload = (await res.json().catch(() => null)) as DirectusEnvelope<AssetTag> | null;
    if (!payload?.data) throw new Error("Could not update the tag (upstream 500)");
    return payload.data;
}
