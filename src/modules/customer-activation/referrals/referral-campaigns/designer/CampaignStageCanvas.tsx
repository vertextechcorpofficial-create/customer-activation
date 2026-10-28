"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { CAMPAIGN_CANVAS } from "./schema";
import type { CampaignNode } from "./schema";
import { CampaignNodeView } from "./CampaignNodeView";
import { activePageOf, clampCampaignZoom, type CampaignDocStore } from "./store";

const CampaignMoveable = dynamic(() => import("./CampaignMoveable").then((module) => module.CampaignMoveable), { ssr: false });

const CAMPAIGN_WORKSPACE_DOTS: CSSProperties = {
    backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
};

const CAMPAIGN_PASTE_OFFSET = 16;

let campaignCloneSequence = 0;

function nextCampaignCloneId(): string {
    campaignCloneSequence += 1;
    return `campaign-paste-${Date.now().toString(36)}-${campaignCloneSequence}`;
}

let campaignClipboard: readonly CampaignNode[] | null = null;

function snapshotCampaignClipboard(nodes: Readonly<Record<string, CampaignNode>>, ids: readonly string[]): void {
    const picked: CampaignNode[] = [];
    for (const id of ids) {
        const node = nodes[id];
        if (node) picked.push({ ...node, props: { ...node.props } } as CampaignNode);
    }
    campaignClipboard = picked.length > 0 ? picked : null;
}

function pasteCampaignClipboard(store: CampaignDocStore): string[] {
    const clip = campaignClipboard;
    if (!clip || clip.length === 0) return [];
    const state = store.getState();
    const page = activePageOf(state);
    if (!page) return [];
    const baseZ = page.rootIds.length;
    let rootOffset = 0;
    const created: string[] = [];
    state.beginGesture();
    for (const node of clip) {
        const createdId = state.addNode(
            {
                ...node,
                id: nextCampaignCloneId(),
                parentId: "stage",
                x: node.x + CAMPAIGN_PASTE_OFFSET,
                y: node.y + CAMPAIGN_PASTE_OFFSET,
                z: baseZ + rootOffset,
                props: { ...node.props },
            },
            page.id,
        );
        if (createdId) {
            created.push(createdId);
            rootOffset += 1;
        }
    }
    store.getState().endGesture();
    return created;
}

function CampaignEmptyCanvasCta() {
    return (
        <div className="flex min-h-96 flex-col items-center pt-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <MousePointerClick aria-hidden="true" className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Start designing</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Add text, an image, or a shape to this campaign page.
            </p>
        </div>
    );
}

export interface CampaignStageCanvasProps {
    readonly store: CampaignDocStore;
}

export function CampaignStageCanvas({ store }: CampaignStageCanvasProps) {
    const nodes = store((state) => state.nodes);
    const pages = store((state) => state.pages);
    const selection = store((state) => state.selection);
    const selectNodes = store((state) => state.selectNodes);
    const editingId = store((state) => state.editingId);
    const zoom = store((state) => state.viewport.zoom);
    const canvasHeight = store((state) => state.canvasHeight);

    const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [panning, setPanning] = useState(false);
    const spaceRef = useRef(false);
    const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

    const page = pages[0] ?? null;
    const rootIds = page?.rootIds ?? [];
    const targetId = selection.find((id) => rootIds.includes(id)) ?? null;

    useEffect(() => {
        const onWheel = (event: WheelEvent): void => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const scope = scrollRef.current;
            const target = event.target;
            if (!scope || !(target instanceof HTMLElement) || !scope.contains(target)) return;
            event.preventDefault();
            const current = store.getState();
            current.setViewport({
                zoom: clampCampaignZoom(current.viewport.zoom * Math.exp(-event.deltaY * 0.002)),
            });
        };
        window.addEventListener("wheel", onWheel, { passive: false, capture: true });
        return () => window.removeEventListener("wheel", onWheel, { capture: true });
    }, [store]);

    useEffect(() => {
        const isSpaceKey = (event: KeyboardEvent): boolean => {
            return event.code === "Space" || event.key === " " || event.key === "Spacebar";
        };
        const shouldIgnoreSpace = (event: KeyboardEvent): boolean => {
            const element = event.target as HTMLElement | null;
            if (!element) return false;
            if (
                element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.tagName === "SELECT" ||
                element.isContentEditable
            ) {
                return true;
            }
            if (typeof element.closest === "function") {
                const overlay = element.closest(
                    "[role=\"dialog\"],[role=\"alertdialog\"],[role=\"menu\"],[role=\"listbox\"],[data-slot=\"popover-content\"],[data-radix-popper-content-wrapper]",
                );
                if (overlay) return true;
            }
            return false;
        };
        const releaseSpacePan = (): void => {
            const active = panRef.current;
            const scope = scrollRef.current;
            if (active && scope && typeof scope.hasPointerCapture === "function" && scope.hasPointerCapture(active.pointerId)) {
                scope.releasePointerCapture(active.pointerId);
            }
            panRef.current = null;
            spaceRef.current = false;
            setPanning(false);
            setSpaceHeld(false);
        };
        const onSpaceDown = (event: KeyboardEvent): void => {
            if (!isSpaceKey(event)) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (shouldIgnoreSpace(event)) return;
            event.preventDefault();
            if (event.repeat || spaceRef.current) return;
            spaceRef.current = true;
            setSpaceHeld(true);
        };
        const onSpaceUp = (event: KeyboardEvent): void => {
            if (!isSpaceKey(event)) return;
            if (spaceRef.current) event.preventDefault();
            releaseSpacePan();
        };
        window.addEventListener("keydown", onSpaceDown, true);
        window.addEventListener("keyup", onSpaceUp, true);
        window.addEventListener("blur", releaseSpacePan);
        return () => {
            window.removeEventListener("keydown", onSpaceDown, true);
            window.removeEventListener("keyup", onSpaceUp, true);
            window.removeEventListener("blur", releaseSpacePan);
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const element = event.target as HTMLElement | null;
            if (
                element &&
                (element.tagName === "INPUT" ||
                    element.tagName === "TEXTAREA" ||
                    element.tagName === "SELECT" ||
                    element.isContentEditable)
            ) {
                return;
            }

            const current = store.getState();
            const commandKey = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();

            if (commandKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) current.redo();
                else current.undo();
                return;
            }
            if (commandKey && key === "y") {
                event.preventDefault();
                current.redo();
                return;
            }

            if (commandKey && key === "a") {
                const ids = activePageOf(current)?.rootIds ?? [];
                if (ids.length === 0) return;
                event.preventDefault();
                current.selectNodes([...ids]);
                return;
            }

            if (commandKey && key === "c") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                snapshotCampaignClipboard(current.nodes, current.selection);
                return;
            }

            if (commandKey && key === "v") {
                event.preventDefault();
                const created = pasteCampaignClipboard(store);
                if (created.length > 0) current.selectNodes(created);
                return;
            }

            if (commandKey && key === "d") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                snapshotCampaignClipboard(current.nodes, current.selection);
                const created = pasteCampaignClipboard(store);
                if (created.length > 0) current.selectNodes(created);
                return;
            }

            if (event.key === "Escape") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                current.selectNodes([]);
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                current.beginGesture();
                for (const id of [...current.selection]) current.removeNode(id);
                current.endGesture();
                return;
            }

            if (event.key.startsWith("Arrow") && current.selection.length > 0) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                current.beginGesture();
                for (const id of current.selection) {
                    const node = current.nodes[id];
                    if (node) current.moveNode(id, node.x + dx, node.y + dy);
                }
                current.endGesture();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [store]);

    return (
        <div
            className="relative flex min-w-0 flex-1 flex-col overflow-auto"
            data-campaign-studio-scroll
            style={{ ...CAMPAIGN_WORKSPACE_DOTS, cursor: spaceHeld ? (panning ? "grabbing" : "grab") : undefined, touchAction: spaceHeld ? "none" : undefined }}
            ref={scrollRef}
            onPointerDownCapture={(event) => {
                if (!spaceRef.current) return;
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                const scope = scrollRef.current;
                if (!scope) return;
                panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                setPanning(true);
                scope.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                const scope = scrollRef.current;
                if (!scope) return;
                const dx = event.clientX - active.x;
                const dy = event.clientY - active.y;
                if (dx === 0 && dy === 0) return;
                scope.scrollLeft -= dx;
                scope.scrollTop -= dy;
                panRef.current = { pointerId: active.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                panRef.current = null;
                setPanning(false);
            }}
            onPointerCancel={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                panRef.current = null;
                setPanning(false);
            }}
        >
            <div className="mx-auto flex w-max min-w-full flex-col items-center px-4 py-8">
                <div className="mb-3 shrink-0" style={{ width: CAMPAIGN_CANVAS.width * zoom }}>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Campaign page · {CAMPAIGN_CANVAS.width} × {canvasHeight}
                    </span>
                </div>
                <div
                    className="shrink-0"
                    style={{ width: CAMPAIGN_CANVAS.width * zoom, height: canvasHeight * zoom }}
                >
                    <div
                        className="relative origin-top-left"
                        style={{
                            width: CAMPAIGN_CANVAS.width,
                            height: canvasHeight,
                            transform: `scale(${zoom})`,
                            transformOrigin: "top left",
                        }}
                        onPointerDown={(event) => {
                            if (event.target === event.currentTarget) selectNodes([]);
                        }}
                    >
                        <div
                            className="relative shrink-0 rounded-xl border bg-white text-black shadow-xl"
                            data-campaign-block="page"
                            style={{ width: CAMPAIGN_CANVAS.width, height: canvasHeight }}
                            onPointerDown={(event) => {
                                const current = store.getState();
                                if (current.editingId !== null) {
                                    current.endGesture();
                                    current.setEditingId(null);
                                    return;
                                }
                                const target = event.target as HTMLElement | null;
                                const onNode = target?.closest?.("[data-campaign-node]") != null;
                                const onMoveable = target?.closest?.("[class*='moveable-']") != null;
                                if (!event.shiftKey && !onNode && !onMoveable) {
                                    selectNodes([]);
                                }
                            }}
                            ref={setStageEl}
                        >
                            <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                                {page === null || rootIds.length === 0 ? (
                                    <CampaignEmptyCanvasCta />
                                ) : (
                                    rootIds.map((id) => {
                                        const node = nodes[id];
                                        if (!node) return null;
                                        return <CampaignNodeView key={id} node={node} store={store} />;
                                    })
                                )}
                            </div>
                            <CampaignMoveable
                                store={store}
                                stageEl={stageEl}
                                targetId={targetId}
                                editing={editingId !== null}
                                pageId={page?.id ?? null}
                                panning={spaceHeld}
                                canvasWidth={CAMPAIGN_CANVAS.width}
                                canvasHeight={canvasHeight}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
