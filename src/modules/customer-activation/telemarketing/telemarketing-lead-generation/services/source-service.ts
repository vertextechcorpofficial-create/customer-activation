import type { SourceRow } from "../types/lead.schema";
import { dFetch } from "../utils/directus";

/** Server-only provisional source reads for the Lead Generation lane. */

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

function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
}

// Q2 PENDING: customerDb assumes the live `customer` table with sandbox columns
// (customer_name, customer_code, contact_number, customer_email, city, province).
export async function customerDbLeads(search?: string): Promise<SourceRow[]> {
    const q = search?.trim();
    const clauses: Record<string, unknown>[] = [];
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
    const body = await dFetch(
        `/items/customer${qs({
            filter: clauses.length ? JSON.stringify({ _and: clauses }) : undefined,
            fields: "id,customer_name,customer_code,contact_number,customer_email,city,province",
            limit: "50",
        })}`,
    );
    return readList<Record<string, unknown>>(body).map((row) => ({
        id: num(row.id) ?? 0,
        name: str(row.customer_name) ?? "(Unnamed customer)",
        code: str(row.customer_code),
        contact: str(row.contact_number),
        email: str(row.customer_email),
        city: str(row.city),
        province: str(row.province),
        party_kind: "customer" as const,
        party_id: num(row.id),
        source: "customer_db" as const,
    }));
}

// Q2 PENDING: prospecting assumes there is no source table yet, so it returns
// an empty list and the UI offers "Add prospect manually".
export async function prospectingLeads(): Promise<SourceRow[]> {
    return [];
}

// Q2 PENDING: clientDb assumes `company_list` + `dealer_list` with columns
// (name, code, contact, email, city, province) spelled per table below.
export async function clientDbLeads(search?: string): Promise<SourceRow[]> {
    const q = search?.trim();
    const companyClauses: Record<string, unknown>[] = [];
    const dealerClauses: Record<string, unknown>[] = [];
    if (q) {
        companyClauses.push({
            _or: [
                { company_name: { _icontains: q } },
                { company_code: { _icontains: q } },
                { company_contact: { _icontains: q } },
                { company_email: { _icontains: q } },
            ],
        });
        dealerClauses.push({
            _or: [
                { dealer_name: { _icontains: q } },
                { dealer_code: { _icontains: q } },
                { dealer_contact: { _icontains: q } },
                { dealer_email: { _icontains: q } },
            ],
        });
    }
    const [companies, dealers] = await Promise.all([
        dFetch(
            `/items/company_list${qs({
                filter: companyClauses.length ? JSON.stringify({ _and: companyClauses }) : undefined,
                fields: "company_id,company_name,company_code,company_contact,company_email,company_city,company_province",
                limit: "50",
            })}`,
        ),
        dFetch(
            `/items/dealer_list${qs({
                filter: dealerClauses.length ? JSON.stringify({ _and: dealerClauses }) : undefined,
                fields: "dealer_id,dealer_name,dealer_code,dealer_contact,dealer_email,dealer_city,dealer_province",
                limit: "50",
            })}`,
        ),
    ]);
    const companyRows = readList<Record<string, unknown>>(companies).map((row) => ({
        id: num(row.company_id) ?? 0,
        name: str(row.company_name) ?? "(Unnamed company)",
        code: str(row.company_code),
        contact: str(row.company_contact),
        email: str(row.company_email),
        city: str(row.company_city),
        province: str(row.company_province),
        party_kind: "company" as const,
        party_id: num(row.company_id),
        source: "client_db" as const,
    }));
    const dealerRows = readList<Record<string, unknown>>(dealers).map((row) => ({
        id: 1000000 + (num(row.dealer_id) ?? 0),
        name: str(row.dealer_name) ?? "(Unnamed dealer)",
        code: str(row.dealer_code),
        contact: str(row.dealer_contact),
        email: str(row.dealer_email),
        city: str(row.dealer_city),
        province: str(row.dealer_province),
        party_kind: "dealer" as const,
        party_id: num(row.dealer_id),
        source: "client_db" as const,
    }));
    return [...companyRows, ...dealerRows].slice(0, 100);
}
