"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const CAMPAIGN_TEXT_MAX = 5_000;

const CAMPAIGN_EDITOR_PLACEHOLDER = "Write text…";

interface CampaignInlineEditorProps {
    readonly nodeId: string;
    /** Plain text — the editor stores and renders no HTML. */
    readonly initialText: string;
    readonly autoFocus?: boolean;
    readonly onCommit: (text: string) => void;
    readonly onBeginGesture: () => void;
    readonly onEndGesture: () => void;
    readonly onRequestClose?: () => void;
}

export function CampaignInlineEditor({
    nodeId,
    initialText,
    autoFocus,
    onCommit,
    onBeginGesture,
    onEndGesture,
    onRequestClose,
}: CampaignInlineEditorProps) {
    const [draft, setDraft] = useState(initialText);
    const [prevId, setPrevId] = useState(nodeId);
    if (prevId !== nodeId) {
        setPrevId(nodeId);
        setDraft(initialText);
    }
    const committedRef = useRef(initialText);
    const areaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (autoFocus) areaRef.current?.focus();
    }, [nodeId, autoFocus]);

    const commit = (value: string): void => {
        if (value.length > CAMPAIGN_TEXT_MAX) return;
        if (value === committedRef.current) return;
        committedRef.current = value;
        onCommit(value);
    };

    return (
        <textarea
            aria-label="Edit text on canvas"
            aria-multiline="true"
            className={cn(
                "h-full w-full resize-none overflow-hidden bg-transparent p-1.5 text-sm leading-relaxed text-foreground",
                "focus:outline-none",
            )}
            maxLength={CAMPAIGN_TEXT_MAX}
            placeholder={CAMPAIGN_EDITOR_PLACEHOLDER}
            ref={areaRef}
            spellCheck={false}
            value={draft}
            onBlur={() => {
                commit(draft);
                onEndGesture();
                onRequestClose?.();
            }}
            onChange={(event) => {
                setDraft(event.target.value);
                commit(event.target.value);
            }}
            onFocus={onBeginGesture}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    commit(draft);
                    onEndGesture();
                    onRequestClose?.();
                }
            }}
        />
    );
}
