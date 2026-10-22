import { NextRequest, NextResponse } from "next/server";
import { ProspectUpdateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-new-customer/types/prospect.schema";
import {
    decodeUserId,
    ProspectServiceError,
    updateProspect,
} from "@/modules/customer-activation/telemarketing/telemarketing-new-customer/services/prospect-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

type RouteContext = { params: Promise<{ id: string }> };

async function prospectId(params: Promise<{ id: string }>): Promise<number | null> {
    const { id } = await params;
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Patches a prospect. Conversion to a customer happens only in the pipeline. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = await prospectId(params);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid prospect id" }, { status: 400 });
    }

    const parsed = ProspectUpdateSchema.safeParse(await req.json().catch(() => null));
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

    try {
        const prospect = await updateProspect(id, parsed.data, decodeUserId(token));
        return NextResponse.json({ success: true, data: prospect });
    } catch (error) {
        console.error("PATCH new-customer prospect failed:", error);
        const status = error instanceof ProspectServiceError ? error.status : 500;
        const message = error instanceof ProspectServiceError ? error.message : "Failed to update the prospect";
        return NextResponse.json({ success: false, message }, { status });
    }
}
