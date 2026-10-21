import { NextRequest, NextResponse } from "next/server";
import { LeadUpdateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/types/lead.schema";
import {
    decodeUserId,
    getLead,
    updateLead,
} from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function idFrom(params: { id?: string }): number | null {
    const id = Number(params.id);
    return Number.isInteger(id) ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const leadId = idFrom(await params);
    if (leadId === null) {
        return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
    }
    try {
        const lead = await getLead(leadId);
        if (!lead) {
            return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: lead });
    } catch (error) {
        console.error("GET lead-generation lead failed:", error);
        return NextResponse.json({ success: false, message: "Failed to load the lead" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const leadId = idFrom(await params);
    if (leadId === null) {
        return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
    }
    try {
        const parsed = LeadUpdateSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        const lead = await updateLead(leadId, parsed.data, decodeUserId(req.cookies.get(COOKIE_NAME)?.value ?? ""));
        if (!lead) {
            return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: lead });
    } catch (error) {
        console.error("PATCH lead-generation lead failed:", error);
        return NextResponse.json({ success: false, message: "Failed to update the lead" }, { status: 500 });
    }
}
