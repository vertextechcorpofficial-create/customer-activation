import { NextRequest, NextResponse } from "next/server";
import {
    listReferralAccounts,
    ReferralAccountServiceError,
    type ReferralAccountStatus,
} from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/referral-account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

const STATUSES: ReadonlySet<string> = new Set(["pending_verification", "active", "suspended"]);

/** Read-only referral-account source for Lead Generation. No writes. */
export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const params = req.nextUrl.searchParams;
    const rawPage = params.get("page") ?? "1";
    const rawLimit = params.get("limit") ?? "20";
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    if (!Number.isInteger(page) || page < 1) {
        return NextResponse.json({ success: false, message: "Invalid page" }, { status: 400 });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return NextResponse.json({ success: false, message: "Invalid limit" }, { status: 400 });
    }
    const rawStatus = params.get("status") ?? undefined;
    if (rawStatus !== undefined && !STATUSES.has(rawStatus)) {
        return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
    }
    try {
        const result = await listReferralAccounts({
            page,
            limit,
            search: params.get("search") ?? undefined,
            status: rawStatus as ReferralAccountStatus | undefined,
        });
        return NextResponse.json({
            success: true,
            data: result.items,
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                total_pages: Math.ceil(result.total / result.limit),
            },
        });
    } catch (error) {
        console.error("GET lead-generation referral-accounts failed:", error);
        const status = error instanceof ReferralAccountServiceError ? error.status : 500;
        const message = error instanceof ReferralAccountServiceError ? error.message : "Failed to load referral accounts";
        return NextResponse.json({ success: false, message }, { status });
    }
}
