import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { ReportPeriodSchema } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/types/report.schema";
import { getAgentHistory } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/services/agent-history-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function sessionToken(): Promise<string | null> {
    return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const token = await sessionToken();
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agentId = Number(id);
    if (!Number.isInteger(agentId) || agentId <= 0) {
        return NextResponse.json({ success: false, message: "Invalid agent id" }, { status: 400 });
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
        const data = await getAgentHistory(agentId, parsed.data);
        if (!data) {
            return NextResponse.json({ success: false, message: "Agent not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data });
    } catch (e) {
        console.error("[telemarketing/telemarketing-agent-report/agents GET]", e);
        return NextResponse.json(
            { success: false, message: "Failed to load agent history" },
            { status: 500 },
        );
    }
}
