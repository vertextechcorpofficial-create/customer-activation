import { NextRequest, NextResponse } from "next/server";
import { LeadCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/types/lead.schema";
import {
    createLead,
    decodeUserId,
    listLeads,
} from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function numberParam(req: NextRequest, key: string): number | undefined {
    const raw = req.nextUrl.searchParams.get(key);
    if (!raw || !raw.trim()) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const data = await listLeads({
            source: req.nextUrl.searchParams.get("source") ?? undefined,
            search: req.nextUrl.searchParams.get("search") ?? undefined,
            stageId: numberParam(req, "stageId"),
            page: numberParam(req, "page") ?? 1,
            limit: numberParam(req, "limit") ?? 20,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET lead-generation leads failed:", error);
        return NextResponse.json({ success: false, message: "Failed to load leads" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const parsed = LeadCreateSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        const result = await createLead(parsed.data, decodeUserId(req.cookies.get(COOKIE_NAME)?.value ?? ""));
        if (result.duplicate) {
            return NextResponse.json(
                { success: false, message: "Duplicate lead", errors: { duplicate: result.matched } },
                { status: 409 },
            );
        }
        return NextResponse.json(
            { success: true, data: result.lead, provenance_recorded: result.provenance_recorded },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST lead-generation leads failed:", error);
        return NextResponse.json({ success: false, message: "Failed to create lead" }, { status: 500 });
    }
}
