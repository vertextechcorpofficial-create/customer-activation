import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { listHistory } from "@/modules/customer-activation/customer-asset/asset-registration/services/asset-registration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, message: "Invalid asset id" }, { status: 400 });
    }

    try {
        return NextResponse.json({ success: true, data: await listHistory(id) });
    } catch (error) {
        console.error("[asset-registration] GET history failed:", error);
        return NextResponse.json({ success: false, message: "Could not load the asset history" }, { status: 500 });
    }
}
