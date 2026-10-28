import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CampaignCreateSchema } from "@/modules/customer-activation/referrals/referral-campaigns/types/campaign.schema";
import {
    createCampaign,
    listCampaigns,
    CampaignServiceError,
} from "@/modules/customer-activation/referrals/referral-campaigns/services/campaign-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const campaigns = await listCampaigns();
        return NextResponse.json({
            success: true,
            data: campaigns,
            meta: { total: campaigns.length },
        });
    } catch (error) {
        console.error("[referrals/referral-campaigns] GET failed:", error);
        const status = error instanceof CampaignServiceError ? error.status : 500;
        const message =
            error instanceof CampaignServiceError ? error.message : "Could not load campaigns";
        return NextResponse.json({ success: false, message }, { status });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = CampaignCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Invalid campaign payload",
                errors: parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
            { status: 400 },
        );
    }

    try {
        const campaign = await createCampaign(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: campaign }, { status: 201 });
    } catch (error) {
        console.error("[referrals/referral-campaigns] POST failed:", error);
        const status = error instanceof CampaignServiceError ? error.status : 500;
        const message =
            error instanceof CampaignServiceError ? error.message : "Could not create the campaign";
        return NextResponse.json({ success: false, message }, { status });
    }
}
