import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME } from "@/lib/auth-utils";
import {
    AgentServiceError,
    listSelectableUsers,
} from "@/modules/customer-activation/telemarketing/telemarketing-agents/services/agent-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only `user` search for the registration combobox — never writes. */
export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const limit = Number(searchParams.get("limit") ?? 20);

    try {
        const users = await listSelectableUsers(search, Number.isFinite(limit) ? limit : 20);
        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error("[telemarketing/telemarketing-agents/users] GET failed:", error);
        const status = error instanceof AgentServiceError ? error.status : 500;
        const message = error instanceof AgentServiceError ? error.message : "Could not load users";
        return NextResponse.json({ success: false, message }, { status });
    }
}
