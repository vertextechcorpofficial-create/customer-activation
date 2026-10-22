import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { getLeaderboard } from "@/modules/customer-activation/telemarketing/telemarketing-leaderboard/services/leaderboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!req.cookies.get(COOKIE_NAME)?.value) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const period = req.nextUrl.searchParams.get("period") ?? undefined;
    const data = await getLeaderboard(period);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid leaderboard period")) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error("[telemarketing/telemarketing-leaderboard] GET failed:", error);
    return NextResponse.json({ success: false, message: "Failed to load leaderboard" }, { status: 500 });
  }
}
