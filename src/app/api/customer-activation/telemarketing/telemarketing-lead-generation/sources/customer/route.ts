import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DealerServiceError } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/dealer-service";
import { clientCustomers } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation/services/source-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

const QuerySchema = z.object({
    dealerId: z.coerce.number().int().positive(),
    search: z.string().max(191).optional(),
    contact: z.enum(["with", "missing"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** One server-paged window of a client's `customer` table. Data is the discriminated SourceResult. */
export async function GET(req: NextRequest) {
    if (!req.cookies.get(COOKIE_NAME)?.value) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const query = req.nextUrl.searchParams;
    const parsed = QuerySchema.safeParse({
        dealerId: query.get("dealerId") || undefined,
        search: query.get("search") || undefined,
        contact: query.get("contact") || undefined,
        page: query.get("page") || undefined,
        limit: query.get("limit") || undefined,
    });
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
            { status: 400 },
        );
    }
    try {
        const data = await clientCustomers(parsed.data.dealerId, {
            search: parsed.data.search,
            contact: parsed.data.contact,
            page: parsed.data.page,
            limit: parsed.data.limit,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        if (error instanceof DealerServiceError) {
            return NextResponse.json({ success: false, message: error.message }, { status: error.status });
        }
        console.error("GET lead-generation customer failed:", error);
        return NextResponse.json({ success: false, message: "Failed to load customer sources" }, { status: 500 });
    }
}
