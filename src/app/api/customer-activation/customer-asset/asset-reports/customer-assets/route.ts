import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { customerAssets } from "@/modules/customer-activation/customer-asset/asset-reports/services/asset-reports-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        return NextResponse.json({ success: true, data: await customerAssets() });
    } catch (error) {
        console.error("[asset-reports] customer-assets GET failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not load the customer assets report" },
            { status: 500 },
        );
    }
}
