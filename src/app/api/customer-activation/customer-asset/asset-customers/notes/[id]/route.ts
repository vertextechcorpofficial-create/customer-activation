import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodError } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { UpdateNoteSchema } from "@/modules/customer-activation/customer-asset/asset-customers/types/asset-customers.schema";
import {
    deleteNote,
    getNote,
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

function parseCustomerId(value: unknown): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// customerId travels as a query param or a JSON body field; either is accepted.
function bodyCustomerId(body: unknown): number | null {
    if (body !== null && typeof body === "object") {
        const record = body as Record<string, unknown>;
        const raw = record.customerId ?? record.customer_id;
        if (raw !== undefined) return parseCustomerId(raw);
    }
    return null;
}

function queryCustomerId(request: Request): number | null {
    const url = new URL(request.url);
    return parseCustomerId(
        url.searchParams.get("customerId") ?? url.searchParams.get("customer_id"),
    );
}

export async function GET(_request: Request, { params }: RouteContext) {
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
        const note = await getNote(id);
        if (!note) {
            return NextResponse.json({ success: false, message: "Note not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: note });
    } catch (error) {
        console.error("[asset-customers] GET note failed:", error);
        return NextResponse.json(
            { success: false, message: "Could not load the note" },
            { status: 500 },
        );
    }
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

    const rawBody = await request.json().catch(() => null);
    const parsed = UpdateNoteSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid note payload", errors: fieldErrors(parsed.error) },
            { status: 400 },
        );
    }

    // Server-side ownership check — 404 (not 403) to avoid id enumeration.
    const customerId = queryCustomerId(request) ?? bodyCustomerId(rawBody);
    if (customerId === null) {
        return NextResponse.json(
            { success: false, message: "Invalid customer id" },
            { status: 400 },
        );
    }

    try {
        const existing = await getNote(id);
        if (!existing || existing.customer_id !== customerId) {
            return NextResponse.json({ success: false, message: "Note not found" }, { status: 404 });
        }
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

export async function DELETE(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    if (!cookieStore.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: raw } = await params;
    const id = parseId(raw);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid note id" }, { status: 400 });
    }

    // Server-side ownership check — 404 (not 403) to avoid id enumeration.
    const rawBody = await request.json().catch(() => null);
    const customerId = queryCustomerId(request) ?? bodyCustomerId(rawBody);
    if (customerId === null) {
        return NextResponse.json(
            { success: false, message: "Invalid customer id" },
            { status: 400 },
        );
    }

    try {
        const existing = await getNote(id);
        if (!existing || existing.customer_id !== customerId) {
            return NextResponse.json({ success: false, message: "Note not found" }, { status: 404 });
        }
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
