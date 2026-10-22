import { NextRequest, NextResponse } from "next/server";
import { listClients } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/dealer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/** The client registry. Items carry no connection secrets — safe for the browser. */
export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const data = await listClients();
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET lead-generation clients failed:", error);
        return NextResponse.json({ success: false, message: "Failed to load clients" }, { status: 500 });
    }
}
