import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CampaignUpdateSchema } from "@/modules/customer-activation/referrals/referral-campaigns/types/campaign.schema";
import {
    campaignDocSchema,
    formatCampaignIssues,
    type CampaignDoc,
} from "@/modules/customer-activation/referrals/referral-campaigns/designer/schema";
import {
    CampaignServiceError,
    updateCampaign,
    writeCampaignContent,
} from "@/modules/customer-activation/referrals/referral-campaigns/services/campaign-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

async function campaignId(params: Promise<{ id: string }>): Promise<number | null> {
    const { id } = await params;
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Update a campaign — rename, change its window, or flip `is_active` to
 * activate/deactivate. Campaigns are never hard-deleted.
 *
 * Also accepts `content_json`: the v2 canvas document as an object, or
 * `null` to clear authored content so the site falls back to
 * title/description. Content is validated server-side before writing —
 * never trust the client. Failures return 400 with `errors` keyed by node
 * path (e.g. `"nodes.abc.props"`). On success the compact serialized JSON is
 * stored and `content_version` is set to 2.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = await campaignId(params);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid campaign id" }, { status: 400 });
    }

    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const hasContent = raw !== null && typeof raw === "object" && "content_json" in raw;

    let content: CampaignDoc | null | undefined;
    if (hasContent) {
        const value = (raw as { content_json: unknown }).content_json;
        if (value === null) {
            content = null;
        } else {
            const parsedContent = campaignDocSchema.safeParse(value);
            if (!parsedContent.success) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid canvas document",
                        errors: formatCampaignIssues(parsedContent.error.issues),
                    },
                    { status: 400 },
                );
            }
            content = parsedContent.data;
        }
    }

    const { content_json: _ignored, ...metaRaw } = raw ?? {};
    void _ignored;

    // Content-only save: metadata schema requires at least one field, so skip it.
    if (hasContent && Object.keys(metaRaw).length === 0) {
        try {
            const campaign = await writeCampaignContent(
                id,
                content === null ? null : JSON.stringify(content),
                actorId(token),
            );
            return NextResponse.json({ success: true, data: campaign });
        } catch (error) {
            console.error("[referrals/referral-campaigns] PATCH content failed:", error);
            const status = error instanceof CampaignServiceError ? error.status : 500;
            const message =
                error instanceof CampaignServiceError ? error.message : "Could not save the content";
            return NextResponse.json({ success: false, message }, { status });
        }
    }

    const parsed = CampaignUpdateSchema.safeParse(hasContent ? metaRaw : raw);
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
        if (hasContent) {
            await updateCampaign(id, parsed.data, actorId(token));
            const campaign = await writeCampaignContent(
                id,
                content === null ? null : JSON.stringify(content),
                actorId(token),
            );
            return NextResponse.json({ success: true, data: campaign });
        }
        const campaign = await updateCampaign(id, parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: campaign });
    } catch (error) {
        console.error("[referrals/referral-campaigns] PATCH failed:", error);
        const status = error instanceof CampaignServiceError ? error.status : 500;
        const message =
            error instanceof CampaignServiceError ? error.message : "Could not update the campaign";
        return NextResponse.json({ success: false, message }, { status });
    }
}
