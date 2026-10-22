import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z, type ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CreateAssetItemSchema } from "@/modules/customer-activation/customer-asset/asset-registration/types/asset-registration.schema";
import {
    createItem,
    listItems,
} from "@/modules/customer-activation/customer-asset/asset-registration/services/asset-registration-service";

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
        return NextResponse.json({ success: true, data: await listItems() });
    } catch (error) {
        console.error("[asset-registration] GET failed:", error);
        return NextResponse.json({ success: false, message: "Could not load assets" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    let tagIds: number[] = [];
    if (raw?.tag_ids !== undefined) {
        const tagCheck = z.array(z.number().int().positive()).max(50).safeParse(raw.tag_ids);
        if (!tagCheck.success) {
            return NextResponse.json(
                { success: false, message: "Invalid tag_ids", errors: fieldErrors(tagCheck.error) },
                { status: 400 },
            );
        }
        tagIds = tagCheck.data;
    }
    const parsed = CreateAssetItemSchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid asset payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const item = await createItem(parsed.data, actorId(token), tagIds);
        return NextResponse.json({ success: true, data: item }, { status: 201 });
    } catch (error) {
        console.error("[asset-registration] POST failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not create the asset" },
            { status: 500 },
        );
    }
}
