/**
 * Agent service — server-only.
 *
 * Single owner of every read/write against `telemarketing_agent`.
 * `user` is READ-ONLY reference data: this service never creates or
 * modifies a user row. Registration links an existing user; the DDL keeps
 * the reference soft (no FK), so a user rename never blocks an agent row.
 * The DDL declares no `DEFAULT CURRENT_TIMESTAMP` and no `ON UPDATE`,
 * so Philippine time is written explicitly on every mutation.
 */

import type { Agent, AgentCreate, AgentUpdate, UserOption } from "../types/agent.schema";
import { dFetch } from "../utils/directus";

const AGENTS = "telemarketing_agent";
const USERS = "user";

interface DirectusEnvelope<T> {
    data?: T;
    meta?: { filter_count?: number };
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

/** Agent row with resolved display names for the table. */
export interface AgentView extends Agent {
    user_email: string | null;
    supervisor_display_name: string | null;
}

interface UserRow {
    user_id: number;
    user_fname?: string | null;
    user_lname?: string | null;
    user_email?: string | null;
}

/** Philippine time, written explicitly by the app. */
function phNow(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** A Directus failure carrying the HTTP status the route should forward. */
export class AgentServiceError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
        super(message);
        this.name = "AgentServiceError";
        this.status = status;
    }
}

const DIRECTUS_ERROR_STATUS: Record<string, number> = {
    INVALID_PAYLOAD: 400,
    RECORD_NOT_FOUND: 404,
    RECORD_NOT_UNIQUE: 409,
    FORBIDDEN: 403,
};

/** `dFetch` hands back the parsed error body on a non-ok response. */
function throwDirectusError(body: DirectusEnvelope<unknown>): never {
    const first = body.errors?.[0];
    const status = DIRECTUS_ERROR_STATUS[first?.extensions?.code ?? ""] ?? 500;
    throw new AgentServiceError(first?.message ?? "Directus request failed", status);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<DirectusEnvelope<T>> {
    const body = await dFetch<DirectusEnvelope<T> | null>(path, init);
    if (!body) return {};
    if (Array.isArray(body.errors) && body.errors.length > 0) throwDirectusError(body);
    return body;
}

function userLabel(row: UserRow): string {
    const name = [row.user_fname, row.user_lname].filter(Boolean).join(" ").trim();
    return name || row.user_email || `User ${row.user_id}`;
}

/** Mint a unique agent code server-side — never client-supplied. */
function mintAgentCode(userId: number): string {
    return `AGT-${userId}-${Date.now().toString(36).toUpperCase()}`;
}

export interface AgentPage {
    items: AgentView[];
    total: number;
    page: number;
    limit: number;
}

/**
 * One page of agents, oldest registration first, supervisor + email resolved
 * for that page only. `filter_count` is the filtered total — `total_count` is
 * the whole collection and would make the pager lie.
 */
export async function listAgents(
    opts: { page?: number; limit?: number; search?: string } = {},
): Promise<AgentPage> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const search = opts.search?.trim() ?? "";
    const filter = search
        ? `&filter=${encodeURIComponent(
              JSON.stringify({
                  _or: [
                      { display_name: { _icontains: search } },
                      { agent_code: { _icontains: search } },
                  ],
              }),
          )}`
        : "";

    const body = await request<Agent[]>(
        `/items/${AGENTS}?fields=*&sort=agent_id&limit=${limit}&offset=${(page - 1) * limit}&meta=filter_count${filter}`,
    );
    const agents = body.data ?? [];
    const total = body.meta?.filter_count ?? agents.length;
    if (agents.length === 0) return { items: [], total, page, limit };

    const supervisorIds = [...new Set(agents.map((a) => a.supervisor_agent_id).filter((id): id is number => typeof id === "number"))];
    const names = new Map<number, string>();
    if (supervisorIds.length > 0) {
        const supFilter = encodeURIComponent(JSON.stringify({ agent_id: { _in: supervisorIds } }));
        const rows = await request<Array<{ agent_id: number; display_name: string }>>(
            `/items/${AGENTS}?filter=${supFilter}&limit=-1&fields=agent_id,display_name`,
        );
        for (const row of rows.data ?? []) names.set(row.agent_id, row.display_name);
    }

    const userIds = [...new Set(agents.map((a) => a.user_id))];
    const emails = new Map<number, string>();
    const userFilter = encodeURIComponent(JSON.stringify({ user_id: { _in: userIds } }));
    const userRows = await request<UserRow[]>(
        `/items/${USERS}?filter=${userFilter}&limit=-1&fields=user_id,user_email`,
    );
    for (const row of userRows.data ?? []) {
        if (row.user_email) emails.set(row.user_id, row.user_email);
    }

    const items = agents.map((agent) => ({
        ...agent,
        user_email: emails.get(agent.user_id) ?? null,
        supervisor_display_name:
            typeof agent.supervisor_agent_id === "number"
                ? (names.get(agent.supervisor_agent_id) ?? `Agent ${agent.supervisor_agent_id}`)
                : null,
    }));

    return { items, total, page, limit };
}

/**
 * Search READ-ONLY `user` rows for the registration combobox.
 * Never creates or modifies a user.
 */
export async function listSelectableUsers(search: string, limit: number): Promise<UserOption[]> {
    const take = Math.min(50, Math.max(1, limit || 20));
    const q = search.trim();
    const filter = q
        ? `&filter=${encodeURIComponent(JSON.stringify({ _or: [{ user_fname: { _icontains: q } }, { user_lname: { _icontains: q } }, { user_email: { _icontains: q } }] }))}`
        : "";
    const body = await request<UserRow[]>(
        `/items/${USERS}?fields=user_id,user_fname,user_lname,user_email&sort=user_fname&limit=${take}${filter}`,
    );
    return (body.data ?? []).map((row) => ({
        user_id: row.user_id,
        name: userLabel(row),
        email: row.user_email ?? "",
    }));
}

/**
 * Register an existing user as an agent. Rejects when that `user_id`
 * already has an agent row (`uq_tm_agent_user`) — registration never
 * creates the user.
 */
export async function registerAgent(input: AgentCreate, actorId: number | null): Promise<Agent> {
    const dupeFilter = encodeURIComponent(JSON.stringify({ user_id: { _eq: input.user_id } }));
    const existing = await request<Array<{ agent_id: number }>>(
        `/items/${AGENTS}?filter=${dupeFilter}&limit=1&fields=agent_id`,
    );
    if ((existing.data ?? []).length > 0) {
        throw new AgentServiceError("This user is already registered as an agent", 409);
    }

    const userCheck = await request<UserRow[]>(
        `/items/${USERS}?filter=${encodeURIComponent(JSON.stringify({ user_id: { _eq: input.user_id } }))}&limit=1&fields=user_id`,
    );
    if ((userCheck.data ?? []).length === 0) {
        throw new AgentServiceError("User was not found", 404);
    }

    const now = phNow();
    const body = await request<Agent>(`/items/${AGENTS}`, {
        method: "POST",
        body: JSON.stringify({
            agent_code: mintAgentCode(input.user_id),
            user_id: input.user_id,
            display_name: input.display_name.trim(),
            supervisor_agent_id: input.supervisor_agent_id ?? null,
            daily_call_target: input.daily_call_target ?? null,
            is_active: 1,
            created_by: actorId,
            created_at: now,
            updated_by: actorId,
            updated_at: now,
        }),
    });
    if (!body.data) throw new AgentServiceError("Agent was not registered", 500);
    return body.data;
}

function agentPatch(input: AgentUpdate, actorId: number | null): Record<string, unknown> {
    const patch: Record<string, unknown> = { updated_by: actorId, updated_at: phNow() };
    if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
    if (input.supervisor_agent_id !== undefined) patch.supervisor_agent_id = input.supervisor_agent_id;
    if (input.daily_call_target !== undefined) patch.daily_call_target = input.daily_call_target;
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
    return patch;
}

export async function updateAgent(id: number, input: AgentUpdate, actorId: number | null): Promise<Agent> {
    const body = await request<Agent>(`/items/${AGENTS}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(agentPatch(input, actorId)),
    });
    if (!body.data) throw new AgentServiceError("Agent was not updated", 500);
    return body.data;
}

/** Agents are never hard-deleted — leads and activities keep pointing at them. */
export async function deactivateAgent(id: number, actorId: number | null): Promise<Agent> {
    return updateAgent(id, { is_active: false }, actorId);
}
