import { z } from "zod";

/**
 * Lead Generation lane contracts — self-contained, never import from the
 * parent `telemarketing/{types,utils,services}` folders or sibling lanes.
 * Field names mirror `telemarketing_lead` exactly.
 */

const PH_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// PH wall time, written explicitly by the app.
export const PhTimestampSchema = z
    .string()
    .regex(PH_TIMESTAMP, "Expected Philippine time as YYYY-MM-DD HH:mm:ss");

export const LEAD_SOURCES = ["customer_db", "prospecting", "client_db", "referral", "portal"] as const;

export const PARTY_KINDS = ["customer", "company", "dealer", "none"] as const;

export const SourceOption = z.enum(LEAD_SOURCES);
export type SourceOption = z.infer<typeof SourceOption>;

/**
 * Tab identifiers for the source browser — a UI concern, never a lead
 * payload value. `referral_accounts` must not leak into `lead.source`
 * (`ck_tm_lead_source` rejects it); convert with `leadSourceForRow`.
 */
export const SOURCE_TAB_KINDS = ["customer_db", "prospecting", "referral_accounts"] as const;
export type SourceTabKind = (typeof SOURCE_TAB_KINDS)[number];

export const StageOptionSchema = z.object({
    stage_id: z.number().int(),
    stage_code: z.string().min(1).max(64),
    stage_name: z.string().min(1).max(191),
});
export type StageOption = z.infer<typeof StageOptionSchema>;

/**
 * One entry of the client registry (`dealer_list` on the main Directus).
 * Server-resolved only: it carries NO base URL and NO token. The browser
 * identifies a client by numeric `dealer_id` alone; connection secrets stay
 * in `services/dealer-service` and are never serialized into a response.
 */
export interface ClientOption {
    dealer_id: number;
    dealer_name: string;
    dealer_code: string | null;
    is_default: boolean;
    /** Raw `status` from the registry; NULL means active — never filtered on. */
    status: string | null;
    /** False when `directus` or `directus_token` is blank — such a client cannot serve source rows. */
    has_connection: boolean;
}

/** A provisional source row shown in one of the client-scoped source tabs. */
export interface SourceRow {
    id: number;
    name: string;
    code: string | null;
    contact: string | null;
    email: string | null;
    city: string | null;
    province: string | null;
    party_kind: (typeof PARTY_KINDS)[number];
    party_id: number | null;
    /** Which browser tab the row came from — never sent as `lead.source`. */
    source: SourceTabKind;
    /** Referral accounts only: the registrant's person name (`full_name`). */
    contactName?: string | null;
    /** Referral accounts only: the registrant's job title. */
    position?: string | null;
    /** Referral accounts only: `company_name`, shown as its own column. */
    company?: string | null;
    /** Referral accounts only: raw `created_at`, formatted at render. */
    registeredAt?: string | null;
    /** Referral accounts only: `account_status`, rendered as a pill. */
    accountStatus?: string | null;
    /** Referral accounts only: `referrer_id`, sent on create to link the lead. */
    referrer_id?: number | null;
    /**
     * Referral accounts only: the code attached at registration
     * (`attached_referral_code`). Decides the lead `source` — never sent
     * itself. Absent until the referral-accounts endpoint selects it.
     */
    attachedReferralCode?: string | null;
}

/**
 * One page of a source tab. `total` is the live Directus `filter_count` for
 * the tab's query — the pager renders it, so it must never be a fetch cap.
 */
export interface SourcePage {
    rows: SourceRow[];
    total: number;
}

/** Why a client database could not serve rows. */
export type SourceUnavailableReason = "forbidden" | "not_found" | "unreachable";

/**
 * Discriminated source result — the UI must branch on `status`:
 * - `ok`: rows + live `filter_count` total for the pager.
 * - `empty`: the table is provisioned (HTTP 200) but holds 0 rows for the
 *   query — "no records yet", NOT an error.
 * - `unavailable`: the table/endpoint cannot be read. `forbidden` (HTTP 403,
 *   not provisioned for this token) and `not_found` (HTTP 404) are different
 *   messages from `unavailable/unreachable` (timeout, 5xx, network).
 */
export type SourceResult =
    | { status: "ok"; rows: SourceRow[]; total: number }
    | { status: "empty" }
    | { status: "unavailable"; reason: SourceUnavailableReason; detail: string };

/** Page size shared by the source tabs and the sources routes — single source of truth. */
export const SOURCE_PAGE_SIZE = 10;

/**
 * Lead `source` for a converted referral account. An account carrying a
 * non-empty `attached_referral_code` was referred (`referral`); a direct
 * signup converts as `portal`. The tab id `referral_accounts` is never a
 * valid `lead.source` (`ck_tm_lead_source` rejects it).
 */
export function leadSourceForReferralRow(
    row: Pick<SourceRow, "attachedReferralCode">,
): Extract<SourceOption, "referral" | "portal"> {
    return row.attachedReferralCode?.trim() ? "referral" : "portal";
}

/** Lead `source` for any source-browser row. Customer/prospecting tabs already carry valid values. */
export function leadSourceForRow(row: SourceRow): SourceOption {
    if (row.source === "referral_accounts") return leadSourceForReferralRow(row);
    return row.source;
}

export const LeadSchema = z.object({
    lead_id: z.number().int(),
    lead_code: z.string().min(1).max(32),
    source: SourceOption,
    party_kind: z.enum(PARTY_KINDS),
    party_id: z.number().int().nullable().optional(),
    company_name: z.string().min(1).max(191),
    contact_name: z.string().max(191).nullable().optional(),
    mobile: z.string().max(32).nullable().optional(),
    email: z.string().max(191).nullable().optional(),
    address: z.string().max(255).nullable().optional(),
    industry: z.string().max(128).nullable().optional(),
    product_interest: z.string().max(64).nullable().optional(),
    need: z.string().nullable().optional(),
    stage_id: z.number().int(),
    validation_status: z.string().min(1).max(32),
    /** One product per lead (`telemarketing_products.product_id`). Null on historical rows. */
    product_id: z.number().int().positive().nullable().optional(),
    /** Client the lead was sourced from. Absent until the owner applies the provenance migration. */
    dealer_id: z.number().int().nullable().optional(),
    /** Referral account the lead was converted from (`referrals_account.referrer_id`). Null otherwise. */
    referrer_id: z.number().int().positive().nullable().optional(),
    created_by: z.number().int().nullable().optional(),
    created_at: PhTimestampSchema,
    updated_by: z.number().int().nullable().optional(),
    updated_at: PhTimestampSchema,
});

export const LeadCreateSchema = z
    .object({
        source: SourceOption,
        party_kind: z.enum(PARTY_KINDS).default("none"),
        party_id: z.number().int().nullable().optional(),
        company_name: z.string().min(1).max(191),
        contact_name: z.string().max(191).nullable().optional(),
        mobile: z.string().max(32).nullable().optional(),
        email: z.string().max(191).nullable().optional(),
        address: z.string().max(255).nullable().optional(),
        industry: z.string().max(128).nullable().optional(),
        product_interest: z.string().max(64).nullable().optional(),
        need: z.string().nullable().optional(),
        stage_id: z.number().int().optional(),
        /** One product per lead. Omitted/null lands in the null-product bucket for dedupe. */
        product_id: z.number().int().positive().nullable().optional(),
        tag_ids: z.array(z.number().int()).optional(),
        /** Client the lead was sourced from. Stored only when the `dealer_id` column exists (see provenance doc). */
        dealer_id: z.number().int().positive().optional(),
        /** Referral account the lead was converted from. Other sources send nothing, leaving it null. */
        referrer_id: z.number().int().positive().nullable().optional(),
    })
    .refine((v) => Boolean(v.mobile?.trim()) || Boolean(v.email?.trim()), {
        message: "A lead needs a mobile number or an email address",
        path: ["mobile"],
    });

export const LeadUpdateSchema = z
    .object({
        company_name: z.string().min(1).max(191).optional(),
        contact_name: z.string().max(191).nullable().optional(),
        mobile: z.string().max(32).nullable().optional(),
        email: z.string().max(191).nullable().optional(),
        address: z.string().max(255).nullable().optional(),
        industry: z.string().max(128).nullable().optional(),
        product_interest: z.string().max(64).nullable().optional(),
        need: z.string().nullable().optional(),
        stage_id: z.number().int().optional(),
        product_id: z.number().int().positive().nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type Lead = z.infer<typeof LeadSchema>;
export type LeadCreate = z.infer<typeof LeadCreateSchema>;
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;
