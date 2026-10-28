// Duplicated per-module by project rule: @/components/ui/status-badge renders every tone blue, so each module owns its StatusPill.
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "destructive";

const base = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium";

const toneClass: Record<Tone, string> = {
    neutral: "border bg-muted text-muted-foreground",
    info: "border-transparent bg-info/15 text-info",
    primary: "border-transparent bg-primary/15 text-primary",
    success: "border-transparent bg-success/15 text-success",
    warning: "border-transparent bg-warning/15 text-warning",
    destructive: "border-transparent bg-destructive/15 text-destructive",
};

export function StatusPill({
    children,
    tone = "neutral",
    className,
}: {
    children: React.ReactNode;
    tone?: Tone;
    className?: string;
}) {
    return (
        <span className={cn(base, toneClass[tone], className)}>
            {children}
        </span>
    );
}
