import type { Metadata } from "next";
import { cookies } from "next/headers";
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
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { PerUserReportModule } from "@/modules/customer-activation/telemarketing/telemarketing-agent-report/PerUserReportModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Telemarketing Per-User Report",
    description: "Per-agent activities, claims and conversions for the selected period.",
};

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
    for (const key of keys) {
        const value = obj ? obj[key] : undefined;
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function displayName(payload: Record<string, unknown> | null): string {
    if (!payload) return "User";
    const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
    const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
    const email = pickString(payload, ["email", "Email"]);
    return [first, last].filter(Boolean).join(" ") || email || "User";
}

export default async function TelemarketingPerUserReportPage() {
    const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
    const payload = token ? (decodeJwtPayload(token) as Record<string, unknown> | null) : null;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background shadow-sm sm:h-16">
                <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4">
                    <SidebarTrigger className="-ml-1 shrink-0" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden shrink-0 md:block">
                                <BreadcrumbLink href="/customer-activation">
                                    Customer Activation
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden shrink-0 md:block" />
                            <BreadcrumbItem className="hidden shrink-0 md:block">
                                <BreadcrumbLink href="/customer-activation/telemarketing">
                                    Telemarketing
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden shrink-0 md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="truncate">Per-user report</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
                <div className="flex h-full shrink-0 items-center px-3 sm:px-4">
                    <span className="max-w-[140px] truncate text-sm text-muted-foreground sm:max-w-none">
                        {displayName(payload)}
                    </span>
                </div>
            </header>
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2 sm:p-4">
                <PerUserReportModule />
            </main>
        </div>
    );
}
