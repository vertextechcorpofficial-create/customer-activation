// Server-only: owns every Directus read/write for `customer_asset_group`.
import type {
    AssetGroup,
    CreateAssetGroupInput,
    UpdateAssetGroupInput,
} from "../types/asset-groups.schema";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN ?? "";
const COLLECTION = "customer_asset_group";

interface DirectusEnvelope<T> {
    data?: T;
    errors?: Array<{ message?: string }>;
}

// WHY: DDL has no default timestamp, so PH wall time is stamped explicitly.
function phNow(): string {
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

export async function listGroups(): Promise<AssetGroup[]> {
    const body = await directus<AssetGroup[]>(`/items/${COLLECTION}?sort=group_name&limit=-1`);
    return body.data ?? [];
}

export async function createGroup(input: CreateAssetGroupInput, actorId: number | null): Promise<AssetGroup> {
    const now = phNow();
    const body = await directus<AssetGroup>(`/items/${COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            group_code: input.group_code.trim(),
            group_name: input.group_name.trim(),
            description: input.description?.trim() ? input.description.trim() : null,
            is_active: input.is_active ?? true ? 1 : 0,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) {
        throw new Error("Group was not created");
    }
    return body.data;
}

export async function updateGroup(id: number, input: UpdateAssetGroupInput, actorId: number | null): Promise<AssetGroup> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.group_code !== undefined) {
        patch.group_code = input.group_code.trim();
    }
    if (input.group_name !== undefined) {
        patch.group_name = input.group_name.trim();
    }
    if (input.description !== undefined) {
        patch.description = input.description?.trim() ? input.description.trim() : null;
    }
    if (input.is_active !== undefined) {
        patch.is_active = input.is_active ? 1 : 0;
    }
    const body = await directus<AssetGroup>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    if (!body.data) {
        throw new Error("Group was not updated");
    }
    return body.data;
}
