"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Redo2, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CAMPAIGN_CANVAS, campaignDocSchema, clampCanvasHeight } from "./schema";
import { clampCampaignZoom, createCampaignDocStore, CAMPAIGN_ZOOM_MAX, CAMPAIGN_ZOOM_MIN, CAMPAIGN_ZOOM_STEP } from "./store";
import { CampaignStageCanvas } from "./CampaignStageCanvas";
import { blankCampaignDoc, parseCampaignContentJson } from "./campaignSample";
import { CampaignPalette, CAMPAIGN_PALETTE_MIME, insertPaletteNode } from "./CampaignPalette";
import type { CampaignPaletteDnD } from "./CampaignPalette";
import { CampaignLayersPanel } from "./CampaignLayersPanel";
import { CampaignPropertyPanel } from "./CampaignPropertyPanel";
import {
    ContentSaveError,
    getCampaigns,
    updateCampaignContent,
} from "../providers/campaign-provider";

type CampaignInspectorTab = "props" | "layers";
type CampaignMobileTab = "components" | "canvas" | "inspector";

function normaliseContentJson(value: unknown): string {
    try {
        return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value);
    } catch {
        return "";
    }
}

export function CampaignEditor({ campaignId }: { readonly campaignId: number }) {
    const [store] = useState(() => createCampaignDocStore());
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [campaignTitle, setCampaignTitle] = useState("");
    const [campaignCode, setCampaignCode] = useState("");
    const [storedInvalid, setStoredInvalid] = useState<string[]>([]);
    const [savedVersion, setSavedVersion] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<CampaignInspectorTab>("props");
    const [mobileTab, setMobileTab] = useState<CampaignMobileTab>("canvas");

    const nodes = store((state) => state.nodes);
    const version = store((state) => state.version);
    const zoom = store((state) => state.viewport.zoom);
    const setViewport = store((state) => state.setViewport);
    const canvasHeight = store((state) => state.canvasHeight);
    const setCanvasHeight = store((state) => state.setCanvasHeight);
    const snapEnabled = store((state) => state.snapEnabled);
    const setSnapEnabled = store((state) => state.setSnapEnabled);
    const undo = store((state) => state.undo);
    const redo = store((state) => state.redo);
    const pastCount = store((state) => state.past.length);
    const futureCount = store((state) => state.future.length);

    const load = useCallback(async (): Promise<void> => {
        setStatus("loading");
        setLoadError(null);
        try {
            const campaigns = await getCampaigns();
            const row = campaigns.find((c) => c.campaign_id === campaignId) ?? null;
            if (!row) {
                setLoadError("No campaign found for this id.");
                setStatus("error");
                return;
            }
            setCampaignTitle(row.title);
            setCampaignCode(row.campaign_code);
            const raw = parseCampaignContentJson(row.content_json);
            if (raw === null) {
                store.getState().loadDoc(blankCampaignDoc());
                setStoredInvalid([]);
            } else {
                const result = campaignDocSchema.safeParse(raw);
                if (!result.success) {
                    setStoredInvalid(result.error.issues.map((issue) => `${String(issue.path.join(".") || "(document)")}: ${issue.message}`));
                    toast.error("Saved content failed validation — starting from a blank page.");
                    store.getState().loadDoc(blankCampaignDoc());
                } else {
                    setStoredInvalid([]);
                    store.getState().loadDoc(result.data);
                }
            }
            setSavedVersion(store.getState().version);
            setStatus("ready");
        } catch (cause) {
            setLoadError(cause instanceof Error ? cause.message : "Failed to load the campaign.");
            setStatus("error");
        }
    }, [store, campaignId]);

    useEffect(() => {
        void load();
    }, [load]);

    const dirty = savedVersion !== null && version !== savedVersion;

    // Warn before discarding unsaved changes via browser chrome.
    useEffect(() => {
        if (!dirty || status !== "ready") return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty, status]);

    const confirmDiscard = useCallback(() => {
        if (!dirty) return true;
        return window.confirm("Discard unsaved canvas changes?");
    }, [dirty]);

    const overflowIds = Object.values(nodes)
        .filter((node) => node.x < 0 || node.y < 0 || node.x + node.w > CAMPAIGN_CANVAS.width || node.y + node.h > canvasHeight)
        .map((node) => node.id);

    const altMissingIds = Object.values(nodes)
        .filter((node) => node.type === "image" && (typeof node.props.alt !== "string" || node.props.alt.trim() === ""))
        .map((node) => node.id);

    const handleSave = useCallback(async (): Promise<void> => {
        const state = store.getState();
        const doc = {
            version: 2 as const,
            canvas: { width: CAMPAIGN_CANVAS.width as 800, height: state.canvasHeight },
            pages: state.pages,
            nodes: state.nodes,
        };
        const parsed = campaignDocSchema.safeParse(doc);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Canvas failed validation.");
            return;
        }
        setSaving(true);
        try {
            const row = await updateCampaignContent(campaignId, parsed.data);
            const campaigns = await getCampaigns();
            const verify = campaigns.find((c) => c.campaign_id === campaignId) ?? null;
            const verified = verify !== null && normaliseContentJson(verify.content_json) === normaliseContentJson(row.content_json ?? parsed.data);
            if (!verified) {
                toast.error("Save verification failed — please reload and try again.");
                return;
            }
            setSavedVersion(store.getState().version);
            toast.success("Canvas saved.");
        } catch (cause) {
            if (cause instanceof ContentSaveError && cause.errors.length > 0) {
                toast.error(cause.errors[0]?.message ?? "The server refused this canvas.");
            } else {
                toast.error(cause instanceof Error ? cause.message : "Save failed.");
            }
        } finally {
            setSaving(false);
        }
    }, [store, campaignId]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void handleSave();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleSave]);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>): void => {
            const raw = event.dataTransfer.getData(CAMPAIGN_PALETTE_MIME);
            if (!raw) return;
            event.preventDefault();
            let payload: CampaignPaletteDnD;
            try {
                payload = JSON.parse(raw) as CampaignPaletteDnD;
            } catch {
                return;
            }
            if (!payload || typeof payload.kind !== "string") return;
            const state = store.getState();
            const currentZoom = state.viewport.zoom || 1;
            const host = event.currentTarget;
            let at: { x: number; y: number } | undefined;
            let dropPageId: string | undefined;
            const blocks = host.querySelectorAll("[data-campaign-block]");
            for (const block of Array.from(blocks)) {
                if (!(block instanceof HTMLElement)) continue;
                const rect = block.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
                    continue;
                }
                dropPageId = state.pages[0]?.id;
                at = {
                    x: Math.max(0, (event.clientX - rect.left) / currentZoom - 60),
                    y: Math.max(0, (event.clientY - rect.top) / currentZoom - 20),
                };
                break;
            }
            insertPaletteNode(store, payload, at, dropPageId);
        },
        [store],
    );

    const dropHandlers = {
        onDragOver: (event: React.DragEvent<HTMLDivElement>): void => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        onDrop: handleDrop,
    };

    const zoomPercent = Math.round(zoom * 100);

    const handleZoomFit = useCallback((): void => {
        const scroll = document.querySelector("[data-campaign-studio-scroll]");
        const avail = (scroll instanceof HTMLElement ? scroll.clientWidth : CAMPAIGN_CANVAS.width) - 32;
        setViewport({ zoom: clampCampaignZoom(avail / CAMPAIGN_CANVAS.width) });
    }, [setViewport]);

    if (status === "loading") {
        return (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-3" role="status" aria-label="Loading campaign">
                <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading campaign…</p>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center">
                <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border bg-card px-4 py-16 text-center">
                    <p className="text-sm text-muted-foreground">{loadError ?? "Could not load that campaign."}</p>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
                        <Button size="sm" asChild>
                            <Link href="/customer-activation/referrals/referral-campaigns">Back to campaigns</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const inspector = (
        <div className="flex min-h-0 w-full flex-1 flex-col">
            <div aria-label="Inspector" className="flex shrink-0 items-center gap-1 border-b p-2" role="tablist">
                <Button aria-selected={inspectorTab === "props"} role="tab" className="flex-1" size="sm" variant={inspectorTab === "props" ? "secondary" : "ghost"} onClick={() => setInspectorTab("props")}>Properties</Button>
                <Button aria-selected={inspectorTab === "layers"} role="tab" className="flex-1" size="sm" variant={inspectorTab === "layers" ? "secondary" : "ghost"} onClick={() => setInspectorTab("layers")}>Layers</Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {inspectorTab === "props" ? <CampaignPropertyPanel store={store} /> : <CampaignLayersPanel store={store} />}
            </div>
        </div>
    );

    const workspace = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" {...dropHandlers}>
            <CampaignStageCanvas store={store} />
        </div>
    );

    return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
                <Button
                    aria-label="Back to campaigns"
                    size="icon-sm"
                    variant="ghost"
                    asChild
                    onClick={(e) => {
                        if (!confirmDiscard()) e.preventDefault();
                    }}
                >
                    <Link href="/customer-activation/referrals/referral-campaigns"><ArrowLeft /></Link>
                </Button>
                <span className="max-w-32 truncate px-2 text-sm font-medium sm:max-w-56" title={campaignTitle}>{campaignTitle}</span>
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline" title={campaignCode}>{campaignCode}</span>
                <span aria-live="polite" className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                    {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
                    <Button aria-label="Undo" disabled={pastCount === 0} size="icon-sm" variant="ghost" onClick={() => undo()}><Undo2 /></Button>
                    <Button aria-label="Redo" disabled={futureCount === 0} size="icon-sm" variant="ghost" onClick={() => redo()}><Redo2 /></Button>
                    <Button aria-label="Zoom out" disabled={zoom <= CAMPAIGN_ZOOM_MIN} size="icon-sm" variant="ghost" onClick={() => setViewport({ zoom: clampCampaignZoom(zoom - CAMPAIGN_ZOOM_STEP) })}><ZoomOut /></Button>
                    <Button
                        aria-label={`${zoomPercent}%, activate to reset to 100 percent`}
                        aria-live="polite"
                        className="hidden w-11 px-1 text-xs tabular-nums sm:inline-flex"
                        size="sm"
                        title="Reset zoom to 100%"
                        type="button"
                        variant="ghost"
                        onClick={() => setViewport({ zoom: 1 })}
                    >
                        {zoomPercent}%
                    </Button>
                    <Button aria-label="Zoom in" disabled={zoom >= CAMPAIGN_ZOOM_MAX} size="icon-sm" variant="ghost" onClick={() => setViewport({ zoom: clampCampaignZoom(zoom + CAMPAIGN_ZOOM_STEP) })}><ZoomIn /></Button>
                    <Button
                        aria-label="Fit canvas width"
                        className="px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={handleZoomFit}
                    >
                        Fit
                    </Button>
                    <Button aria-label="Save campaign canvas" className="shrink-0 max-sm:px-2" disabled={saving} size="sm" onClick={() => void handleSave()}>
                        {saving ? <Loader2 className="animate-spin" /> : <Save />}
                        <span className="hidden min-[400px]:inline">{saving ? "Saving…" : "Save"}</span>
                    </Button>
                </div>
            </header>
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-canvas-height">Page height</Label>
                    <Input
                        aria-describedby="campaign-canvas-height-hint"
                        className="h-8 w-24 text-xs tabular-nums"
                        id="campaign-canvas-height"
                        inputMode="numeric"
                        max={CAMPAIGN_CANVAS.maxHeight}
                        min={CAMPAIGN_CANVAS.minHeight}
                        step={100}
                        type="number"
                        value={canvasHeight}
                        onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (Number.isFinite(parsed)) setCanvasHeight(clampCanvasHeight(parsed));
                        }}
                    />
                </div>
                <p id="campaign-canvas-height-hint" className="text-[11px] text-muted-foreground">
                    {CAMPAIGN_CANVAS.minHeight}–{CAMPAIGN_CANVAS.maxHeight}px, width fixed at {CAMPAIGN_CANVAS.width}px.
                </p>
                <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="campaign-canvas-snap">Snapping</Label>
                    <Switch checked={snapEnabled} id="campaign-canvas-snap" size="sm" onCheckedChange={setSnapEnabled} />
                </div>
                {altMissingIds.length > 0 ? (
                    <p className="text-[11px] font-medium text-destructive" role="alert">
                        {altMissingIds.length} image{altMissingIds.length === 1 ? "" : "s"} missing alt text — saving is blocked.
                    </p>
                ) : null}
                {overflowIds.length > 0 ? (
                    <p className="text-[11px] font-medium text-destructive" role="alert">
                        {overflowIds.length} block{overflowIds.length === 1 ? "" : "s"} past the page edge: {overflowIds.slice(0, 6).join(", ")}{overflowIds.length > 6 ? ` +${overflowIds.length - 6} more` : ""}
                    </p>
                ) : null}
                {storedInvalid.length > 0 ? (
                    <p className="text-[11px] font-medium text-destructive" role="alert">
                        Saved content was invalid, so the editor started blank. Saving overwrites it.
                    </p>
                ) : null}
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="hidden shrink-0 md:block">
                    <CampaignPalette store={store} />
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div aria-label="Editor view" className="flex shrink-0 items-center gap-1 border-b bg-card p-2 md:hidden" role="tablist">
                        {([
                            { value: "components", label: "Components" },
                            { value: "canvas", label: "Canvas" },
                            { value: "inspector", label: "Inspector" },
                        ] as const).map((tab) => (
                            <Button aria-selected={mobileTab === tab.value} role="tab" className={cn("flex-1")} key={tab.value} size="sm" variant={mobileTab === tab.value ? "secondary" : "ghost"} onClick={() => setMobileTab(tab.value)}>{tab.label}</Button>
                        ))}
                    </div>
                    <div className={mobileTab === "components" ? "min-h-0 flex-1 overflow-y-auto md:hidden" : "hidden"}>
                        <CampaignPalette store={store} />
                    </div>
                    <div className={mobileTab === "inspector" ? "flex min-h-0 flex-1 flex-col overflow-hidden md:hidden" : "hidden"}>
                        {inspector}
                    </div>
                    <div className={mobileTab === "canvas" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "hidden min-h-0 flex-1 flex-col overflow-hidden md:flex"}>
                        {workspace}
                    </div>
                </div>
                <div className="hidden w-[280px] shrink-0 flex-col border-l bg-card lg:flex">
                    {inspector}
                </div>
            </div>
        </div>
    );
}
