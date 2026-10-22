import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { valuation } from "@/modules/customer-activation/customer-asset/asset-reports/services/asset-reports-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const asOf = new URL(request.url).searchParams.get("asOf");
    if (asOf !== null && (!ISO_DATE.test(asOf) || Number.isNaN(Date.parse(asOf)))) {
        return NextResponse.json(
            { success: false, message: "Invalid asOf date (expected YYYY-MM-DD)" },
            { status: 400 },
        );
    }

    try {
        return NextResponse.json({ success: true, data: await valuation(asOf ?? undefined) });
    } catch (error) {
        console.error("[asset-reports] valuation GET failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not load the valuation report" },
            { status: 500 },
        );
    }
}
