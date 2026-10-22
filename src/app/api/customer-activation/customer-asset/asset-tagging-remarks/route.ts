import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CreateTaggingSchema } from "@/modules/customer-activation/customer-asset/asset-tagging-remarks/types/asset-tagging-remarks.schema";
import {
    TaggingUserError,
    assignToCustomer,
    listAssignments,
} from "@/modules/customer-activation/customer-asset/asset-tagging-remarks/services/asset-tagging-remarks-service";

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

export async function GET(request: Request) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const raw = new URL(request.url).searchParams.get("customerId");
    const customerId = raw === null || raw === "" ? undefined : Number(raw);
    if (customerId !== undefined && (!Number.isInteger(customerId) || customerId <= 0)) {
        return NextResponse.json({ success: false, message: "Invalid customerId" }, { status: 400 });
    }

    try {
        return NextResponse.json({
            success: true,
            data: await listAssignments(customerId ? { customerId } : undefined),
        });
    } catch (error) {
        console.error("[asset-tagging-remarks] GET failed:", error);
        return NextResponse.json({ success: false, message: "Could not load assignments" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateTaggingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid assignment payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const tagging = await assignToCustomer(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: tagging }, { status: 201 });
    } catch (error) {
        if (error instanceof TaggingUserError) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }
        console.error("[asset-tagging-remarks] POST failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not tag the asset" },
            { status: 500 },
        );
    }
}
