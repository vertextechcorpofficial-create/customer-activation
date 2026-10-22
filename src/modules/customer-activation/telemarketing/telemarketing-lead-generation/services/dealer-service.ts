import type { ClientOption } from "../types/lead.schema";
import { dFetch } from "../utils/directus";

/**
 * Server-only client-registry reads. The ONLY place that reads `dealer_list`
 * for connection data (`directus` + `directus_token`).
 *
 * `dealer_list` on the main Directus is a CLIENT REGISTRY, never a lead
 * source. `status` is NULL on every row — NULL means active, so it is
 * surfaced, never filtered on. Both reads share one in-process cache with a
 * 5-minute TTL.
 *
 * SECURITY: the browser sends only a numeric dealerId. Base URLs and tokens
 * are resolved here, server-side, and are never returned in any response
 * body — `listClients` strips them, `resolveClient` hands them only to
 * server-side callers.
 */

const DEALER_FIELDS = "dealer_id,dealer_name,dealer_code,directus,directus_token,is_default,status";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DealerRow {
    dealer_id: number;
    dealer_name: string;
    dealer_code: string | null;
    directus: string;
    directus_token: string;
    is_default: boolean;
    status: string | null;
}

/** Server-side only: connection secrets included. Never serialize to a response. */
export interface ResolvedClient {
    dealer_id: number;
    dealer_name: string;
    dealer_code: string | null;
    baseUrl: string;
    token: string;
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class DealerServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "DealerServiceError";
        this.status = status;
    }
}

let cachedAt = 0;
let cachedRows: DealerRow[] | null = null;

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function toClientOption(row: DealerRow): ClientOption {
    return {
        dealer_id: row.dealer_id,
        dealer_name: row.dealer_name,
        dealer_code: row.dealer_code,
        is_default: row.is_default,
        status: row.status,
        has_connection: row.directus !== "" && row.directus_token !== "",
    };
}

async function loadDealerRows(): Promise<DealerRow[]> {
    const now = Date.now();
    if (cachedRows && now - cachedAt < CACHE_TTL_MS) return cachedRows;
    const body = await dFetch<{ data?: unknown }>(
        `/items/dealer_list?limit=-1&fields=${DEALER_FIELDS}&sort=dealer_id`,
    );
    if (!body || typeof body !== "object" || "errors" in body || !Array.isArray((body as { data?: unknown }).data)) {
        throw new DealerServiceError("Could not load the client registry", 500);
    }
    const raw = (body as { data: Record<string, unknown>[] }).data;
    // Dedupe by dealer_code + directus host (precedent: dealerover-salesman-rankings).
    const seen = new Set<string>();
    const rows: DealerRow[] = [];
    for (const entry of raw) {
        const id = Number(entry.dealer_id);
        if (!Number.isInteger(id)) continue;
        const base = text(entry.directus);
        const key = `${text(entry.dealer_code).toLowerCase()}|${base.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const name = text(entry.dealer_name);
        rows.push({
            dealer_id: id,
            dealer_name: name || text(entry.dealer_code) || `Client ${id}`,
            dealer_code: text(entry.dealer_code) || null,
            directus: base,
            directus_token: text(entry.directus_token),
            is_default: Number(entry.is_default) === 1 || entry.is_default === true,
            status: typeof entry.status === "string" ? entry.status : null,
        });
    }
    cachedRows = rows;
    cachedAt = now;
    return rows;
}

/** Every registered client. Connection secrets are stripped — safe to serialize. */
export async function listClients(): Promise<ClientOption[]> {
    return (await loadDealerRows()).map(toClientOption);
}

/**
 * Resolve ONE client to its connection. Throws DealerServiceError(404) when
 * the id is unknown, DealerServiceError(400) when it has no connection.
 */
export async function resolveClient(dealerId: number): Promise<ResolvedClient> {
    const row = (await loadDealerRows()).find((candidate) => candidate.dealer_id === dealerId);
    if (!row) throw new DealerServiceError(`Unknown client (${dealerId})`, 404);
    if (!row.directus || !row.directus_token) {
        throw new DealerServiceError(`Client "${row.dealer_name}" has no connection configured`, 400);
    }
    return {
        dealer_id: row.dealer_id,
        dealer_name: row.dealer_name,
        dealer_code: row.dealer_code,
        baseUrl: row.directus,
        token: row.directus_token,
    };
}
