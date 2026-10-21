import { z } from "zod";

/**
 * Contracts for the user-creation lane (telemarketing agent registration).
 *
 * SELF-CONTAINED: primitives are duplicated here, never imported from a
 * sibling module folder. An agent is a REGISTRATION of an existing `user`
 * row (same pattern as user ↔ salesman) — registration creates a
 * `telemarketing_agent` row and never creates or modifies the user.
 *
 * Field names mirror `telemarketing_agent` exactly (see
 * documentation/Telemarketing-DDL.md). Directus/MySQL returns `0`/`1`
 * for tinyint flags, so `DbFlag` tolerates both.
 */

// PH wall time, per conventions §6: YYYY-MM-DD HH:mm:ss in Asia/Manila.
export const PhTimestampSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

// Directus returns tinyint as boolean or 0/1.
export const DbFlagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);
export type DbFlag = z.infer<typeof DbFlagSchema>;

export const AgentSchema = z.object({
    agent_id: z.number().int(),
    agent_code: z.string().min(1).max(64),
    user_id: z.number().int(),
    display_name: z.string().min(1).max(191),
    supervisor_agent_id: z.number().int().nullable().optional(),
    daily_call_target: z.number().int().nonnegative().nullable().optional(),
    is_active: DbFlagSchema,
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

/**
 * Registration payload. `agent_code` is NOT client-supplied — the service
 * mints it server-side so `uq_tm_agent_code` can never collide by typo.
 * `user_id` + `display_name` are the only required fields.
 */
export const AgentCreateSchema = z.object({
    user_id: z.number().int().positive(),
    display_name: z.string().trim().min(1).max(191),
    supervisor_agent_id: z.number().int().positive().nullable().optional(),
    daily_call_target: z.number().int().nonnegative().nullable().optional(),
});

/**
 * Registration is immutable on `user_id` (one agent row per user), so the
 * update contract omits it. Partial — at least one field required.
 */
export const AgentUpdateSchema = z
    .object({
        display_name: z.string().trim().min(1).max(191).optional(),
        supervisor_agent_id: z.number().int().positive().nullable().optional(),
        daily_call_target: z.number().int().nonnegative().nullable().optional(),
        is_active: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" },
    );

/** Read-only `user` reference row — never written by this lane. */
export const UserOptionSchema = z.object({
    user_id: z.number().int(),
    name: z.string(),
    email: z.string(),
});

export type Agent = z.infer<typeof AgentSchema>;
export type AgentCreate = z.infer<typeof AgentCreateSchema>;
export type AgentUpdate = z.infer<typeof AgentUpdateSchema>;
export type UserOption = z.infer<typeof UserOptionSchema>;
