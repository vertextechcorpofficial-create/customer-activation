import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { StageCreateSchema } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/types/pipeline.schema";
import {
  createStage,
  listStages,
  StageServiceError,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/services/stage-service";

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
    const stages = await listStages();
    return NextResponse.json({ success: true, data: stages });
  } catch (error) {
    console.error("[pipeline/stages] GET failed:", error);
    const status = error instanceof StageServiceError ? error.status : 500;
    const message = error instanceof StageServiceError ? error.message : "Could not load stages";
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = StageCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid stage payload",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const stage = await createStage(parsed.data, actorId(token));
    return NextResponse.json({ success: true, data: stage }, { status: 201 });
  } catch (error) {
    console.error("[pipeline/stages] POST failed:", error);
    const status = error instanceof StageServiceError ? error.status : 500;
    const message = error instanceof StageServiceError ? error.message : "Could not create the stage";
    return NextResponse.json({ success: false, message }, { status });
  }
}
