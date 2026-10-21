import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-utils";
import {
  getLead,
  listLeadTags,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/lead-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idFrom(params: { id?: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** One lead with its tags for the pipeline detail view. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
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
    return NextResponse.json({ success: true, data: { lead, tags: await listLeadTags(leadId) } });
  } catch (error) {
    console.error("[pipeline/leads/:id] GET failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load the lead" }, { status: 500 });
  }
}
