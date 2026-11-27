import { CAMPAIGN_CANVAS } from "./schema";
import type { CampaignNode } from "./schema";

export const CAMPAIGN_SNAP_TOLERANCE = 8;

export interface CampaignSnapRect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface CampaignSnapResult {
    readonly dx: number;
    readonly dy: number;
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export interface CampaignSnapOverlay {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export interface CampaignSnapOutcome extends CampaignSnapResult {
    readonly overlay: CampaignSnapOverlay | null;
}

function uniqueSorted(values: readonly number[]): number[] {
    return Array.from(new Set(values)).sort((a, b) => a - b);
}

export interface CampaignResizeSnapResult {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export interface CampaignResizeSnapOutcome extends CampaignResizeSnapResult {
    readonly overlay: CampaignSnapOverlay | null;
}

function normalizeResizeDirection(value: number | undefined): -1 | 0 | 1 {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    if (value < 0) return -1;
    if (value > 0) return 1;
    return 0;
}

export function matchCampaignResize(
    proposed: CampaignSnapRect,
    direction: readonly number[],
    statics: readonly CampaignSnapRect[],
    canvasWidth: number = CAMPAIGN_CANVAS.width,
    canvasHeight: number = CAMPAIGN_CANVAS.defaultHeight,
    tolerance: number = CAMPAIGN_SNAP_TOLERANCE,
): CampaignResizeSnapResult {
    const staticX = [0, canvasWidth / 2, canvasWidth];
    const staticY = [0, canvasHeight / 2, canvasHeight];
    for (const rect of statics) {
        staticX.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
        staticY.push(rect.y, rect.y + rect.h / 2, rect.y + rect.h);
    }
    const dirX = normalizeResizeDirection(direction[0]);
    const dirY = normalizeResizeDirection(direction[1]);

    let nextX = proposed.x;
    let nextY = proposed.y;
    let nextW = proposed.w;
    let nextH = proposed.h;
    let matchedX: number | null = null;
    let matchedY: number | null = null;

    if (dirX !== 0) {
        const movingEdgeX = dirX < 0 ? proposed.x : proposed.x + proposed.w;
        let best: number | null = null;
        let bestDelta = 0;
        for (const line of staticX) {
            const delta = line - movingEdgeX;
            if (Math.abs(delta) <= tolerance && (best === null || Math.abs(delta) < Math.abs(bestDelta))) {
                best = line;
                bestDelta = delta;
            }
        }
        if (best !== null) {
            if (dirX < 0) {
                const snappedX = proposed.x + bestDelta;
                const snappedW = proposed.w - bestDelta;
                if (snappedW >= 1) {
                    nextX = Math.round(snappedX);
                    nextW = Math.round(snappedW);
                    matchedX = best;
                }
            } else {
                const snappedW = proposed.w + bestDelta;
                if (snappedW >= 1) {
                    nextW = Math.round(snappedW);
                    matchedX = best;
                }
            }
        }
    }

    if (dirY !== 0) {
        const movingEdgeY = dirY < 0 ? proposed.y : proposed.y + proposed.h;
        let best: number | null = null;
        let bestDelta = 0;
        for (const line of staticY) {
            const delta = line - movingEdgeY;
            if (Math.abs(delta) <= tolerance && (best === null || Math.abs(delta) < Math.abs(bestDelta))) {
                best = line;
                bestDelta = delta;
            }
        }
        if (best !== null) {
            if (dirY < 0) {
                const snappedY = proposed.y + bestDelta;
                const snappedH = proposed.h - bestDelta;
                if (snappedH >= 1) {
                    nextY = Math.round(snappedY);
                    nextH = Math.round(snappedH);
                    matchedY = best;
                }
            } else {
                const snappedH = proposed.h + bestDelta;
                if (snappedH >= 1) {
                    nextH = Math.round(snappedH);
                    matchedY = best;
                }
            }
        }
    }

    return {
        x: nextX,
        y: nextY,
        w: nextW,
        h: nextH,
        xLines: matchedX === null ? [] : [matchedX],
        yLines: matchedY === null ? [] : [matchedY],
    };
}

export function snapCampaignResize(
    nodes: Readonly<Record<string, CampaignNode>>,
    pageRootIds: readonly string[],
    resizingId: string,
    proposed: CampaignSnapRect,
    direction: readonly number[],
    snapEnabled: boolean,
    canvasWidth: number = CAMPAIGN_CANVAS.width,
    canvasHeight: number = CAMPAIGN_CANVAS.defaultHeight,
): CampaignResizeSnapOutcome {
    const fallback: CampaignResizeSnapOutcome = {
        x: proposed.x,
        y: proposed.y,
        w: proposed.w,
        h: proposed.h,
        xLines: [],
        yLines: [],
        overlay: null,
    };
    const target = nodes[resizingId];
    if (!target || !snapEnabled) return fallback;
    const inPage = new Set<string>(pageRootIds);
    if (!inPage.has(resizingId)) return fallback;
    const siblings: CampaignSnapRect[] = [];
    for (const id of pageRootIds) {
        if (id === resizingId) continue;
        const node = nodes[id];
        if (node) siblings.push({ x: node.x, y: node.y, w: node.w, h: node.h });
    }
    const snapped = matchCampaignResize(proposed, direction, siblings, canvasWidth, canvasHeight);
    if (snapped.xLines.length === 0 && snapped.yLines.length === 0) {
        return { ...snapped, overlay: null };
    }
    return { ...snapped, overlay: { xLines: snapped.xLines, yLines: snapped.yLines } };
}

export function matchCampaignSnap(
    dragged: readonly CampaignSnapRect[],
    statics: readonly CampaignSnapRect[],
    rawDx: number,
    rawDy: number,
    canvasWidth: number = CAMPAIGN_CANVAS.width,
    canvasHeight: number = CAMPAIGN_CANVAS.defaultHeight,
    tolerance: number = CAMPAIGN_SNAP_TOLERANCE,
): CampaignSnapResult {
    const staticX = [0, canvasWidth / 2, canvasWidth];
    const staticY = [0, canvasHeight / 2, canvasHeight];
    for (const rect of statics) {
        staticX.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
        staticY.push(rect.y, rect.y + rect.h / 2, rect.y + rect.h);
    }
    let adjustX = 0;
    let foundX = false;
    for (const rect of dragged) {
        const edges = [rect.x + rawDx, rect.x + rawDx + rect.w / 2, rect.x + rawDx + rect.w];
        for (const edge of edges) {
            for (const line of staticX) {
                const delta = line - edge;
                if (Math.abs(delta) <= tolerance && (!foundX || Math.abs(delta) < Math.abs(adjustX))) {
                    adjustX = delta;
                    foundX = true;
                }
            }
        }
    }
    let adjustY = 0;
    let foundY = false;
    for (const rect of dragged) {
        const edges = [rect.y + rawDy, rect.y + rawDy + rect.h / 2, rect.y + rawDy + rect.h];
        for (const edge of edges) {
            for (const line of staticY) {
                const delta = line - edge;
                if (Math.abs(delta) <= tolerance && (!foundY || Math.abs(delta) < Math.abs(adjustY))) {
                    adjustY = delta;
                    foundY = true;
                }
            }
        }
    }
    const dx = rawDx + Math.round(adjustX);
    const dy = rawDy + Math.round(adjustY);
    const xLines: number[] = [];
    if (foundX) {
        for (const rect of dragged) {
            const edges = [rect.x + dx, rect.x + dx + rect.w / 2, rect.x + dx + rect.w];
            for (const edge of edges) {
                for (const line of staticX) {
                    if (Math.abs(line - edge) <= 1) xLines.push(line);
                }
            }
        }
    }
    const yLines: number[] = [];
    if (foundY) {
        for (const rect of dragged) {
            const edges = [rect.y + dy, rect.y + dy + rect.h / 2, rect.y + dy + rect.h];
            for (const edge of edges) {
                for (const line of staticY) {
                    if (Math.abs(line - edge) <= 1) yLines.push(line);
                }
            }
        }
    }
    return { dx, dy, xLines: uniqueSorted(xLines), yLines: uniqueSorted(yLines) };
}

export function snapCampaignDrag(
    nodes: Readonly<Record<string, CampaignNode>>,
    pageRootIds: readonly string[],
    draggedIds: readonly string[],
    primaryId: string,
    dx: number,
    dy: number,
    snapEnabled: boolean,
    canvasWidth: number = CAMPAIGN_CANVAS.width,
    canvasHeight: number = CAMPAIGN_CANVAS.defaultHeight,
): CampaignSnapOutcome {
    const fallback: CampaignSnapOutcome = { dx, dy, xLines: [], yLines: [], overlay: null };
    const primary = nodes[primaryId];
    if (!primary || !snapEnabled) return fallback;
    const dragged = new Set<string>(draggedIds);
    if (!dragged.has(primaryId)) return fallback;
    const inPage = new Set<string>(pageRootIds);
    if (!inPage.has(primaryId)) return fallback;
    const siblings: CampaignSnapRect[] = [];
    for (const id of pageRootIds) {
        if (dragged.has(id)) continue;
        const node = nodes[id];
        if (node) siblings.push({ x: node.x, y: node.y, w: node.w, h: node.h });
    }
    const draggedRects: CampaignSnapRect[] = [];
    for (const id of draggedIds) {
        const node = nodes[id];
        if (node && inPage.has(id)) draggedRects.push({ x: node.x, y: node.y, w: node.w, h: node.h });
    }
    if (draggedRects.length === 0) return fallback;
    const snapped = matchCampaignSnap(draggedRects, siblings, dx, dy, canvasWidth, canvasHeight);
    if (snapped.xLines.length === 0 && snapped.yLines.length === 0) {
        return { dx: snapped.dx, dy: snapped.dy, xLines: snapped.xLines, yLines: snapped.yLines, overlay: null };
    }
    return {
        dx: snapped.dx,
        dy: snapped.dy,
        xLines: snapped.xLines,
        yLines: snapped.yLines,
        overlay: { xLines: snapped.xLines, yLines: snapped.yLines },
    };
}
