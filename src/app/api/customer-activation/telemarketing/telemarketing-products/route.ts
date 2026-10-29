import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { ProductCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-products/types/product.schema";
import {
    createProduct,
    listProductPage,
    listProducts,
    type ProductStatusFilter,
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

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    // No paging params: keep the legacy full-catalogue behaviour for existing callers.
    if (!params.has("page") && !params.has("limit") && !params.has("search") && !params.has("status")) {
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

    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? 20);
    const search = params.get("search") ?? undefined;
    const statusParam = params.get("status") ?? undefined;
    if (statusParam !== undefined && statusParam !== "active" && statusParam !== "inactive") {
        return NextResponse.json(
            { success: false, message: "Invalid status — expected active or inactive" },
            { status: 400 },
        );
    }
    const status = statusParam as ProductStatusFilter | undefined;

    try {
        const result = await listProductPage({
            page: Number.isFinite(page) ? page : 1,
            limit: Number.isFinite(limit) ? limit : 20,
            search,
            status,
        });
        return NextResponse.json({
            success: true,
            data: result.items,
            meta: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                total_pages: Math.ceil(result.total / result.limit),
            },
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
