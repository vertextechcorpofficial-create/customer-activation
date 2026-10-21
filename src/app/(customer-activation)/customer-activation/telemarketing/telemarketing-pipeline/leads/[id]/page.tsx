import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SearchX } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { LeadDetailView } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/lead-detail-view";
import { PipelineLeadsShell, headerUser } from "../page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead",
  description: "Telemarketing lead: contact details, stage, activity log and claimants.",
};

export default async function PipelineLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const leadId = Number(id);
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  return (
    <PipelineLeadsShell user={headerUser(payload)} title="Lead">
      {Number.isInteger(leadId) && leadId > 0 ? (
        <LeadDetailView leadId={leadId} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>Lead not found</EmptyTitle>
            <EmptyDescription>This address does not point at a lead.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PipelineLeadsShell>
  );
}
