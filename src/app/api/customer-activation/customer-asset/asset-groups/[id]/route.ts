import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { UpdateAssetGroupSchema } from "@/modules/customer-activation/customer-asset/asset-groups/types/asset-groups.schema";
import { updateGroup } from "@/modules/customer-activation/customer-asset/asset-groups/services/asset-groups-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, message: "Invalid group id" }, { status: 400 });
    }
    try {
        const body = await request.json().catch(() => null);
        const input = UpdateAssetGroupSchema.parse(body);
        const group = await updateGroup(id, input, actorId(token));
        return NextResponse.json({ success: true, data: group });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { success: false, message: "Invalid group payload", errors: error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        console.error("[asset-groups] PATCH failed:", error);
        return NextResponse.json({ success: false, message: "Could not update the group" }, { status: 500 });
    }
}
