import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { SetAssetItemTagsSchema } from "@/modules/customer-activation/customer-asset/asset-registration/types/asset-registration.schema";
import { setItemTags } from "@/modules/customer-activation/customer-asset/asset-registration/services/asset-registration-service";

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

export async function PUT(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, message: "Invalid asset id" }, { status: 400 });
    }

    const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = SetAssetItemTagsSchema.safeParse({ item_id: id, tag_ids: rawBody?.tag_ids });
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid tags payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const rows = await setItemTags(id, parsed.data.tag_ids, actorId(token));
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error("[asset-registration] PUT tags failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not update the asset tags" },
            { status: 500 },
        );
    }
}
