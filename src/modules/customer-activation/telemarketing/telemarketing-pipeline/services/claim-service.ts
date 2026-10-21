/**
 * Pipeline claim service — server-only.
 * Claims are many-to-many: several agents may hold one lead, and claiming
 * never removes a lead from the pool — only a terminal stage does.
 * `telemarketing_lead_agent` carries a surrogate `id` plus UNIQUE(lead_id, agent_id)
 * — Directus cannot express a composite primary key — so rows are addressed by `id`.
 */

import { decodeJwtPayload } from "@/lib/auth-utils";
import { dFetch } from "../utils/directus";
import { isTerminalStage } from "../types/pipeline.schema";
import type { LeadAgent, LeadView, Stage } from "../types/pipeline.schema";

export interface PoolLead extends LeadView {
  claimed_by_me: boolean;
  claimant_count: number;
}

export interface PoolResult {
  items: PoolLead[];
  meta: { total: number; page: number; limit: number };
}

export interface Claimant {
  lead_id: number;
  agent_id: number;
  display_name: string;
  claimed_at: string;
  released_at: string | null;
}

/** What the claim route returns: the claimants plus who the caller is. */
export interface ClaimsView {
  agent_id: number;
  claimants: Claimant[];
}

function phNow(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/** Unwrap a Directus body, turning its `errors` array into a thrown Error. */
function checked<T>(body: unknown, action: string): T {
  if (body === null) throw new Error(`Failed to ${action}`);
  if (typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ message?: string }> }).errors;
    throw new Error(errors?.[0]?.message ?? `Failed to ${action}`);
  }
  return body as T;
}

async function nonTerminalStageIds(): Promise<number[]> {
  const { data } = checked<{ data: Stage[] }>(
    await dFetch("/items/telemarketing_stage?limit=-1&fields=stage_id,is_won,is_lost"),
    "load stages",
  );
  return data.filter((stage) => !isTerminalStage(stage)).map((stage) => stage.stage_id);
}

/** Leads in non-terminal stages, annotated with the caller's claim state. */
export async function listPool(args: { agentId: number; page: number; limit: number }): Promise<PoolResult> {
  const page = Math.max(1, args.page || 1);
  const limit = Math.min(100, Math.max(1, args.limit || 20));
  const stageIds = await nonTerminalStageIds();
  if (stageIds.length === 0) {
    return { items: [], meta: { total: 0, page, limit } };
  }
  const filter = encodeURIComponent(JSON.stringify({ stage_id: { _in: stageIds } }));
  const body = checked<{ data: LeadView[]; meta?: { total_count?: number } }>(
    await dFetch(
      `/items/telemarketing_lead?filter=${filter}&sort=-created_at&limit=${limit}&offset=${(page - 1) * limit}&meta=total_count`,
    ),
    "load pool",
  );
  const leads = body.data ?? [];
  const claimRows = leads.length
    ? checked<{ data: LeadAgent[] }>(
        await dFetch(
          `/items/telemarketing_lead_agent?filter=${encodeURIComponent(
            JSON.stringify({ lead_id: { _in: leads.map((l) => l.lead_id) } }),
          )}&limit=-1&fields=lead_id,agent_id,released_at`,
        ),
        "load claims",
      ).data
    : [];
  const active = claimRows.filter((row) => row.released_at == null);
  const items: PoolLead[] = leads.map((lead) => {
    const claimants = active.filter((row) => row.lead_id === lead.lead_id);
    return {
      ...lead,
      claimed_by_me: claimants.some((row) => row.agent_id === args.agentId),
      claimant_count: claimants.length,
    };
  });
  return {
    items,
    meta: { total: body.meta?.total_count ?? items.length, page, limit },
  };
}

/** Claim a lead. A duplicate (lead_id, agent_id) row is success, not an error. */
async function findClaimRow(leadId: number, agentId: number): Promise<LeadAgent | null> {
  const filter = encodeURIComponent(JSON.stringify({ lead_id: { _eq: leadId }, agent_id: { _eq: agentId } }));
  const rows = checked<{ data: LeadAgent[] }>(
    await dFetch(
      `/items/telemarketing_lead_agent?filter=${filter}&limit=1&fields=id,lead_id,agent_id,claimed_at,is_primary,released_at`,
    ),
    "load claim",
  ).data;
  return rows[0] ?? null;
}

export async function claim(leadId: number, agentId: number, actorId: number | null = null): Promise<LeadAgent> {
  const now = phNow();
  const body = await dFetch("/items/telemarketing_lead_agent", {
    method: "POST",
    body: JSON.stringify({
      lead_id: leadId,
      agent_id: agentId,
      claimed_at: now,
      is_primary: 0,
      released_at: null,
      created_by: actorId,
      created_at: now,
      updated_by: actorId,
      updated_at: now,
    }),
  });
  if (body !== null && typeof body === "object" && "errors" in body) {
    const message = (body as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ?? "";
    if (!/duplicate|unique|already exists/i.test(message)) {
      throw new Error(message || "Failed to claim lead");
    }
    const existing = await findClaimRow(leadId, agentId);
    if (!existing) throw new Error("Claim exists but could not be loaded");
    if (existing.released_at == null) return existing;
    const reopened = checked<{ data: LeadAgent }>(
      await dFetch(`/items/telemarketing_lead_agent/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          released_at: null,
          claimed_at: now,
          updated_by: actorId,
          updated_at: now,
        }),
      }),
      "claim lead",
    );
    return reopened.data;
  }
  return checked<{ data: LeadAgent }>(body, "claim lead").data;
}

/** Release a claim — soft, the row stays and `released_at` is stamped. */
export async function release(leadId: number, agentId: number, actorId: number | null = null): Promise<LeadAgent> {
  const existing = await findClaimRow(leadId, agentId);
  if (!existing) throw new Error("No claim to release");
  const now = phNow();
  const body = await dFetch(`/items/telemarketing_lead_agent/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify({ released_at: now, updated_by: actorId, updated_at: now }),
  });
  return checked<{ data: LeadAgent }>(body, "release lead").data;
}

/** Claimants for one lead, oldest claim first. Released rows are kept, flagged. */
export async function listClaimants(leadId: number): Promise<Claimant[]> {
  const filter = encodeURIComponent(JSON.stringify({ lead_id: { _eq: leadId } }));
  const rows = checked<{ data: LeadAgent[] }>(
    await dFetch(
      `/items/telemarketing_lead_agent?filter=${filter}&sort=claimed_at&limit=-1&fields=lead_id,agent_id,claimed_at,released_at`,
    ),
    "load claimants",
  ).data;
  const names = await agentNames(rows.map((row) => row.agent_id));
  return rows.map((row) => ({
    lead_id: row.lead_id,
    agent_id: row.agent_id,
    display_name: names.get(row.agent_id) ?? `Agent ${row.agent_id}`,
    claimed_at: row.claimed_at,
    released_at: row.released_at ?? null,
  }));
}

/** Display names for the given agents (the DDL keeps soft references, no FK). */
async function agentNames(agentIds: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(agentIds)];
  if (unique.length === 0) return new Map();
  const filter = encodeURIComponent(JSON.stringify({ agent_id: { _in: unique } }));
  const rows = checked<{ data: Array<{ agent_id: number; display_name: string }> }>(
    await dFetch(`/items/telemarketing_agent?filter=${filter}&limit=-1&fields=agent_id,display_name`),
    "load agents",
  ).data;
  return new Map(rows.map((agent) => [agent.agent_id, agent.display_name]));
}

/** The signed-in user's telemarketing agent id, or null when not registered. */
export async function resolveAgentId(token: string): Promise<number | null> {
  const ctx = await resolveAgentContext(token);
  return ctx?.agentId ?? null;
}

/** Both halves of the caller's identity: the agent row and the underlying user. */
export async function resolveAgentContext(
  token: string,
): Promise<{ agentId: number; userId: number } | null> {
  const userId = Number(decodeJwtPayload(token)?.sub);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const filter = encodeURIComponent(JSON.stringify({ user_id: { _eq: userId } }));
  const rows = checked<{ data: Array<{ agent_id: number }> }>(
    await dFetch(`/items/telemarketing_agent?filter=${filter}&limit=1&fields=agent_id`),
    "resolve agent",
  ).data;
  const agentId = rows[0]?.agent_id;
  return agentId === undefined ? null : { agentId, userId };
}
