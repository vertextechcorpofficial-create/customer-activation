import { NextRequest, NextResponse } from "next/server";
import { ProspectCreateSchema, ProspectStatusSchema } from "@/modules/customer-activation/telemarketing/telemarketing-new-customer/types/prospect.schema";
import {
    createProspect,
    decodeUserId,
    listProspects,
    ProspectServiceError,
} from "@/modules/customer-activation/telemarketing/telemarketing-new-customer/services/prospect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

function numberParam(req: NextRequest, key: string): number | undefined {
    const raw = req.nextUrl.searchParams.get(key);
    if (!raw || !raw.trim()) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

/** Recent prospects, newest first, with search/status filters and paging. */
export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const statusRaw = req.nextUrl.searchParams.get("status") ?? undefined;
        const data = await listProspects({
            search: req.nextUrl.searchParams.get("search") ?? undefined,
            status: statusRaw ? ProspectStatusSchema.parse(statusRaw) : undefined,
            page: numberParam(req, "page") ?? 1,
            limit: numberParam(req, "limit") ?? 20,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET new-customer prospects failed:", error);
        const status = error instanceof ProspectServiceError ? error.status : 500;
        const message = error instanceof ProspectServiceError ? error.message : "Failed to load prospects";
        return NextResponse.json({ success: false, message }, { status });
    }
}

/**
 * Manually enters a new prospect. Dedupes first — a hit returns 409 with the
 * matched record and nothing is inserted.
 */
export async function POST(req: NextRequest) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    try {
        const parsed = ProspectCreateSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Validation failed",
                    errors: parsed.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message,
                    })),
                },
                { status: 400 },
            );
        }
        const result = await createProspect(parsed.data, decodeUserId(token));
        if (result.duplicate) {
            return NextResponse.json(
                { success: false, message: "Duplicate prospect", errors: { duplicate: result.matched } },
                { status: 409 },
            );
        }
        return NextResponse.json({ success: true, data: result.prospect }, { status: 201 });
    } catch (error) {
        console.error("POST new-customer prospect failed:", error);
        const status = error instanceof ProspectServiceError ? error.status : 500;
        const message = error instanceof ProspectServiceError ? error.message : "Failed to save the prospect";
        return NextResponse.json({ success: false, message }, { status });
    }
}
