import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { listCustomers } from "@/modules/customer-activation/customer-asset/asset-customers/services/asset-customers-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get("status");
        const status =
            statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;
        const page = Math.max(0, Math.floor(Number(searchParams.get("page") ?? "0") || 0));
        const pageSizeRaw = Math.floor(Number(searchParams.get("pageSize") ?? "10") || 10);
        const pageSize = Math.min(50, Math.max(10, pageSizeRaw));
        return NextResponse.json({
            success: true,
            data: await listCustomers({
                q: searchParams.get("q") ?? undefined,
                onlyWithAssets: searchParams.get("withAssets") === "1",
                status,
                page,
                pageSize,
            }),
        });
    } catch (error) {
        console.error("[asset-customers] GET failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not load customers" },
            { status: 500 },
        );
    }
}
