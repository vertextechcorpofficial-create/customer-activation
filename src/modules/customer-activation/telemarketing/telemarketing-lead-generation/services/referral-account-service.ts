/** Server-only referral-account reads for the Lead Generation lane. */

import { dFetch } from "../utils/directus";

const COLLECTION = "referrals_account";

export const REFERRAL_ACCOUNT_FIELDS =
    "referrer_id,referrer_code,attached_referral_code,full_name,company_name,position,mobile,email,account_status,email_verified,created_at";

export type ReferralAccountStatus = "pending_verification" | "active" | "suspended";

export interface ReferralAccount {
    referrer_id: number;
    referrer_code: string | null;
    attached_referral_code: string | null;
    full_name: string | null;
    company_name: string | null;
    position: string | null;
    mobile: string | null;
    email: string | null;
    account_status: ReferralAccountStatus | string | null;
    email_verified: number | boolean | null;
    created_at: string | null;
}

export interface ReferralAccountQuery {
    page: number;
    limit: number;
    search?: string;
    status?: ReferralAccountStatus;
}

export interface ReferralAccountPage {
    items: ReferralAccount[];
    total: number;
    page: number;
    limit: number;
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class ReferralAccountServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "ReferralAccountServiceError";
        this.status = status;
    }
}

function qs(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, value);
    }
    const query = search.toString();
    return query ? `?${query}` : "";
}

function readList<T>(body: unknown): T[] {
    if (!body || typeof body !== "object") return [];
    const record = body as Record<string, unknown>;
    if ("errors" in record) return [];
    return Array.isArray(record.data) ? (record.data as T[]) : [];
}

function readTotal(body: unknown, fallback: number): number {
    if (!body || typeof body !== "object") return fallback;
    const meta = (body as { meta?: { filter_count?: unknown } }).meta;
    const n = Number(meta?.filter_count);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * One server-paged window of `referrals_account`, newest first.
 * `total` is the filtered total from `meta=filter_count`.
 */
export async function listReferralAccounts(query: ReferralAccountQuery): Promise<ReferralAccountPage> {
    const page = Math.trunc(query.page);
    const limit = Math.trunc(query.limit);
    const clauses: Record<string, unknown>[] = [];
    if (query.status) clauses.push({ account_status: { _eq: query.status } });
    const search = query.search?.trim();
    if (search) {
        clauses.push({
            _or: [
                { full_name: { _icontains: search } },
                { email: { _icontains: search } },
                { mobile: { _icontains: search } },
                { referrer_code: { _icontains: search } },
            ],
        });
    }
    const body = await dFetch(
        `/items/${COLLECTION}${qs({
            filter: clauses.length ? JSON.stringify({ _and: clauses }) : undefined,
            fields: REFERRAL_ACCOUNT_FIELDS,
            sort: "-created_at",
            limit: String(limit),
            offset: String((page - 1) * limit),
            meta: "filter_count",
        })}`,
    );
    const items = readList<ReferralAccount>(body);
    return { items, total: readTotal(body, items.length), page, limit };
}
