import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CreateAssetTagSchema } from "@/modules/customer-activation/customer-asset/asset-tags/types/asset-tags.schema";
import {
    createTag,
    listTags,
} from "@/modules/customer-activation/customer-asset/asset-tags/services/asset-tags-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        return NextResponse.json({ success: true, data: await listTags() });
    } catch (error) {
        console.error("[asset-tags] GET failed:", error);
        return NextResponse.json({ success: false, message: "Could not load tags" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateAssetTagSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid tag payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const tag = await createTag(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: tag }, { status: 201 });
    } catch (error) {
        console.error("[asset-tags] POST failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not create the tag" },
            { status: 500 },
        );
    }
}
