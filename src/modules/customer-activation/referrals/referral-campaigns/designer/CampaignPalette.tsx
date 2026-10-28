"use client";

import { useState } from "react";
import { Circle, Image as ImageIcon, Minus, Square, Triangle, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CampaignDocStore, CampaignNodeDraft } from "./store";
import { CAMPAIGN_PIXEL_DATA_URL } from "./campaignSample";

export type CampaignPaletteKind = "text" | "image" | "shape-rect" | "shape-ellipse" | "shape-line" | "shape-triangle";

export interface CampaignPaletteDnD {
    readonly kind: CampaignPaletteKind;
}

export const CAMPAIGN_PALETTE_MIME = "application/x-campaign-palette";

const CAMPAIGN_TEXT_FONT = "Arial, Helvetica, sans-serif";

let campaignPaletteSequence = 0;

function nextPaletteId(): string {
    campaignPaletteSequence += 1;
    return `campaign-node-${Date.now().toString(36)}-${campaignPaletteSequence}`;
}

export function buildCampaignDraft(kind: CampaignPaletteKind): CampaignNodeDraft {
    if (kind === "text") {
        return {
            parentId: "stage",
            type: "text",
            x: 24,
            y: 24,
            w: 240,
            h: 44,
            rotation: 0,
            z: 0,
            opacity: 1,
            props: {
                text: "New text",
                fontFamily: CAMPAIGN_TEXT_FONT,
                fontSize: 16,
                fontWeight: "normal",
                italic: false,
                underline: false,
                strikethrough: false,
                color: "#111111",
                align: "left",
                letterSpacing: 0,
                lineHeight: 1.4,
            },
        };
    }
    if (kind === "image") {
        return {
            parentId: "stage",
            type: "image",
            x: 24,
            y: 24,
            w: 240,
            h: 160,
            rotation: 0,
            z: 0,
            opacity: 1,
            props: { src: CAMPAIGN_PIXEL_DATA_URL, alt: "", fit: "cover", radius: 0, mask: "none", opacity: 1 },
        };
    }
    const shape = kind === "shape-ellipse" ? "ellipse" : kind === "shape-line" ? "line" : kind === "shape-triangle" ? "triangle" : "rect";
    return {
        parentId: "stage",
        type: "shape",
        x: 24,
        y: 24,
        w: shape === "line" ? 240 : 120,
        h: shape === "line" ? 8 : 80,
        rotation: 0,
        z: 0,
        opacity: 1,
        props: { shape, fill: "#2563eb", borderColor: "#1e40af", borderWidth: 0, radius: 8, opacity: 1 },
    };
}

export function insertPaletteNode(store: CampaignDocStore, payload: CampaignPaletteDnD, at?: { x: number; y: number }, pageId?: string): string | null {
    const state = store.getState();
    const targetId = pageId ?? state.activePageId;
    const target = state.pages.find((page) => page.id === targetId) ?? null;
    if (!target) return null;
    const draft = buildCampaignDraft(payload.kind);
    const count = target.rootIds.length;
    const x = at ? Math.max(0, Math.round(at.x)) : 24 + (count % 6) * 16;
    const y = at ? Math.max(0, Math.round(at.y)) : 24 + (count % 6) * 16;
    const id = state.addNode({ ...draft, id: nextPaletteId(), x, y }, target.id);
    if (id) {
        state.setActivePage(target.id);
        state.selectNodes([id]);
    }
    return id;
}

function dragPayload(event: React.DragEvent, payload: CampaignPaletteDnD): void {
    event.dataTransfer.setData(CAMPAIGN_PALETTE_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
}

export function CampaignPalette({ store }: { readonly store: CampaignDocStore }) {
    const [query, setQuery] = useState("");

    const q = query.trim().toLowerCase();
    const match = (label: string): boolean => q === "" || label.toLowerCase().includes(q);

    const chipClass =
        "group flex w-full items-center gap-2 rounded-lg border bg-card p-2.5 text-left transition duration-150 hover:-translate-y-0.5 hover:border-primary/40";

    return (
        <aside aria-label="Components" className="flex h-full w-full flex-col bg-card md:w-60 md:border-r">
            <div className="flex h-11 shrink-0 items-center border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Components
                </span>
            </div>
            <div className="shrink-0 border-b p-2">
                <Input
                    aria-label="Search components"
                    className="h-8 text-xs"
                    placeholder="Search components…"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Text</h3>
                    {match("text") ? (
                        <button
                            className={chipClass}
                            draggable
                            type="button"
                            onClick={() => insertPaletteNode(store, { kind: "text" })}
                            onDragStart={(event) => dragPayload(event, { kind: "text" })}
                        >
                            <Type aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="text-xs font-medium">Text</span>
                        </button>
                    ) : null}
                </section>
                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Image</h3>
                    {match("photo image upload") ? (
                        <button
                            className={chipClass}
                            draggable
                            type="button"
                            onClick={() => insertPaletteNode(store, { kind: "image" })}
                            onDragStart={(event) => dragPayload(event, { kind: "image" })}
                        >
                            <ImageIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                            <span className="text-xs font-medium">Image</span>
                        </button>
                    ) : null}
                </section>
                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Shape</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { kind: "shape-rect" as const, label: "Rectangle", Icon: Square },
                            { kind: "shape-ellipse" as const, label: "Ellipse", Icon: Circle },
                            { kind: "shape-line" as const, label: "Line", Icon: Minus },
                            { kind: "shape-triangle" as const, label: "Triangle", Icon: Triangle },
                        ]
                            .filter((item) => match(item.label))
                            .map((item) => (
                                <button
                                    className={cn(chipClass, "flex-col items-center gap-1.5 p-3 text-center")}
                                    draggable
                                    key={item.kind}
                                    type="button"
                                    onClick={() => insertPaletteNode(store, { kind: item.kind })}
                                    onDragStart={(event) => dragPayload(event, { kind: item.kind })}
                                >
                                    <item.Icon aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-primary" />
                                    <span className="text-xs font-medium">{item.label}</span>
                                </button>
                            ))}
                    </div>
                </section>
            </div>
            <div className="shrink-0 border-t p-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">Drag a component onto the page, or click to add it. Images need alt text before saving.</p>
            </div>
        </aside>
    );
}
