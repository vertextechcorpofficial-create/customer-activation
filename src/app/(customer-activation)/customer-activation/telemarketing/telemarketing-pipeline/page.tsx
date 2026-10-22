import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { PipelineBoard } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-board";
import {
  PipelineShell,
  headerUser,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline | VOS ERP",
  description: "Telemarketing pipeline board: every lead by stage, with stage moves.",
};

export default async function TelemarketingPipelinePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  return (
    <PipelineShell user={headerUser(payload)} crumb="Board" active="board">
      <PipelineBoard />
    </PipelineShell>
  );
}
