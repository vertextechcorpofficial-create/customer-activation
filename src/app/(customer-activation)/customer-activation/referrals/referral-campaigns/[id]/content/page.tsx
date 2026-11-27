import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

import { CampaignEditor } from "@/modules/customer-activation/referrals/referral-campaigns/designer/CampaignEditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Edit content | VOS ERP",
    description: "Design the canvas content for a referral campaign.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const campaignId = Number(id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) notFound();

    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const payload = decodeJwtPayload(token ?? "");

    const name =
        [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") ||
        payload?.email ||
        "User";
    const headerUser = {
        name,
        email: payload?.email ?? "",
        avatar: "/avatars/shadcn.jpg",
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-sm bg-background sm:h-16 overflow-hidden">
                <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
                    <SidebarTrigger className="-ml-1 shrink-0" />

                    <Separator
                        orientation="vertical"
                        className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
                    />

                    <div className="min-w-0 overflow-hidden">
                        <Breadcrumb>
                            <BreadcrumbList className="min-w-0 overflow-hidden">
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="/customer-activation">
                                        Customer Activation
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="/customer-activation/referrals">
                                        Referrals
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="hidden md:block shrink-0">
                                    <BreadcrumbLink href="/customer-activation/referrals/referral-campaigns">
                                        Campaigns
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        Edit content
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>

                <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
                    <NavUser user={headerUser} />
                </div>
            </header>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
                <CampaignEditor campaignId={campaignId} />
            </main>
        </div>
    );
}
