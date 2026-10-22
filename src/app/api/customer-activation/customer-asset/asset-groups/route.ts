import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CreateAssetGroupSchema } from "@/modules/customer-activation/customer-asset/asset-groups/types/asset-groups.schema";
import {
    createGroup,
    listGroups,
} from "@/modules/customer-activation/customer-asset/asset-groups/services/asset-groups-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const groups = await listGroups();
        return NextResponse.json({ success: true, data: groups });
    } catch (error) {
        console.error("[asset-groups] GET failed:", error);
        return NextResponse.json({ success: false, message: "Could not load groups" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json().catch(() => null);
        const input = CreateAssetGroupSchema.parse(body);
        const group = await createGroup(input, actorId(token));
        return NextResponse.json({ success: true, data: group }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { success: false, message: "Invalid group payload", errors: error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        console.error("[asset-groups] POST failed:", error);
        return NextResponse.json({ success: false, message: "Could not create the group" }, { status: 500 });
    }
}
