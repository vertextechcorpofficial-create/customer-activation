import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { LeadList } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/lead-list";
import {
  PipelineShell,
  headerUser,
} from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telemarketing Leads",
  description: "Every telemarketing lead, filterable by stage, source or search term.",
};

export default async function PipelineLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;
  const { stage } = await searchParams;
  const stageId = Number(stage);

  return (
    <PipelineShell user={headerUser(payload)} crumb="Leads" active="leads">
      <LeadList
        initialStageId={Number.isInteger(stageId) && stageId > 0 ? stageId : undefined}
      />
    </PipelineShell>
  );
}
