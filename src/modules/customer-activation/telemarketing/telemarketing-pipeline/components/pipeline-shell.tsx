import Link from "next/link";
import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";

export type PipelineActiveTab = "board" | "pool" | "leads" | "settings";

export type PipelineShellUser = {
  name: string;
  email: string;
};

export type PipelineShellProps = {
  user: PipelineShellUser;
  crumb: string;
  active: PipelineActiveTab;
  children: ReactNode;
};

const BOARD_HREF = "/customer-activation/telemarketing/telemarketing-pipeline";
const POOL_HREF = "/customer-activation/telemarketing/telemarketing-pipeline/pool";
const LEADS_HREF = "/customer-activation/telemarketing/telemarketing-pipeline/leads";
const SETTINGS_HREF = "/customer-activation/telemarketing/telemarketing-pipeline/settings";

const TABS: Array<{ key: PipelineActiveTab; label: string; href: string }> = [
  { key: "board", label: "Board", href: BOARD_HREF },
  { key: "pool", label: "Pool", href: POOL_HREF },
  { key: "leads", label: "Leads", href: LEADS_HREF },
  { key: "settings", label: "Settings", href: SETTINGS_HREF },
];

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** The signed-in user, for the topbar avatar menu. Shared by all pipeline pages. */
export function headerUser(payload: Record<string, unknown> | null): PipelineShellUser {
  const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);
  return {
    name: [first, last].filter(Boolean).join(" ") || email || "User",
    email: email || "",
  };
}

/** The topbar + tab nav + scrolling content frame shared by all pipeline routes. */
export function PipelineShell({ user, crumb, active, children }: PipelineShellProps) {
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
                <BreadcrumbLink href="/customer-activation">Customer Activation</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden shrink-0 md:block" />
              <BreadcrumbItem className="hidden shrink-0 md:block">
                <BreadcrumbLink href="/customer-activation/telemarketing">Telemarketing</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden shrink-0 md:block" />
              <BreadcrumbItem>
                <span className="truncate font-normal text-foreground">{crumb}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex h-full shrink-0 items-center px-2 sm:px-4">
          <NavUser user={user} />
        </div>
      </header>
      <main
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-4"
      >
        <nav aria-label="Pipeline sections" className="flex flex-wrap items-center gap-1 border-b border-border pb-2 mb-4">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex min-h-[36px] items-center rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
                    : "inline-flex min-h-[36px] items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </main>
    </div>
  );
}
