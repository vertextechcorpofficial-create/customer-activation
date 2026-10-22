import type { Metadata } from "next";
import { PerUserReportModule } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/PerUserReportModule";
import { TelemarketingPageShell } from "../_shell/telemarketing-page-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Agent Report | VOS ERP",
    description: "Per-agent activities, claims and conversions for the selected period.",
};

export default function TelemarketingPerUserReportPage() {
    return (
        <TelemarketingPageShell crumb="Agent Report">
            <PerUserReportModule />
        </TelemarketingPageShell>
    );
}
