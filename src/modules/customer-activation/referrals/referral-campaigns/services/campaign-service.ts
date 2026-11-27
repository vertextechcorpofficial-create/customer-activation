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
    readonly field?: string;

    constructor(message: string, status = 500, field?: string) {
        super(message);
        this.name = "CampaignServiceError";
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
        status === 409 ? "A campaign with this code already exists." : (first?.message ?? "Directus request failed");
    throw new CampaignServiceError(message, status);
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

/** Enrich a campaign row with its website's code and name, mapped in code. */
function withWebsite(
    campaign: Campaign,
    sites: Map<number, ReferralWebsite>,
): Campaign {
    const site = sites.get((campaign as Campaign & { website_id?: number }).website_id ?? -1);
    return {
        ...campaign,
        website_code: site?.website_code,
        website_name: site?.name,
    } as Campaign;
}

/** Fail fast with a 400 naming the field when the website is unknown. */
async function assertWebsiteExists(websiteId: number): Promise<ReferralWebsite> {
    const sites = await websiteMap();
    const site = sites.get(websiteId);
    if (!site) throw new CampaignServiceError("Unknown website_id.", 400, "website_id");
    return site;
}

/**
 * Fail fast with a clear 409 when another campaign on the same website
 * already owns this code, instead of surfacing a raw Directus
 * unique-constraint error. `campaign_code` is unique per site.
 */
async function assertCodeUnique(code: string, websiteId: number, exceptId?: number): Promise<void> {
    const filter = encodeURIComponent(
        JSON.stringify({ _and: [{ campaign_code: { _eq: code } }, { website_id: { _eq: websiteId } }] }),
    );
    const body = await request<Campaign[]>(`/items/${COLLECTION}?fields=campaign_id&filter=${filter}`);
    const clash = (body.data ?? []).find((row) => row.campaign_id !== exceptId);
    if (clash) {
        const site = (await websiteMap()).get(websiteId);
        const where = site ? ` on website "${site.website_code}"` : "";
        throw new CampaignServiceError(`A campaign with this code already exists${where}.`, 409);
    }
}

function campaignPatch(input: CampaignUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.website_id !== undefined) patch.website_id = input.website_id;
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
 *
 * Without paging options returns the whole collection (limit=-1) so existing
 * callers that read the full list keep working. With paging options returns
 * one page; `total` is the Directus `filter_count`, never the page length.
 * Pattern follows `telemarketing-tags/services/tag-service.ts` (`listTags`).
 */
export interface CampaignPage {
    items: Campaign[];
    total: number;
    page: number;
    limit: number;
}

export async function listCampaigns(opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "active" | "inactive";
    paged?: boolean;
    websiteId?: number;
} = {}): Promise<CampaignPage> {
    const paged = opts.paged ?? (opts.page !== undefined || opts.limit !== undefined);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim() ?? "";

    const and: Record<string, unknown>[] = [];
    if (opts.websiteId !== undefined) and.push({ website_id: { _eq: opts.websiteId } });
    if (opts.status === "active") and.push({ is_active: { _eq: 1 } });
    else if (opts.status === "inactive") and.push({ is_active: { _eq: 0 } });
    if (search) {
        and.push({
            _or: [{ campaign_code: { _icontains: search } }, { title: { _icontains: search } }],
        });
    }
    const filter =
        and.length > 0
            ? `&filter=${encodeURIComponent(JSON.stringify(and.length === 1 ? and[0] : { _and: and }))}`
            : "";

    const paging = paged ? `limit=${limit}&offset=${(page - 1) * limit}` : "limit=-1";
    const body = await request<Campaign[]>(
        `/items/${COLLECTION}?fields=*&sort=-is_active,title&${paging}&meta=filter_count${filter}`,
    );
    const items = body.data ?? [];
    const sites = await websiteMap();
    return {
        items: items.map((item) => withWebsite(item, sites)),
        total: body.meta?.filter_count ?? items.length,
        page,
        limit: paged ? limit : items.length,
    };
}

export async function getCampaign(id: number): Promise<Campaign> {
    const body = await request<Campaign>(`/items/${COLLECTION}/${id}?fields=*`);
    if (!body.data) throw new CampaignServiceError("Campaign not found", 404);
    return withWebsite(body.data, await websiteMap());
}

export async function createCampaign(input: CampaignCreate, actorId: number | null): Promise<Campaign> {
    await assertWebsiteExists(input.website_id);
    await assertCodeUnique(input.campaign_code.trim(), input.website_id);
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
            website_id: input.website_id,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new CampaignServiceError("Campaign was not created", 500);
    return withWebsite(body.data, await websiteMap());
}

export async function updateCampaign(
    id: number,
    input: CampaignUpdate,
    actorId: number | null,
): Promise<Campaign> {
    if (input.website_id !== undefined) await assertWebsiteExists(input.website_id);
    if (input.campaign_code !== undefined) {
        const websiteId =
            input.website_id ?? (await getCampaign(id)).website_id;
        await assertCodeUnique(input.campaign_code.trim(), websiteId, id);
    } else if (input.website_id !== undefined) {
        const current = await getCampaign(id);
        await assertCodeUnique(
            (current.campaign_code ?? "").trim(),
            input.website_id,
            id,
        );
    }
    const body = await request<Campaign>(`/items/${COLLECTION}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(campaignPatch(input, actorId)),
    });
    if (!body.data) throw new CampaignServiceError("Campaign was not updated", 500);
    return withWebsite(body.data, await websiteMap());
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
    return withWebsite(body.data, await websiteMap());
}
