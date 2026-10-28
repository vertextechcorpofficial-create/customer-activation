import { z } from "zod";

/**
 * Campaign canvas document, format v2 (canvas).
 *
 * `{ "version": 2, "canvas": { "width": 800, "height": <int> },
 *    "pages": [ { "id", "rootIds" } ], "nodes": { "<id>": Node } }`
 *
 * Exactly ONE page on a fixed 800px artboard. `canvas.height` is stored,
 * default 1600, clamped to 800–4000. Nodes are freeform (`x/y/w/h`) with
 * `parentId: "stage"`.
 *
 * Colors inside node props are author content, so arbitrary color strings
 * are allowed there. Single source of truth: the editor validates drafts
 * with this schema and the PATCH route re-validates server-side.
 */

export const CAMPAIGN_CANVAS = {
    width: 800,
    defaultHeight: 1600,
    minHeight: 800,
    maxHeight: 4000,
} as const;

export const CAMPAIGN_CONTENT_VERSION = 2 as const;

/**
 * Payload guard, set just below the measured Directus ceiling: through the
 * PATCH API, a serialized `content_json` of 1,048,019 bytes saves (200) and
 * 1,048,419 bytes is rejected by Directus with
 * "Invalid payload. request entity too large." The guard sits ~3.5 KB under
 * the largest passing document so authors never hit the transport error.
 */
export const CAMPAIGN_MAX_BYTES = 1_044_480;

const CAMPAIGN_STAGE_PARENT = "stage";

const CAMPAIGN_RASTER_PREFIXES = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
];

function isRasterDataUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    return CAMPAIGN_RASTER_PREFIXES.some(
        (prefix) => value.length > prefix.length && value.startsWith(prefix),
    );
}

export function clampCanvasHeight(value: number): number {
    if (!Number.isFinite(value)) return CAMPAIGN_CANVAS.defaultHeight;
    return Math.min(
        CAMPAIGN_CANVAS.maxHeight,
        Math.max(CAMPAIGN_CANVAS.minHeight, Math.round(value)),
    );
}

const campaignAlignSchema = z.enum(["left", "center", "right"]);
const campaignFontWeightSchema = z.union([z.string().min(1), z.number().finite()]);

/**
 * Optional link for a whole text node (v2 has no `cta` block, so this is the
 * only link mechanism). Site-relative (`/path`) or absolute `https://` only —
 * `javascript:`, `data:`, protocol-relative `//`, and bare `mailto:` are
 * rejected. Shared with the property panel for inline validation.
 */
export function isCampaignTextHref(value: string): boolean {
    if (value.length === 0 || value.length > 500) return false;
    if (value.startsWith("https://")) return !/[\s<>"`\\]/.test(value);
    if (value.startsWith("/") && !value.startsWith("//")) return !/[\s<>"`\\]/.test(value);
    return false;
}

const campaignNodeBase = {
    id: z.string().min(1),
    parentId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
    rotation: z.number().finite(),
    z: z.number().int().min(0),
    opacity: z.number().min(0).max(1),
    locked: z.boolean().default(false),
};

const campaignTextPropsSchema = z.object({
    text: z.string(),
    fontFamily: z.string().min(1),
    fontSize: z.number().finite().positive(),
    fontWeight: campaignFontWeightSchema,
    italic: z.boolean(),
    underline: z.boolean(),
    strikethrough: z.boolean().default(false),
    color: z.string().min(1),
    align: campaignAlignSchema,
    letterSpacing: z.number().finite(),
    lineHeight: z.number().finite().positive(),
    strokeWidth: z.number().finite().min(0).optional(),
    strokeColor: z.string().min(1).optional(),
    href: z
        .string()
        .max(500)
        .refine(isCampaignTextHref, "Link must start with / or https://")
        .optional(),
});

const campaignImageMaskSchema = z.enum(["none", "circle", "ellipse", "rounded", "diamond", "hexagon", "star"]);

const campaignImagePropsSchema = z.object({
    src: z
        .string()
        .refine(isRasterDataUrl, "Image src must be a raster data URL (png, jpeg, or webp)"),
    alt: z.string().min(1, "Describe the image for screen readers."),
    fit: z.enum(["cover", "contain", "fill"]),
    radius: z.number().finite().min(0),
    mask: campaignImageMaskSchema.default("none"),
    opacity: z.number().min(0).max(1),
});

const campaignShapePropsSchema = z.object({
    shape: z.enum(["rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "star", "arrow"]),
    fill: z.string().min(1),
    borderColor: z.string().min(1),
    borderWidth: z.number().finite().min(0),
    radius: z.number().finite().min(0),
    opacity: z.number().min(0).max(1),
});

const campaignTextNodeSchema = z.object({
    ...campaignNodeBase,
    type: z.literal("text"),
    props: campaignTextPropsSchema,
});

const campaignImageNodeSchema = z.object({
    ...campaignNodeBase,
    type: z.literal("image"),
    props: campaignImagePropsSchema,
});

const campaignShapeNodeSchema = z.object({
    ...campaignNodeBase,
    type: z.literal("shape"),
    props: campaignShapePropsSchema,
});

export const campaignNodeSchema = z.discriminatedUnion("type", [
    campaignTextNodeSchema,
    campaignImageNodeSchema,
    campaignShapeNodeSchema,
]);

export type CampaignNode = z.infer<typeof campaignNodeSchema>;

export const campaignPageSchema = z.object({
    id: z.string().min(1),
    rootIds: z.array(z.string().min(1)),
});

export type CampaignPage = z.infer<typeof campaignPageSchema>;

export const campaignDocSchema = z
    .object({
        version: z.literal(CAMPAIGN_CONTENT_VERSION),
        canvas: z.object({
            width: z.literal(CAMPAIGN_CANVAS.width),
            height: z.number().int().min(CAMPAIGN_CANVAS.minHeight).max(CAMPAIGN_CANVAS.maxHeight),
        }),
        pages: z.array(campaignPageSchema),
        nodes: z.record(z.string(), campaignNodeSchema),
    })
    .superRefine((doc, ctx) => {
        if (doc.version !== 2) {
            ctx.addIssue({ code: "custom", message: "Campaign document version must be 2", path: ["version"] });
        }
        if (doc.pages.length !== 1) {
            ctx.addIssue({
                code: "custom",
                message: "Campaign document must hold exactly one page",
                path: ["pages"],
            });
        }
        const membership = new Map<string, number>();
        doc.pages.forEach((page) => {
            page.rootIds.forEach((rootId) => {
                membership.set(rootId, (membership.get(rootId) ?? 0) + 1);
            });
        });
        Object.entries(doc.nodes).forEach(([id, node]) => {
            if (node.parentId !== CAMPAIGN_STAGE_PARENT) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} parentId must be stage`,
                    path: ["nodes", id, "parentId"],
                });
            }
            const count = membership.get(id) ?? 0;
            if (count === 0) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} is an orphan with no page`,
                    path: ["nodes", id],
                });
            }
            if (count > 1) {
                ctx.addIssue({
                    code: "custom",
                    message: `Node ${id} belongs to more than one page`,
                    path: ["pages"],
                });
            }
        });
        doc.pages.forEach((page, pageIndex) => {
            page.rootIds.forEach((rootId, rootIndex) => {
                if (!doc.nodes[rootId]) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Page ${page.id} references missing node ${rootId}`,
                        path: ["pages", pageIndex, "rootIds", rootIndex],
                    });
                }
            });
            const ordered = page.rootIds
                .map((rootId) => doc.nodes[rootId]?.z)
                .filter((value) => value !== undefined)
                .sort((a, b) => a - b);
            const permutation =
                ordered.length === page.rootIds.length &&
                ordered.every((value, index) => value === index);
            if (!permutation) {
                ctx.addIssue({
                    code: "custom",
                    message: `Page ${page.id} z values must permute 0 to ${page.rootIds.length - 1}`,
                    path: ["pages", pageIndex, "rootIds"],
                });
            }
        });
    })
    .refine((doc) => campaignByteLength(doc) <= CAMPAIGN_MAX_BYTES, {
        message: "Canvas document exceeds the payload cap — remove or shrink images.",
        path: ["nodes"],
    });

export type CampaignDoc = z.infer<typeof campaignDocSchema>;

/** Compact serialized UTF-8 length of a document. */
export function campaignByteLength(doc: unknown): number {
    return new TextEncoder().encode(JSON.stringify(doc)).length;
}

/** `["nodes", "abc", "props"]` → `"nodes.abc.props"`. */
export function formatCampaignErrorPath(path: (string | number | symbol)[]): string {
    let out = "";
    for (const segment of path) {
        if (typeof segment === "number") out += `[${segment}]`;
        else if (out === "") out = String(segment);
        else out += `.${String(segment)}`;
    }
    return out || "(document)";
}

export interface CampaignIssue {
    field: string;
    message: string;
}

export function formatCampaignIssues(
    issues: Array<{ path: (string | number | symbol)[]; message: string }>,
): CampaignIssue[] {
    return issues.map((issue) => ({ field: formatCampaignErrorPath(issue.path), message: issue.message }));
}

/**
 * Parse the `content_json` LONGTEXT value (JSON text, nullable) into a
 * validated v2 canvas document. `null`/empty means "no authored content" —
 * the site falls back to title/description. A document that fails
 * validation is reported, never thrown — the renderer treats it as `null`.
 */
export function parseStoredCampaign(
    raw: string | null | undefined,
): { ok: true; doc: CampaignDoc | null } | { ok: false; errors: CampaignIssue[] } {
    if (raw == null || raw === "") return { ok: true, doc: null };
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, errors: [{ field: "(document)", message: "Saved content is not valid JSON." }] };
    }
    const result = campaignDocSchema.safeParse(parsed);
    if (!result.success) return { ok: false, errors: formatCampaignIssues(result.error.issues) };
    return { ok: true, doc: result.data };
}
