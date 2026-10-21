import { NextRequest, NextResponse } from "next/server";
import { clientDbLeads } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/source-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const data = await clientDbLeads(req.nextUrl.searchParams.get("search") ?? undefined);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET lead-generation client-db failed:", error);
        return NextResponse.json({ success: false, message: "Failed to load client sources" }, { status: 500 });
    }
}
