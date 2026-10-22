import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { TagCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-tags/types/tag.schema";
import {
    createTag,
    listTags,
    TagServiceError,
} from "@/modules/customer-activation/telemarketing/telemarketing-tags/services/tag-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? 20);
    const search = params.get("search") ?? undefined;

    try {
        const result = await listTags({
            page: Number.isFinite(page) ? page : 1,
            limit: Number.isFinite(limit) ? limit : 20,
            search,
        });
        return NextResponse.json({
            success: true,
            data: result.items,
            meta: { total: result.total, page: result.page, limit: result.limit },
        });
    } catch (error) {
        console.error("[telemarketing/telemarketing-tags] GET failed:", error);
        const status = error instanceof TagServiceError ? error.status : 500;
        const message = error instanceof TagServiceError ? error.message : "Could not load tags";
        return NextResponse.json({ success: false, message }, { status });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = TagCreateSchema.safeParse(await request.json().catch(() => null));
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
        const tag = await createTag(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: tag }, { status: 201 });
    } catch (error) {
        console.error("[telemarketing/telemarketing-tags] POST failed:", error);
        const status = error instanceof TagServiceError ? error.status : 500;
        const message = error instanceof TagServiceError ? error.message : "Could not create the tag";
        return NextResponse.json({ success: false, message }, { status });
    }
}
