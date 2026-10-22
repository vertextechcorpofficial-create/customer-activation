import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import { getCustomer } from "@/modules/customer-activation/customer-asset/asset-customers/services/asset-customers-service";

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
        return NextResponse.json({ success: false, message: "Invalid customer id" }, { status: 400 });
    }

    try {
        const detail = await getCustomer(id);
        if (!detail) {
            return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        console.error("[asset-customers] GET detail failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not load the customer" },
            { status: 500 },
        );
    }
}
