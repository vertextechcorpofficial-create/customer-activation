import type { Campaign, CampaignCreate, CampaignUpdate } from "../types/campaign.schema";
import type { CampaignDoc } from "../designer/schema";

/**
 * Client-safe wrappers around `/api/customer-activation/referrals/referral-campaigns`.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/referrals/referral-campaigns";

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

export function getCampaigns(): Promise<Campaign[]> {
    return request<Campaign[]>(BASE);
}

export interface CampaignPageQuery {
    /** 1-based page number. */
    page: number;
    limit: number;
    search?: string;
    status?: "all" | "active" | "inactive";
}

export interface CampaignPage {
    rows: Campaign[];
    total: number;
}

/**
 * One page of campaigns for a manual-mode table. Sends `page`/`limit`/
 * `search`/`status` so the API can page server-side once the route honors
 * them; until then the route returns the whole collection and the filter +
 * slice below keeps the table contract (current page rows only, server total).
 */
export async function getCampaignsPage(query: CampaignPageQuery): Promise<CampaignPage> {
    const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
    });
    const search = query.search?.trim();
    if (search) params.set("search", search);
    if (query.status && query.status !== "all") params.set("status", query.status);
    const res = await fetch(`${BASE}?${params.toString()}`, {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => null)) as Envelope<Campaign[]> | null;
    if (!res.ok || !body?.success) {
        throw new Error(
            body?.errors?.[0]?.message ?? body?.message ?? "Something went wrong. Please try again.",
        );
    }
    const all = body.data ?? [];
    // The route currently ignores paging params and returns everything with
    // meta.total = all.length. When it starts honoring them, data holds only
    // the requested page and meta.total stays the full count.
    const serverPaged = (body.meta?.total ?? all.length) > all.length;
    if (serverPaged) return { rows: all, total: body.meta?.total ?? all.length };
    const q = search?.toLowerCase() ?? "";
    const filtered = all.filter((campaign) => {
        if (query.status === "active" && Number(campaign.is_active) !== 1) return false;
        if (query.status === "inactive" && Number(campaign.is_active) === 1) return false;
        if (!q) return true;
        return (
            campaign.title.toLowerCase().includes(q) ||
            campaign.campaign_code.toLowerCase().includes(q)
        );
    });
    const start = (query.page - 1) * query.limit;
    return { rows: filtered.slice(start, start + query.limit), total: filtered.length };
}

export function createCampaign(input: CampaignCreate): Promise<Campaign> {
    return request<Campaign>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateCampaign(campaignId: number, input: CampaignUpdate): Promise<Campaign> {
    return request<Campaign>(`${BASE}/${campaignId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** Activation state flips through PATCH — campaigns are never hard-deleted. */
export function setCampaignActive(campaignId: number, isActive: boolean): Promise<Campaign> {
    return updateCampaign(campaignId, { is_active: isActive });
}

/** A failed content save carrying the block-path errors (`blocks[2].type`) the API returned. */
export class ContentSaveError extends Error {
    readonly errors: Array<{ field?: string; message: string }>;

    constructor(message: string, errors: Array<{ field?: string; message: string }>) {
        super(message);
        this.name = "ContentSaveError";
        this.errors = errors;
    }
}

/**
 * Save the author's canvas document. `null` clears it so the site falls
 * back to title/description. Throws `ContentSaveError` on validation failure.
 */
export async function updateCampaignContent(
    campaignId: number,
    doc: CampaignDoc | null,
): Promise<Campaign> {
    const res = await fetch(`${BASE}/${campaignId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_json: doc }),
    });
    const body = (await res.json().catch(() => null)) as Envelope<Campaign> | null;
    if (!res.ok || !body?.success) {
        throw new ContentSaveError(
            body?.errors?.[0]?.message ?? body?.message ?? "Could not save content. Please try again.",
            body?.errors ?? [],
        );
    }
    return body.data as Campaign;
}
