import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { UpdateAssetTagSchema } from "@/modules/customer-activation/customer-asset/asset-tags/types/asset-tags.schema";
import { updateTag } from "@/modules/customer-activation/customer-asset/asset-tags/services/asset-tags-service";

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

export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, message: "Invalid tag id" }, { status: 400 });
    }

    const parsed = UpdateAssetTagSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid tag payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        return NextResponse.json({ success: true, data: await updateTag(id, parsed.data, actorId(token)) });
    } catch (error) {
        console.error("[asset-tags] PATCH failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not update the tag" },
            { status: 500 },
        );
    }
}
