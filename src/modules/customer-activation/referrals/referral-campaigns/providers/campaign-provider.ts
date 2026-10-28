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
