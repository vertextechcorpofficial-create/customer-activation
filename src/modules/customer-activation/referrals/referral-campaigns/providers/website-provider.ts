/**
 * Client-safe reader for the referral websites catalogue.
 *
 * Per-module copy by project rule: no cross-module imports. The sibling
 * telemarketing-products module owns an identical copy.
 */

const BASE = "/api/customer-activation/referrals/referral-campaigns/websites";

export interface ReferralWebsite {
    website_id: number;
    website_code: string;
    name: string;
    status: string;
}

interface Envelope {
    success: boolean;
    data?: ReferralWebsite[];
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

export async function getWebsites(): Promise<ReferralWebsite[]> {
    const res = await fetch(BASE, {
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => null)) as Envelope | null;
    if (!res.ok || !body?.success) {
        throw new Error(
            body?.errors?.[0]?.message ?? body?.message ?? "Could not load websites. Please try again.",
        );
    }
    return (body.data ?? [])
        .filter((site) => site.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name));
}
