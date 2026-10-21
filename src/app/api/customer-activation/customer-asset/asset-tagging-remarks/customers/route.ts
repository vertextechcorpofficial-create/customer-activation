import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { searchCustomers } from "@/modules/customer-activation/customer-asset/asset-tagging-remarks/services/asset-tagging-remarks-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const q = new URL(request.url).searchParams.get("q") ?? "";
        return NextResponse.json({ success: true, data: await searchCustomers(q) });
    } catch (error) {
        console.error("[asset-tagging-remarks] customers GET failed:", error);
        return NextResponse.json({ success: false, message: "Could not search customers" }, { status: 500 });
    }
}
