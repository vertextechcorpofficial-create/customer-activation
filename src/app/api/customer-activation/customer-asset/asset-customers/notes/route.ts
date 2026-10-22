import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { CreateNoteSchema } from "@/modules/customer-activation/customer-asset/asset-customers/types/asset-customers.schema";
import {
    createNote,
    listNotes,
} from "@/modules/customer-activation/customer-asset/asset-customers/services/asset-customers-service";

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

    const customerId = Number(new URL(request.url).searchParams.get("customerId"));
    if (!Number.isInteger(customerId) || customerId <= 0) {
        return NextResponse.json({ success: false, message: "Invalid customer id" }, { status: 400 });
    }

    try {
        return NextResponse.json({ success: true, data: await listNotes(customerId) });
    } catch (error) {
        console.error("[asset-customers] GET notes failed:", error);
        return NextResponse.json({ success: false, message: "Could not load notes" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateNoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid note payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        const note = await createNote(parsed.data.customer_id, parsed.data.body, actorId(token));
        return NextResponse.json({ success: true, data: note }, { status: 201 });
    } catch (error) {
        console.error("[asset-customers] POST note failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not create the note" },
            { status: 500 },
        );
    }
}
