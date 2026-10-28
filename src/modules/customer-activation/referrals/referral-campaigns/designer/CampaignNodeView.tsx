"use client";

import { cn } from "@/lib/utils";
import type { CampaignNode } from "./schema";
import { CampaignNodeBody, campaignNodeText } from "./CampaignCardNode";
import { CampaignInlineEditor } from "./CampaignInlineEditor";
import type { CampaignDocStore } from "./store";

export interface CampaignNodeViewProps {
    readonly node: CampaignNode;
    readonly store: CampaignDocStore;
}

interface CampaignSnapGuidesOverlayProps {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export function CampaignSnapGuidesOverlay({ xLines, yLines }: CampaignSnapGuidesOverlayProps) {
    if (xLines.length === 0 && yLines.length === 0) return null;
    return (
        <div className="pointer-events-none absolute inset-0 z-40" data-testid="campaign-snap-guides">
            {xLines.map((line) => (
                <div
                    className="absolute top-0 bottom-0 bg-primary"
                    data-testid="campaign-snap-guide-vline"
                    key={`x-${line}`}
                    style={{ left: line - 0.5, width: 1 }}
                />
            ))}
            {yLines.map((line) => (
                <div
                    className="absolute left-0 right-0 bg-primary"
                    data-testid="campaign-snap-guide-line"
                    key={`y-${line}`}
                    style={{ top: line - 0.5, height: 1 }}
                />
            ))}
        </div>
    );
}

function campaignNodeLabel(node: CampaignNode): string {
    if (node.type !== "text") return node.type.charAt(0).toUpperCase() + node.type.slice(1);
    const text = campaignNodeText(node).trim().slice(0, 28);
    if (text.length > 0) return text;
    return "Text";
}

export function CampaignNodeView({ node, store }: CampaignNodeViewProps) {
    const selected = store((state) => state.selection.includes(node.id));
    const selectNodes = store((state) => state.selectNodes);
    const editingId = store((state) => state.editingId);
    const setEditingId = store((state) => state.setEditingId);
    const updateProps = store((state) => state.updateProps);
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);
    const label = campaignNodeLabel(node);

    if (node.type === "text" && editingId === node.id) {
        return (
            <div
                aria-label={`${node.type} block: ${label}`}
                className="campaign-block absolute overflow-hidden"
                data-campaign-node={node.id}
                style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    transform: `rotate(${node.rotation}deg)`,
                    zIndex: node.z,
                }}
            >
                <div
                    className="relative h-full w-full"
                    data-campaign-editing=""
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <CampaignInlineEditor
                        autoFocus
                        initialText={campaignNodeText(node)}
                        key={node.id}
                        nodeId={node.id}
                        onBeginGesture={beginGesture}
                        onCommit={(text) => {
                            const current = store.getState().nodes[node.id];
                            const currentText = current ? campaignNodeText(current) : "";
                            if (text !== currentText) updateProps(node.id, { text });
                        }}
                        onEndGesture={endGesture}
                        onRequestClose={() => setEditingId(null)}
                    />
                </div>
            </div>
        );
    }

    const stored = node.type === "text" ? campaignNodeText(node) : "";
    const showPlaceholder = node.type === "text" && stored.trim() === "";
    const enterEdit = (): void => {
        if (node.type !== "text" || node.locked) return;
        const current = store.getState();
        current.endGesture();
        current.setEditingId(node.id);
    };

    return (
        <div
            aria-label={`${node.type} block: ${label}`}
            className={cn(
                "campaign-block absolute overflow-hidden transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50",
            )}
            data-campaign-node={node.id}
            role="button"
            style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                transform: `rotate(${node.rotation}deg)`,
                zIndex: node.z,
                opacity: node.opacity,
            }}
            tabIndex={0}
            {...(node.locked ? { "data-locked": "" } : {})}
            onDoubleClick={() => enterEdit()}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (node.locked) return;
                    selectNodes([node.id]);
                }
            }}
        >
            {showPlaceholder ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground" onDoubleClick={enterEdit}>
                    Text
                </div>
            ) : (
                <div className="h-full w-full" onDoubleClick={enterEdit}>
                    <CampaignNodeBody node={node} />
                </div>
            )}
        </div>
    );
}
