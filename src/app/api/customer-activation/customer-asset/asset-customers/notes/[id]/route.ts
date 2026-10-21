import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { UpdateNoteSchema } from "@/modules/customer-activation/customer-asset/asset-customers/types/asset-customers.schema";
import {
    deleteNote,
    updateNote,
} from "@/modules/customer-activation/customer-asset/asset-customers/services/asset-customers-service";

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

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = parseId(raw);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid note id" }, { status: 400 });
    }

    const parsed = UpdateNoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid note payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    try {
        return NextResponse.json({
            success: true,
            data: await updateNote(id, parsed.data.body, actorId(token)),
        });
    } catch (error) {
        console.error("[asset-customers] PATCH note failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not update the note" },
            { status: 500 },
        );
    }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = parseId(raw);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid note id" }, { status: 400 });
    }

    try {
        await deleteNote(id);
        return NextResponse.json({ success: true, data: { id } });
    } catch (error) {
        console.error("[asset-customers] DELETE note failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not delete the note" },
            { status: 500 },
        );
    }
}
