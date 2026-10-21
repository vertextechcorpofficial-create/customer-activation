import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { ReturnTaggingSchema } from "@/modules/customer-activation/customer-asset/asset-tagging-remarks/types/asset-tagging-remarks.schema";
import {
    TaggingUserError,
    returnFromCustomer,
} from "@/modules/customer-activation/customer-asset/asset-tagging-remarks/services/asset-tagging-remarks-service";

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
        return NextResponse.json({ success: false, message: "Invalid assignment id" }, { status: 400 });
    }

    const parsed = ReturnTaggingSchema.safeParse({ ...(await request.json().catch(() => null)), tagging_id: id });
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid return payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const input = {
            returned_quantity: parsed.data.returned_quantity,
            condition_in: parsed.data.condition_in,
            return_remarks: parsed.data.return_remarks,
        };
        return NextResponse.json({
            success: true,
            data: await returnFromCustomer(id, input, actorId(token)),
        });
    } catch (error) {
        if (error instanceof TaggingUserError) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }
        console.error("[asset-tagging-remarks] PATCH failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not record the return" },
            { status: 500 },
        );
    }
}
