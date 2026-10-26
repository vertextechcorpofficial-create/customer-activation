import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ClaimSchema } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/types/pipeline.schema";
import {
  ClaimServiceError,
  claim,
  listClaimants,
  release,
  resolveAgentContext,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/claim-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vos_access_token";

/** The signed-in user's agent id and user id, or an error response. */
async function authorize(): Promise<{ agentId: number; userId: number } | NextResponse> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const ctx = await resolveAgentContext(token);
  if (ctx === null)
    return NextResponse.json(
      { success: false, message: "No telemarketing agent registered for this user" },
      { status: 403 },
    );
  return ctx;
}

function leadIdFrom(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The body is optional; when sent it must not contradict the route. */
async function claimBody(req: NextRequest, leadId: number): Promise<{ ok: true } | NextResponse> {
  const parsed = ClaimSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  if (parsed.data.lead_id !== undefined && parsed.data.lead_id !== leadId)
    return NextResponse.json({ success: false, message: "Lead id does not match the route" }, { status: 400 });
  return { ok: true };
}

/** Who is working this lead — the claimants plus the caller's own agent id. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = leadIdFrom(id);
  if (leadId === null)
    return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
  try {
    const auth = await authorize();
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({
      success: true,
      data: { agent_id: auth.agentId, claimants: await listClaimants(leadId) },
    });
  } catch (e) {
    console.error("[pipeline/leads/:id/claim GET]", e);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/** Claim the lead for the signed-in agent. Re-claiming is not an error. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = leadIdFrom(id);
  if (leadId === null)
    return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
  try {
    const auth = await authorize();
    if (auth instanceof NextResponse) return auth;
    const body = await claimBody(req, leadId);
    if (body instanceof NextResponse) return body;
    return NextResponse.json({ success: true, data: await claim(leadId, auth.agentId, auth.userId) });
  } catch (e) {
    if (e instanceof ClaimServiceError)
      return NextResponse.json({ success: false, message: e.message }, { status: e.status });
    console.error("[pipeline/leads/:id/claim POST]", e);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/** Release the signed-in agent's claim. The lead stays in the pool. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = leadIdFrom(id);
  if (leadId === null)
    return NextResponse.json({ success: false, message: "Invalid lead id" }, { status: 400 });
  try {
    const auth = await authorize();
    if (auth instanceof NextResponse) return auth;
    const body = await claimBody(req, leadId);
    if (body instanceof NextResponse) return body;
    return NextResponse.json({ success: true, data: await release(leadId, auth.agentId, auth.userId) });
  } catch (e) {
    console.error("[pipeline/leads/:id/claim DELETE]", e);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
