import { create } from "zustand";
import { CAMPAIGN_CANVAS, clampCanvasHeight } from "./schema";
import type { CampaignDoc, CampaignNode, CampaignPage } from "./schema";

export type CampaignDocHistory = Pick<CampaignDocState, "nodes" | "pages" | "activePageId" | "canvasHeight">;

export interface CampaignViewport {
    zoom: number;
    panX: number;
    panY: number;
}

export type CampaignNodeDraft = Omit<CampaignNode, "id" | "locked"> & { id?: string; locked?: boolean };

export interface CampaignDocState {
    nodes: Record<string, CampaignNode>;
    pages: CampaignPage[];
    activePageId: string | null;
    canvasHeight: number;
    selection: string[];
    hover: string | null;
    viewport: CampaignViewport;
    snapEnabled: boolean;
    editingId: string | null;
    version: number;
    gestureActive: boolean;
    gesturePre: CampaignDocHistory | null;
    past: CampaignDocHistory[];
    future: CampaignDocHistory[];
    addNode: (draft: CampaignNodeDraft, pageId?: string) => string | null;
    moveNode: (id: string, x: number, y: number) => void;
    moveNodesBy: (ids: string[], dx: number, dy: number) => void;
    resizeNode: (id: string, w: number, h: number) => void;
    rotateNode: (id: string, rotation: number) => void;
    setOpacity: (id: string, opacity: number) => void;
    updateProps: (id: string, patch: Record<string, unknown>) => void;
    removeNode: (id: string) => void;
    setLocked: (id: string, locked: boolean) => void;
    toggleLock: (id: string) => void;
    reorderNode: (id: string, direction: "up" | "down") => void;
    reorderNodeTo: (id: string, toIndex: number) => void;
    selectNodes: (ids: string[]) => void;
    setHover: (id: string | null) => void;
    setEditingId: (id: string | null) => void;
    setViewport: (patch: Partial<CampaignViewport>) => void;
    setSnapEnabled: (enabled: boolean) => void;
    setActivePage: (pageId: string) => void;
    setCanvasHeight: (height: number) => void;
    beginGesture: () => void;
    endGesture: () => void;
    hydrate: (doc: CampaignDocHistory) => void;
    loadDoc: (doc: CampaignDoc) => void;
    undo: () => void;
    redo: () => void;
}

export type CampaignDocStore = ReturnType<typeof createCampaignDocStore>;

const CAMPAIGN_HISTORY_LIMIT = 100;
const CAMPAIGN_STAGE_PARENT = "stage" as const;

export const CAMPAIGN_ZOOM_MIN = 0.5;
export const CAMPAIGN_ZOOM_MAX = 4;
export const CAMPAIGN_ZOOM_STEP = 0.25;

export function clampCampaignZoom(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(CAMPAIGN_ZOOM_MAX, Math.max(CAMPAIGN_ZOOM_MIN, value));
}

export function activePageOf(state: Pick<CampaignDocState, "pages" | "activePageId">): CampaignPage | null {
    return state.pages.find((page) => page.id === state.activePageId) ?? null;
}

export function pageOfNode(pages: readonly CampaignPage[], nodeId: string): CampaignPage | null {
    return pages.find((page) => page.rootIds.includes(nodeId)) ?? null;
}

function snapshotHistory(state: CampaignDocState): CampaignDocHistory {
    return { nodes: state.nodes, pages: state.pages, activePageId: state.activePageId, canvasHeight: state.canvasHeight };
}

function historyEquality(before: CampaignDocHistory, after: CampaignDocHistory): boolean {
    if (before.nodes === after.nodes && before.pages === after.pages && before.activePageId === after.activePageId && before.canvasHeight === after.canvasHeight) return true;
    if (before.activePageId !== after.activePageId) return false;
    if (before.canvasHeight !== after.canvasHeight) return false;
    if (before.pages.length !== after.pages.length) return false;
    for (let index = 0; index < after.pages.length; index += 1) {
        const prev = before.pages[index];
        const next = after.pages[index];
        if (prev === next) continue;
        if (!prev || !next || prev.id !== next.id) return false;
        if (prev.rootIds.length !== next.rootIds.length) return false;
        for (let root = 0; root < next.rootIds.length; root += 1) {
            if (prev.rootIds[root] !== next.rootIds[root]) return false;
        }
    }
    if (before.nodes === after.nodes) return true;
    const nextKeys = Object.keys(after.nodes);
    if (nextKeys.length !== Object.keys(before.nodes).length) return false;
    for (const key of nextKeys) {
        if (before.nodes[key] !== after.nodes[key]) return false;
    }
    return true;
}

function renumberPageZ(nodes: Record<string, CampaignNode>, rootIds: readonly string[]): Record<string, CampaignNode> {
    const next: Record<string, CampaignNode> = { ...nodes };
    rootIds.forEach((rootId, z) => {
        const node = next[rootId];
        if (node && node.z !== z) next[rootId] = { ...node, z };
    });
    return next;
}

export function createCampaignDocStore() {
    return create<CampaignDocState>()((set, get) => {
        // Structural change outside a gesture: push the pre-state once, clear redo.
        const mutate = (patch: Partial<CampaignDocState>): void => {
            const state = get();
            if (state.gestureActive) {
                set((current) => ({ ...patch, version: current.version + 1 }));
                return;
            }
            const pre = snapshotHistory(state);
            set((current) => ({ ...patch, version: current.version + 1 }));
            const post = snapshotHistory(get());
            if (historyEquality(pre, post)) return;
            set((current) => ({
                past: [...current.past.slice(-(CAMPAIGN_HISTORY_LIMIT - 1)), pre],
                future: [],
            }));
        };

        const pushPre = (pre: CampaignDocHistory): void => {
            const post = snapshotHistory(get());
            if (historyEquality(pre, post)) return;
            set((current) => ({
                past: [...current.past.slice(-(CAMPAIGN_HISTORY_LIMIT - 1)), pre],
                future: [],
            }));
        };

        return {
            nodes: {},
            pages: [],
            activePageId: null,
            canvasHeight: CAMPAIGN_CANVAS.defaultHeight,
            selection: [],
            hover: null,
            viewport: { zoom: 1, panX: 0, panY: 0 },
            snapEnabled: true,
            editingId: null,
            version: 0,
            gestureActive: false,
            gesturePre: null,
            past: [],
            future: [],

            addNode: (draft, pageId) => {
                const state = get();
                const target = state.pages.find((page) => page.id === (pageId ?? state.activePageId)) ?? null;
                if (!target) return null;
                if (draft.parentId !== CAMPAIGN_STAGE_PARENT) return null;
                const id = draft.id ?? crypto.randomUUID();
                if (state.nodes[id]) return null;
                const node = { ...draft, id, parentId: CAMPAIGN_STAGE_PARENT, z: target.rootIds.length, locked: draft.locked ?? false } as CampaignNode;
                const pages = state.pages.map((page) =>
                    page.id === target.id ? { ...page, rootIds: [...page.rootIds, id] } : page,
                );
                const pre = snapshotHistory(state);
                set((current) => ({
                    nodes: { ...current.nodes, [id]: node },
                    pages,
                    version: current.version + 1,
                }));
                pushPre(pre);
                return id;
            },

            moveNode: (id, x, y) => {
                const node = get().nodes[id];
                if (!node || node.locked) return;
                mutate({ nodes: { ...get().nodes, [id]: { ...node, x, y } } });
            },

            moveNodesBy: (ids, dx, dy) => {
                if (dx === 0 && dy === 0) return;
                const current = get().nodes;
                let touched = false;
                const nodes = { ...current };
                for (const id of ids) {
                    const node = current[id];
                    if (!node || node.locked) continue;
                    nodes[id] = { ...node, x: node.x + dx, y: node.y + dy };
                    touched = true;
                }
                if (!touched) return;
                mutate({ nodes });
            },

            resizeNode: (id, w, h) => {
                const node = get().nodes[id];
                if (!node || node.locked) return;
                mutate({ nodes: { ...get().nodes, [id]: { ...node, w, h } } });
            },

            rotateNode: (id, rotation) => {
                const node = get().nodes[id];
                if (!node || node.locked) return;
                mutate({ nodes: { ...get().nodes, [id]: { ...node, rotation } } });
            },

            setOpacity: (id, opacity) => {
                const node = get().nodes[id];
                if (!node || !Number.isFinite(opacity)) return;
                mutate({ nodes: { ...get().nodes, [id]: { ...node, opacity } } });
            },

            updateProps: (id, patch) => {
                const node = get().nodes[id];
                if (!node) return;
                mutate({
                    nodes: {
                        ...get().nodes,
                        [id]: { ...node, props: { ...node.props, ...patch } } as CampaignNode,
                    },
                });
            },

            removeNode: (id) => {
                const state = get();
                const target = state.nodes[id];
                if (!target || target.locked) return;
                const nodes: Record<string, CampaignNode> = {};
                for (const [key, node] of Object.entries(state.nodes)) {
                    if (key !== id) nodes[key] = node;
                }
                const pages = state.pages.map((page) =>
                    page.rootIds.includes(id)
                        ? { ...page, rootIds: page.rootIds.filter((rootId) => rootId !== id) }
                        : page,
                );
                let renumbered = nodes;
                for (const page of pages) {
                    renumbered = renumberPageZ(renumbered, page.rootIds);
                }
                const pre = snapshotHistory(state);
                set((current) => ({
                    nodes: renumbered,
                    pages,
                    selection: state.selection.filter((selected) => selected !== id),
                    version: current.version + 1,
                }));
                pushPre(pre);
            },

            setLocked: (id, locked) => {
                const node = get().nodes[id];
                if (!node || node.locked === locked) return;
                mutate({ nodes: { ...get().nodes, [id]: { ...node, locked } } });
                if (locked && get().selection.includes(id)) {
                    get().selectNodes(get().selection.filter((selected) => selected !== id));
                }
            },

            toggleLock: (id) => {
                const node = get().nodes[id];
                if (!node) return;
                get().setLocked(id, !node.locked);
            },

            reorderNode: (id, direction) => {
                const state = get();
                const page = pageOfNode(state.pages, id);
                if (!page) return;
                const index = page.rootIds.indexOf(id);
                const next = direction === "up" ? index + 1 : index - 1;
                if (index < 0 || next < 0 || next >= page.rootIds.length) return;
                const rootIds = [...page.rootIds];
                const other = rootIds[next];
                if (other === undefined) return;
                rootIds[next] = id;
                rootIds[index] = other;
                const pages = state.pages.map((candidate) =>
                    candidate.id === page.id ? { ...page, rootIds } : candidate,
                );
                mutate({ nodes: renumberPageZ(state.nodes, rootIds), pages });
            },

            reorderNodeTo: (id, toIndex) => {
                const state = get();
                const page = pageOfNode(state.pages, id);
                if (!page) return;
                const from = page.rootIds.indexOf(id);
                if (from < 0) return;
                const clamped = Math.max(0, Math.min(page.rootIds.length - 1, Math.floor(toIndex)));
                if (clamped === from) return;
                const rootIds = page.rootIds.filter((rootId) => rootId !== id);
                rootIds.splice(clamped, 0, id);
                const pages = state.pages.map((candidate) =>
                    candidate.id === page.id ? { ...page, rootIds } : candidate,
                );
                mutate({ nodes: renumberPageZ(state.nodes, rootIds), pages });
            },

            selectNodes: (ids) => {
                const nodes = get().nodes;
                set({ selection: Array.from(new Set(ids)).filter((id) => !nodes[id]?.locked) });
            },

            setHover: (id) => {
                set({ hover: id });
            },

            setEditingId: (id) => {
                set({ editingId: id });
            },

            setViewport: (patch) => {
                set((state) => ({ viewport: { ...state.viewport, ...patch } }));
            },

            setSnapEnabled: (enabled) => {
                set({ snapEnabled: enabled });
            },

            setActivePage: (pageId) => {
                const state = get();
                if (!state.pages.some((page) => page.id === pageId)) return;
                if (state.activePageId === pageId) return;
                set({ activePageId: pageId, selection: [], editingId: null });
            },

            setCanvasHeight: (height) => {
                const next = clampCanvasHeight(height);
                if (get().canvasHeight === next) return;
                mutate({ canvasHeight: next });
            },

            beginGesture: () => {
                const state = get();
                if (state.gestureActive) return;
                set({ gestureActive: true, gesturePre: snapshotHistory(state) });
            },

            endGesture: () => {
                const state = get();
                if (!state.gestureActive || !state.gesturePre) return;
                const pre = state.gesturePre;
                set({ gestureActive: false, gesturePre: null });
                pushPre(pre);
            },

            hydrate: (doc) => {
                const state = get();
                if (Object.keys(state.nodes).length > 0) return;
                set({
                    nodes: { ...doc.nodes },
                    pages: doc.pages.map((page: CampaignPage) => ({ ...page, rootIds: [...page.rootIds] })),
                    activePageId: doc.activePageId,
                    canvasHeight: clampCanvasHeight(doc.canvasHeight),
                    selection: [],
                    past: [],
                    future: [],
                });
            },

            loadDoc: (doc) => {
                set({
                    nodes: { ...doc.nodes },
                    pages: doc.pages.map((page: CampaignPage) => ({ ...page, rootIds: [...page.rootIds] })),
                    activePageId: doc.pages[0]?.id ?? null,
                    canvasHeight: clampCanvasHeight(doc.canvas.height),
                    selection: [],
                    editingId: null,
                    gestureActive: false,
                    gesturePre: null,
                    past: [],
                    future: [],
                });
            },

            undo: () => {
                const state = get();
                if (state.gestureActive || state.past.length === 0) return;
                const pre = snapshotHistory(state);
                const prev = state.past[state.past.length - 1];
                if (!prev) return;
                set((current) => ({
                    nodes: prev.nodes,
                    pages: prev.pages,
                    activePageId: prev.activePageId,
                    canvasHeight: prev.canvasHeight,
                    past: current.past.slice(0, -1),
                    future: [pre, ...current.future].slice(0, CAMPAIGN_HISTORY_LIMIT),
                    selection: [],
                    version: current.version + 1,
                }));
            },

            redo: () => {
                const state = get();
                if (state.gestureActive || state.future.length === 0) return;
                const pre = snapshotHistory(state);
                const [next, ...rest] = state.future;
                if (!next) return;
                set((current) => ({
                    nodes: next.nodes,
                    pages: next.pages,
                    activePageId: next.activePageId,
                    canvasHeight: next.canvasHeight,
                    past: [...current.past.slice(-(CAMPAIGN_HISTORY_LIMIT - 1)), pre],
                    future: rest,
                    selection: [],
                    version: current.version + 1,
                }));
            },
        };
    });
}
