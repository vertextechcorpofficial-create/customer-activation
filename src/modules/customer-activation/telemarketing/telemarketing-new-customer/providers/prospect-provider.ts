import type { Prospect, ProspectCreate } from "../types/prospect.schema";

/**
 * Client-safe wrappers around the new-customer API routes.
 * No Directus access here — the API routes own all server I/O.
 */

const BASE = "/api/customer-activation/telemarketing/telemarketing-new-customer";

export interface DuplicateMatch {
    table: string;
    id: number;
    label: string;
}

export type ProspectCreateOutcome =
    | { duplicate: true; matched: DuplicateMatch }
    | { duplicate: false; prospect: Prospect };

interface Envelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: unknown;
}

function messageOf(body: Envelope<unknown> | null, status: number): string {
    return body?.message ?? `Request failed (${status})`;
}

export async function createProspect(input: ProspectCreate): Promise<ProspectCreateOutcome> {
    const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as (Envelope<Prospect> & {
        errors?: { duplicate?: DuplicateMatch };
    }) | null;
    if (res.status === 409) {
        const matched = body?.errors?.duplicate;
        return { duplicate: true, matched: matched ?? { table: "", id: 0, label: messageOf(body, 409) } };
    }
    if (!res.ok || !body?.success) throw new Error(messageOf(body, res.status));
    return { duplicate: false, prospect: body.data as Prospect };
}
