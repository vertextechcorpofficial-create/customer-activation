/**
 * Campaign service — server-only.
 *
 * Single owner of every read/write against the Directus collection
 * `referrals_campaign`. The DDL declares no `DEFAULT CURRENT_TIMESTAMP` and
 * no `ON UPDATE`, so Philippine time is written explicitly on every mutation.
 *
 * Campaigns are never hard-deleted — referrals keep pointing at them.
 * Removal means deactivating via `updateCampaign(id, { is_active: false })`.
 *
 * `content_json` is written only through `writeCampaignContent`, which stores
 * the compact serialized v2 canvas document (see `../designer/schema`) and
 * stamps `content_version = 2`. `null` clears authored content so the site
 * falls back to title/description.
 */

import type { Campaign, CampaignCreate, CampaignUpdate } from "../types/campaign.schema";
import { dFetch } from "../utils/directus";

const COLLECTION = "referrals_campaign";

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
export class CampaignServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "CampaignServiceError";
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
        status === 409 ? "A campaign with this code already exists." : (first?.message ?? "Directus request failed");
    throw new CampaignServiceError(message, status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
    return body;
}

/**
 * Fail fast with a clear 409 when another campaign already owns this code,
 * instead of surfacing a raw Directus unique-constraint error.
 */
async function assertCodeUnique(code: string, exceptId?: number): Promise<void> {
    const filter = encodeURIComponent(JSON.stringify({ campaign_code: { _eq: code } }));
    const body = await request<Campaign[]>(`/items/${COLLECTION}?fields=campaign_id&filter=${filter}`);
    const clash = (body.data ?? []).find((row) => row.campaign_id !== exceptId);
    if (clash) throw new CampaignServiceError("A campaign with this code already exists.", 409);
}

function campaignPatch(input: CampaignUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.campaign_code !== undefined) patch.campaign_code = input.campaign_code.trim();
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined)
        patch.description = input.description === null ? null : input.description.trim();
    if (input.starts_at !== undefined) patch.starts_at = input.starts_at;
    if (input.ends_at !== undefined) patch.ends_at = input.ends_at;
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
    return patch;
}

/**
 * Every campaign, active first by title. Inactive ones stay
 * listed so they can be reactivated.
 */
export async function listCampaigns(): Promise<Campaign[]> {
    const body = await request<Campaign[]>(
        `/items/${COLLECTION}?fields=*&sort=-is_active,title&limit=-1`,
    );
    return body.data ?? [];
}

export async function createCampaign(input: CampaignCreate, actorId: number | null): Promise<Campaign> {
    await assertCodeUnique(input.campaign_code.trim());
    const now = phNow();
    const body = await request<Campaign>(`/items/${COLLECTION}`, {
        method: "POST",
        body: JSON.stringify({
            campaign_code: input.campaign_code.trim(),
            title: input.title.trim(),
            description: input.description === null ? null : (input.description?.trim() ?? null),
            starts_at: input.starts_at ?? null,
            ends_at: input.ends_at ?? null,
            is_active: input.is_active ? 1 : 0,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new CampaignServiceError("Campaign was not created", 500);
    return body.data;
}

export async function updateCampaign(
    id: number,
    input: CampaignUpdate,
    actorId: number | null,
): Promise<Campaign> {
    if (input.campaign_code !== undefined) await assertCodeUnique(input.campaign_code.trim(), id);
    const body = await request<Campaign>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(campaignPatch(input, actorId)),
    });
    if (!body.data) throw new CampaignServiceError("Campaign was not updated", 500);
    return body.data;
}

/** Campaigns are never hard-deleted — referrals keep pointing at them. */
export async function deactivateCampaign(id: number, actorId: number | null): Promise<Campaign> {
    return updateCampaign(id, { is_active: false }, actorId);
}

/**
 * Store the author's canvas document. `serialized` is the compact
 * `JSON.stringify` of the validated v2 document (see `../designer/schema`), or
 * `null` to clear it. Always stamps `content_version = 2`.
 */
export async function writeCampaignContent(
    id: number,
    serialized: string | null,
    actorId: number | null,
): Promise<Campaign> {
    const body = await request<Campaign>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
            content_json: serialized,
            content_version: 2,
            updated_by: actorId,
            updated_at: phNow(),
        }),
    });
    if (!body.data) throw new CampaignServiceError("Campaign content was not saved", 500);
    return body.data;
}
