import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { ProductUpdateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-products/types/product.schema";
import {
    ProductServiceError,
    updateProduct,
} from "@/modules/customer-activation/telemarketing/telemarketing-products/services/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** The signed-in user, used for the audit columns. */
function actorId(token: string): number | null {
    const payload = decodeJwtPayload(token);
    const id = Number(payload?.id ?? payload?.user_id ?? payload?.sub);
    return Number.isFinite(id) && id > 0 ? id : null;
}

async function productId(params: Promise<{ id: string }>): Promise<number | null> {
    const { id } = await params;
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Update a product — rename, reorder, or flip `is_active` to
 * activate/deactivate. Products are never hard-deleted.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const id = await productId(params);
    if (id === null) {
        return NextResponse.json({ success: false, message: "Invalid product id" }, { status: 400 });
    }

    const parsed = ProductUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Invalid product payload",
                errors: parsed.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            },
            { status: 400 },
        );
    }

    try {
        const product = await updateProduct(id, parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: product });
    } catch (error) {
        console.error("[telemarketing/telemarketing-products] PATCH failed:", error);
        const status = error instanceof ProductServiceError ? error.status : 500;
        const message =
            error instanceof ProductServiceError ? error.message : "Could not update the product";
        return NextResponse.json({ success: false, message }, { status });
    }
}
