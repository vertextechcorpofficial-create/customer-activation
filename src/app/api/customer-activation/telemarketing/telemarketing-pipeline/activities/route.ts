import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ActivityCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/types/pipeline.schema";
import {
  createActivity,
  listByLead,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/activity-service";
import { resolveAgentId } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/claim-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vos_access_token";

/** The VOS access token for the current session, if there is one. */
async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("lead_id");
  const leadId = Number(raw);
  if (!raw || !Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ success: false, message: "lead_id is required" }, { status: 400 });
  }

  const token = await sessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ success: true, data: await listByLead(leadId) });
  } catch (e) {
    console.error("[pipeline/activities GET]", e);
    return NextResponse.json({ success: false, message: "Failed to load activities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await sessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // Activities are owned by an agent row — the session user id is not one.
  let agentId: number | null;
  try {
    agentId = await resolveAgentId(token);
  } catch (e) {
    console.error("[pipeline/activities POST]", e);
    return NextResponse.json(
      { success: false, message: "Failed to resolve the signed-in agent" },
      { status: 500 },
    );
  }
  if (agentId === null) {
    return NextResponse.json(
      { success: false, message: "No telemarketing agent registered for this user" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ActivityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const data = await createActivity(parsed.data, agentId);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof Error && e.message === "LEAD_NOT_FOUND") {
      return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
    }
    console.error("[pipeline/activities POST]", e);
    return NextResponse.json({ success: false, message: "Failed to log activity" }, { status: 500 });
  }
}
