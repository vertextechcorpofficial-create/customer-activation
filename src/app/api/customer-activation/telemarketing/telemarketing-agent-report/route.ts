import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { ReportPeriodSchema } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/types/report.schema";
import { listPerUserReport } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/services/per-user-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sessionToken(): Promise<string | null> {
    return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

export async function GET(req: NextRequest) {
    const token = await sessionToken();
    if (!token) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 },
        );
    }

    const raw = req.nextUrl.searchParams.get("period") ?? "mtd";
    const parsed = ReportPeriodSchema.safeParse(raw);
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
        const data = await listPerUserReport({ period: parsed.data });
        return NextResponse.json({ success: true, data });
    } catch (e) {
        console.error("[telemarketing/telemarketing-agent-report GET]", e);
        return NextResponse.json(
            { success: false, message: "Failed to load per-user report" },
            { status: 500 },
        );
    }
}
