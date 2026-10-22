import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { UpdateAssetItemSchema } from "@/modules/customer-activation/customer-asset/asset-registration/types/asset-registration.schema";
import {
    getItem,
    updateItem,
} from "@/modules/customer-activation/customer-asset/asset-registration/services/asset-registration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function fieldErrors(error: ZodError): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        (out[key] ??= []).push(issue.message);
    }
    return out;
}

function toId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = toId((await params).id);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid asset id" }, { status: 400 });
    }

    try {
        const detail = await getItem(id);
        if (!detail) {
            return NextResponse.json({ success: false, message: "Asset not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        console.error("[asset-registration] GET detail failed:", error);
        return NextResponse.json({ success: false, message: "Could not load the asset" }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = toId((await params).id);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid asset id" }, { status: 400 });
    }

    const parsed = UpdateAssetItemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid asset payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        return NextResponse.json({ success: true, data: await updateItem(id, parsed.data, actorId(token)) });
    } catch (error) {
        // The quantity-below-outstanding guard throws a readable Error — surface it as 400.
        if (error instanceof Error && error.message.startsWith("Cannot set quantity")) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }
        console.error("[asset-registration] PATCH failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not update the asset" },
            { status: 500 },
        );
    }
}
