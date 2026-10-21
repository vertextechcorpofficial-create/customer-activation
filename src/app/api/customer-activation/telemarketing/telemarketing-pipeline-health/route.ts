import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { ReportFilterSchema } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline-health/types/report.schema";
import { listPipelineHealth } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline-health/services/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!req.cookies.get(COOKIE_NAME)?.value) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = ReportFilterSchema.safeParse({
      stuckDays: req.nextUrl.searchParams.get("stuckDays") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const data = await listPipelineHealth({ stuckDays: parsed.data.stuckDays });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET report-pipeline-health failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load pipeline health" }, { status: 500 });
  }
}
