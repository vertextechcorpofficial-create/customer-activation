import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { AgentCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-agents/types/agent.schema";
import {
    AgentServiceError,
    listAgents,
    registerAgent,
} from "@/modules/customer-activation/telemarketing/telemarketing-agents/services/agent-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const agents = await listAgents();
        return NextResponse.json({ success: true, data: agents });
    } catch (error) {
        console.error("[telemarketing/telemarketing-agents] GET failed:", error);
        const status = error instanceof AgentServiceError ? error.status : 500;
        const message = error instanceof AgentServiceError ? error.message : "Could not load agents";
        return NextResponse.json({ success: false, message }, { status });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = AgentCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Invalid agent payload",
                errors: parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
            { status: 400 },
        );
    }

    try {
        const agent = await registerAgent(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: agent }, { status: 201 });
    } catch (error) {
        console.error("[telemarketing/telemarketing-agents] POST failed:", error);
        const status = error instanceof AgentServiceError ? error.status : 500;
        const message = error instanceof AgentServiceError ? error.message : "Could not register the agent";
        return NextResponse.json({ success: false, message }, { status });
    }
}
