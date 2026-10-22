import type { Metadata } from "next";
import { LeadGenerationModule } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation";
import { TelemarketingPageShell } from "../_shell/telemarketing-page-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Lead Generation | VOS ERP",
    description: "Build telemarketing leads from the customer DB, prospecting, and client DB.",
};

export default function LeadGenerationPage() {
    return (
        <TelemarketingPageShell
            crumb="Lead Generation"
            title="Lead generation"
            description="Build leads from the customer DB, the prospecting queue, and the client DB."
        >
            <LeadGenerationModule />
        </TelemarketingPageShell>
    );
}
