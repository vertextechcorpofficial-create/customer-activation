import type { Metadata } from "next";
import { TelemarketingPageShell } from "../_shell/telemarketing-page-shell";

import { NewCustomerModule } from "@/modules/customer-activation/telemarketing/telemarketing-new-customer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "New Customer | VOS ERP",
    description: "Manually enter a new prospect that never existed as a lead.",
};

export default function Page() {
    return (
        <TelemarketingPageShell
            crumb="New Customer"
            title="New Customer"
            description="Manually enter a new prospect that never existed as a lead."
        >
            <NewCustomerModule />
        </TelemarketingPageShell>
    );
}
