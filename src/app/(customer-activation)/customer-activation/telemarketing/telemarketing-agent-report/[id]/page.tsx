import type { Metadata } from "next";
import { AgentHistory } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/components/agent-history";
import { TelemarketingPageShell } from "../../_shell/telemarketing-page-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Agent History | VOS ERP",
    description: "One agent's activities, claims and conversions for the selected period.",
};

export default async function TelemarketingAgentHistoryPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const agentId = Number(id);
    const valid = Number.isInteger(agentId) && agentId > 0;

    return (
        <TelemarketingPageShell crumb="Agent Report">
            {valid ? (
                <AgentHistory agentId={agentId} />
            ) : (
                <p className="text-sm text-muted-foreground">
                    The requested agent id is not valid.
                </p>
            )}
        </TelemarketingPageShell>
    );
}
