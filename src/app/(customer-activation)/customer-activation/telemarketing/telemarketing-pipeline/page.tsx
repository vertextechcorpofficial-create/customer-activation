import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
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
import { PipelineBoard } from "@/modules/customer-activation/telemarketing/telemarketing-pipeline/components/pipeline-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline | VOS ERP",
  description: "Telemarketing pipeline board: every lead by stage, with stage moves.",
};

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) {
    const v = obj ? obj[k] : undefined;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** The signed-in user, for the topbar avatar menu. */
function headerUser(payload: Record<string, unknown> | null) {
  const first = pickString(payload, ["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pickString(payload, ["email", "Email"]);
  return {
    name: [first, last].filter(Boolean).join(" ") || email || "User",
    email: email || "",
    avatar: "/avatars/shadcn.jpg",
  };
}

/** The topbar + scrolling content frame for the pipeline route (self-contained). */
function PipelineShell({
  user,
  title,
  children,
}: {
  user: { name: string; email: string; avatar: string };
  title: string;
  children: ReactNode;
}) {
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
                <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex h-full shrink-0 items-center px-2 sm:px-4">
          <NavUser user={user} />
        </div>
      </header>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2 sm:p-4">{children}</main>
    </div>
  );
}

export default async function TelemarketingPipelinePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  return (
    <PipelineShell user={headerUser(payload)} title="Pipeline">
      <PipelineBoard />
    </PipelineShell>
  );
}
