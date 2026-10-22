import {
    SOURCE_PAGE_SIZE,
    type SourceResult,
    type SourceRow,
    type SourceUnavailableReason,
} from "../types/lead.schema";
import { clientFetch } from "../utils/client-directus";
import { resolveClient } from "./dealer-service";

/**
 * Server-only client-scoped source reads for the Lead Generation lane.
 * Every read resolves its connection via `resolveClient` (the browser sends
 * only a numeric dealerId) and queries that client's OWN Directus instance.
 *
 * `customer` differs between main and clients by one field swap (main has
 * `lead_id`, clients have `HasLogged`), so only the shared columns are
 * requested: id, customer_code, customer_name, contact_number,
 * customer_email, city, province. `customer_prospect` is field-identical
 * everywhere and — verified via /fields on every client instance — carries
 * `isActive`, so both tables filter `isActive {_eq: 1}`.
 */

export interface ClientSourceQuery {
    search?: string;
    page?: number;
    limit?: number;
}

/** Upper bound so a crafted limit cannot OOM the route. */
const MAX_PAGE_SIZE = 50;

const SOURCE_FIELDS = "id,customer_code,customer_name,contact_number,customer_email,city,province";

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

/** Live population size from `meta=filter_count` — never a fetch cap. */
function readTotal(body: unknown, fallback: number): number {
    if (!body || typeof body !== "object") return fallback;
    const meta = (body as { meta?: { filter_count?: unknown } }).meta;
    const n = Number(meta?.filter_count);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function sanitizeCount(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined || !Number.isInteger(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
}

/**
 * ponytail: display/UX guard only — the ceiling is cleaning the source
 * databases (clients store `"0"` for empty contact fields). Never grow this
 * into validation: typed input is saved as typed, and dedupe identity lives
 * in lead-service, not here.
 */
function cleanContactField(value: unknown, kind: "contact" | "email"): string | null {
    if (typeof value !== "string") return null;
    const v = value.trim();
    if (!v) return null;
    if (kind === "email") {
        const at = v.indexOf("@");
        if (at < 1 || !v.slice(at + 1).includes(".")) return null;
        return v;
    }
    const digits = v.replace(/[\s\-()]/g, "");
    if (digits === "09123456789") return null;
    if (/^09\d{9}$/.test(digits) || /^\+639\d{9}$/.test(digits) || /^639\d{9}$/.test(digits)) {
        return v;
    }
    return null;
}

function unavailable(reason: SourceUnavailableReason, detail: string): SourceResult {
    return { status: "unavailable", reason, detail };
}

function mapHttpFailure(status: number, table: string): SourceResult {
    if (status === 403) {
        return unavailable(
            "forbidden",
            `Table "${table}" is not provisioned for this client (HTTP 403)`,
        );
    }
    if (status === 404) {
        return unavailable("not_found", `Table "${table}" does not exist on this client (HTTP 404)`);
    }
    return unavailable("unreachable", `Client database responded with HTTP ${status}`);
}

async function queryClientTable(
    dealerId: number,
    table: "customer" | "customer_prospect",
    source: "customer_db" | "prospecting",
    query: ClientSourceQuery,
): Promise<SourceResult> {
    // Throws DealerServiceError for an unknown/unconnected id — the route maps it to 4xx.
    const client = await resolveClient(dealerId);
    const page = sanitizeCount(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
    const size = sanitizeCount(query.limit, SOURCE_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const offset = (page - 1) * size;
    const q = query.search?.trim();
    const clauses: Record<string, unknown>[] = [{ isActive: { _eq: 1 } }];
    if (q) {
        clauses.push({
            _or: [
                { customer_name: { _icontains: q } },
                { customer_code: { _icontains: q } },
                { contact_number: { _icontains: q } },
                { customer_email: { _icontains: q } },
            ],
        });
    }
    let status: number;
    let body: unknown;
    try {
        const res = await clientFetch(
            client.baseUrl,
            client.token,
            `/items/${table}${qs({
                filter: JSON.stringify({ _and: clauses }),
                fields: SOURCE_FIELDS,
                sort: "id",
                limit: String(size),
                offset: String(offset),
                meta: "filter_count",
            })}`,
        );
        status = res.status;
        body = res.body;
    } catch (error) {
        // Timeout (5s AbortSignal.timeout), DNS, refused connection.
        const detail = error instanceof Error ? error.message : "Client database is unreachable";
        return unavailable("unreachable", detail);
    }
    if (status !== 200 && status !== 204) return mapHttpFailure(status, table);
    const rows: SourceRow[] = readList<Record<string, unknown>>(body).map((row) => {
        const id = num(row.id) ?? 0;
        const base = {
            id,
            name: str(row.customer_name) ?? "(Unnamed customer)",
            code: str(row.customer_code),
            contact: cleanContactField(row.contact_number, "contact"),
            email: cleanContactField(row.customer_email, "email"),
            city: str(row.city),
            province: str(row.province),
        };
        // Customer rows link back to the client table; prospect rows are not
        // customer records, so they carry no party linkage (party_id into the
        // wrong table would false-link a future dedupe).
        return source === "customer_db"
            ? { ...base, party_kind: "customer" as const, party_id: id, source }
            : { ...base, party_kind: "none" as const, party_id: null, source };
    });
    const total = readTotal(body, rows.length);
    // Provisioned (HTTP 200) but zero rows for the query — "no records yet".
    if (total === 0) return { status: "empty" };
    return { status: "ok", rows, total };
}

/**
 * One server-paged window of the client's `customer` table. `total` on an
 * `ok` result is the live `filter_count`, never a fetch cap.
 */
export async function clientCustomers(dealerId: number, query: ClientSourceQuery = {}): Promise<SourceResult> {
    return queryClientTable(dealerId, "customer", "customer_db", query);
}

/**
 * One server-paged window of the client's `customer_prospect` table.
 * Same contract as `clientCustomers`; `empty` means provisioned but 0 rows.
 */
export async function clientProspects(dealerId: number, query: ClientSourceQuery = {}): Promise<SourceResult> {
    return queryClientTable(dealerId, "customer_prospect", "prospecting", query);
}
