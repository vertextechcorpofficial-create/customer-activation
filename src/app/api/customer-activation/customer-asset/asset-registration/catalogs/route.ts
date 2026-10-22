import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { listCatalogs } from "@/modules/customer-activation/customer-asset/asset-registration/services/asset-registration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        return NextResponse.json({ success: true, data: await listCatalogs() });
    } catch (error) {
        console.error("[asset-registration] GET catalogs failed:", error);
        return NextResponse.json({ success: false, message: "Could not load pickers" }, { status: 500 });
    }
}
