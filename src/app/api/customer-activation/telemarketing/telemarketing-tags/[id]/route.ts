import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { TagUpdateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-tags/types/tag.schema";
import {
    deactivateTag,
    TagServiceError,
    updateTag,
} from "@/modules/customer-activation/telemarketing/telemarketing-tags/services/tag-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

async function tagId(params: Promise<{ id: string }>): Promise<number | null> {
    const { id } = await params;
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = await tagId(params);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid tag id" }, { status: 400 });
    }

    const parsed = TagUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Invalid tag payload",
                errors: parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
            { status: 400 },
        );
    }

    try {
        const tag = await updateTag(id, parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: tag });
    } catch (error) {
        console.error("[telemarketing/telemarketing-tags] PATCH failed:", error);
        const status = error instanceof TagServiceError ? error.status : 500;
        const message = error instanceof TagServiceError ? error.message : "Could not update the tag";
        return NextResponse.json({ success: false, message }, { status });
    }
}

/** Tags are deactivated, never deleted — leads keep pointing at them. */
export async function DELETE(_request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = await tagId(params);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid tag id" }, { status: 400 });
    }

    try {
        const tag = await deactivateTag(id, actorId(token));
        return NextResponse.json({ success: true, data: tag });
    } catch (error) {
        console.error("[telemarketing/telemarketing-tags] DELETE failed:", error);
        const status = error instanceof TagServiceError ? error.status : 500;
        const message = error instanceof TagServiceError ? error.message : "Could not deactivate the tag";
        return NextResponse.json({ success: false, message }, { status });
    }
}
