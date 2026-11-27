import { CAMPAIGN_CANVAS, clampCanvasHeight } from "./schema";
import type { CampaignDoc } from "./schema";

export const CAMPAIGN_PIXEL_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function blankCampaignDoc(): CampaignDoc {
    return {
        version: 2,
        canvas: { width: CAMPAIGN_CANVAS.width, height: CAMPAIGN_CANVAS.defaultHeight },
        pages: [{ id: "page-1", rootIds: [] }],
        nodes: {},
    };
}

export function withCanvasHeight(doc: CampaignDoc, height: number): CampaignDoc {
    return {
        ...doc,
        canvas: { width: CAMPAIGN_CANVAS.width, height: clampCanvasHeight(height) },
    };
}

/** Parse a stored `content_json` value without validating — the editor validates after. */
export function parseCampaignContentJson(raw: unknown): unknown {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string" || raw.trim() === "") return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
}
