import type { ReactNode } from "react";
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
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
    for (const key of keys) {
        const value = obj ? obj[key] : undefined;
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

/**
 * Shared shell for every telemarketing module: topbar (sidebar trigger + breadcrumb
 * + user menu) and the scrolling content area. One copy, so a module cannot drift
 * into its own header layout.
 */
export async function TelemarketingPageShell({
    crumb,
    title,
    description,
    children,
}: {
    crumb: string;
    title?: string;
    description?: string;
    children: ReactNode;
}) {
    const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
    const payload = token ? (decodeJwtPayload(token) as Record<string, unknown> | null) : null;

    const email = pickString(payload, ["email", "Email"]);
    const first = pickString(payload, ["FirstName", "Firstname", "firstName", "firstname"]);
    const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname"]);
    const name = [first, last].filter(Boolean).join(" ") || email || "User";

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
                                    <BreadcrumbLink href="/customer-activation/telemarketing">
                                        Telemarketing
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block shrink-0" />
                                <BreadcrumbItem className="min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                        {crumb}
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </div>

                <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none overflow-hidden">
                    <NavUser user={{ name, email }} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
                {title ? (
                    <div className="mb-4">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                        {description ? (
                            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        ) : null}
                    </div>
                ) : null}
                {children}
            </main>
        </div>
    );
}
