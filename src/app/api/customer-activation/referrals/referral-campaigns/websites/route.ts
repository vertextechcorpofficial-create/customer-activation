import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import {
    listWebsites,
    CampaignServiceError,
} from "@/modules/customer-activation/referrals/referral-campaigns/services/campaign-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every referral website, sorted by name ascending. All statuses are
 * returned so the caller can choose to hide inactive ones. Read-only.
 */
export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const sites = await listWebsites();
        return NextResponse.json({
            success: true,
            data: sites,
            meta: { total: sites.length },
        });
    } catch (error) {
        console.error("[referrals/referral-campaigns/websites] GET failed:", error);
        const status = error instanceof CampaignServiceError ? error.status : 500;
        const message =
            error instanceof CampaignServiceError ? error.message : "Could not load websites";
        return NextResponse.json({ success: false, message }, { status });
    }
}
