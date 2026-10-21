import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { listLeads } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/lead-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LeadListQuerySchema = z.object({
  stageId: z.coerce.number().int().positive().optional(),
  source: z.string().min(1).max(64).optional(),
  search: z.string().max(191).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Leads for the pipeline list view, newest first. */
export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const query = req.nextUrl.searchParams;
  const parsed = LeadListQuerySchema.safeParse({
    stageId: query.get("stageId") || undefined,
    source: query.get("source") || undefined,
    search: query.get("search") || undefined,
    page: query.get("page") || undefined,
    limit: query.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  try {
    const data = await listLeads(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[pipeline/leads] GET failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load leads" }, { status: 500 });
  }
}
