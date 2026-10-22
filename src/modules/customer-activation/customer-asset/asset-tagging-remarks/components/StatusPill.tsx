import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "destructive" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
    success:
        "border-emerald-200! bg-emerald-50! text-emerald-700! dark:border-emerald-900! dark:bg-emerald-950/40! dark:text-emerald-300!",
    warning:
        "border-amber-200! bg-amber-50! text-amber-800! dark:border-amber-900! dark:bg-amber-950/40! dark:text-amber-300!",
    info: "border-blue-200! bg-blue-50! text-blue-700! dark:border-blue-900! dark:bg-blue-950/40! dark:text-blue-300!",
    destructive:
        "border-red-200! bg-red-50! text-red-700! dark:border-red-900! dark:bg-red-950/40! dark:text-red-300!",
    neutral:
        "border-zinc-200! bg-zinc-100! text-zinc-700! dark:border-zinc-800! dark:bg-zinc-900! dark:text-zinc-300!",
};

export function StatusPill({
    tone,
    children,
    className,
}: {
    tone: Tone;
    children: ReactNode;
    className?: string;
}) {
    return (
        <Badge variant="outline" className={cn(TONE_CLASSES[tone], className)}>
            {children}
        </Badge>
    );
}
