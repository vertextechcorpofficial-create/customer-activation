import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { ProductCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-products/types/product.schema";
import {
    createProduct,
    listProducts,
    ProductServiceError,
} from "@/modules/customer-activation/telemarketing/telemarketing-products/services/product-service";

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
        const products = await listProducts();
        return NextResponse.json({
            success: true,
            data: products,
            meta: { total: products.length },
        });
    } catch (error) {
        console.error("[telemarketing/telemarketing-products] GET failed:", error);
        const status = error instanceof ProductServiceError ? error.status : 500;
        const message =
            error instanceof ProductServiceError ? error.message : "Could not load products";
        return NextResponse.json({ success: false, message }, { status });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const parsed = ProductCreateSchema.safeParse(await request.json().catch(() => null));
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
        const product = await createProduct(parsed.data, actorId(token));
        return NextResponse.json({ success: true, data: product }, { status: 201 });
    } catch (error) {
        console.error("[telemarketing/telemarketing-products] POST failed:", error);
        const status = error instanceof ProductServiceError ? error.status : 500;
        const message =
            error instanceof ProductServiceError ? error.message : "Could not create the product";
        return NextResponse.json({ success: false, message }, { status });
    }
}
