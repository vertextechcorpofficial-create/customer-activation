import { NextRequest, NextResponse } from "next/server";
import { LeadStageMoveSchema } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/types/pipeline.schema";
import { moveStage } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/move-service";
import { resolveAgentId } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/claim-service";
import { decodeJwtPayload } from "@/lib/auth-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function idFrom(params: { id?: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

/** Service errors carry a code prefix that maps to the HTTP status. */
function statusFor(message: string): number {
  if (message.startsWith("VALIDATION_FAILED")) return 400;
  if (message.startsWith("NOT_FOUND")) return 404;
  return 500;
}

function messageFor(message: string): string {
  const separator = message.indexOf(": ");
  return separator === -1 ? message : message.slice(separator + 2);
}

function userIdFrom(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  for (const key of ["id", "user_id", "sub"]) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") continue;
    const id = Number(value);
    if (Number.isInteger(id)) return id;
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!req.cookies.get(COOKIE_NAME)?.value) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const leadId = idFrom(await params);
  if (leadId === null) {
    return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
  }
  try {
    const parsed = LeadStageMoveSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    // The activity note is owned by a telemarketing agent, not by the user.
    const agentId = await resolveAgentId(token);
    if (agentId === null) {
      return NextResponse.json(
        { success: false, message: "No telemarketing agent registered for this user" },
        { status: 403 },
      );
    }
    const result = await moveStage(leadId, parsed.data.stage_id, {
      lostReason: parsed.data.lost_reason,
      note: parsed.data.note,
      userId: userIdFrom(token),
      agentId,
    });
    return NextResponse.json({ success: true, data: { lead: result.lead, conversion: result.conversion } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to move the lead";
    console.error("POST pipeline lead stage failed:", error);
    return NextResponse.json({ success: false, message: messageFor(raw) }, { status: statusFor(raw) });
  }
}
