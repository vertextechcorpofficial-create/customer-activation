import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { LeadGenerationModule } from "@/modules/customer-activation/telemarketing/telemarketing-lead-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Lead Generation",
    description: "Build telemarketing leads from the customer DB, prospecting, and client DB.",
};

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
    for (const key of keys) {
        const value = obj ? obj[key] : undefined;
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

export default async function LeadGenerationPage() {
    const token = (await cookies()).get(COOKIE_NAME)?.value ?? null;
    const payload = token ? (decodeJwtPayload(token) as Record<string, unknown> | null) : null;
    const email = pickString(payload, ["email", "Email"]);
    const first = pickString(payload, ["FirstName", "Firstname", "firstName", "firstname"]);
    const last = pickString(payload, ["LastName", "Lastname", "lastName", "lastname"]);
    const name = [first, last].filter(Boolean).join(" ") || email || "User";

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between border-b bg-background px-3 py-3 sm:px-4">
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Telemarketing / Lead Generation</p>
                    <h1 className="truncate text-lg font-semibold">Lead Generation</h1>
                    <p className="truncate text-sm text-muted-foreground">
                        Customer DB, prospecting, and client DB sources.
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="max-w-[160px] truncate text-sm font-medium">{name}</p>
                    <p className="max-w-[160px] truncate text-xs text-muted-foreground">{email}</p>
                </div>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
                <LeadGenerationModule />
            </main>
        </div>
    );
}
