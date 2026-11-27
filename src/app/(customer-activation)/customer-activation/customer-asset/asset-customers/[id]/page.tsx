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
import { CustomerDashboard } from "@/modules/customer-activation/customer-asset/asset-customers";
import { getCustomerHeader } from "@/modules/customer-activation/customer-asset/asset-customers/services/asset-customers-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Customer Dashboard | VOS ERP",
    description: "Customer asset holdings, history, and notes.",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) notFound();

    const [cookieStore, header] = await Promise.all([
        cookies(),
        getCustomerHeader(id).catch(() => null),
    ]);
    const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const payload = token ? decodeJwtPayload(token) : null;

    const name =
        [payload?.FirstName, payload?.LastName].filter(Boolean).join(" ") ||
        (typeof payload?.email === "string" ? payload.email : "") ||
        "User";
    const headerUser = {
        name,
        email: typeof payload?.email === "string" ? payload.email : "",
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
                                    <BreadcrumbLink href="/customer-activation/customer-asset/asset-customers">
                                        Asset Customers
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        {header?.customer_name ?? "Customer details"}
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

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/40 p-2 sm:p-4 dark:bg-background">
                <CustomerDashboard id={id} />
            </main>
        </div>
    );
}
