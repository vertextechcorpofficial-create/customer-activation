import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  listPool,
  resolveAgentId,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/claim-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vos_access_token";

const PoolQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().max(191).optional(),
  stageId: z.coerce.number().int().positive().optional(),
  sort: z.enum(["code", "-code", "claimants", "-claimants"]).optional(),
});

/** Leads in non-terminal stages — claiming never removes a lead from here. */
export async function GET(req: NextRequest) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const query = req.nextUrl.searchParams;
  // Absent filters sometimes arrive serialised ("null"/"undefined"/"") — treat those as missing.
  const absent = (value: string | null): string | undefined => {
    if (value === null) return undefined;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return undefined;
    return value;
  };
  const parsed = PoolQuerySchema.safeParse({
    page: absent(query.get("page")),
    limit: absent(query.get("limit")),
    search: absent(query.get("search")),
    stageId: absent(query.get("stageId")),
    sort: absent(query.get("sort")),
  });
  if (!parsed.success)
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  try {
    const agentId = await resolveAgentId(token);
    if (agentId === null)
      return NextResponse.json(
        { success: false, message: "No telemarketing agent registered for this user" },
        { status: 403 },
      );
    const data = await listPool({ agentId, ...parsed.data });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[pipeline/pool GET]", e);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
