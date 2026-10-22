import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Module-local status pill — plain span with utilities only.
 * (The shared StatusBadge renders every tone blue: its `.badge-*` classes
 * live in `@layer components` while shadcn Badge's `bg-primary` base is a
 * utility, and in Tailwind v4 utilities beat components. This sidesteps that
 * without touching the protected shared component.)
 */
export type Tone = "neutral" | "info" | "primary" | "success" | "warning" | "destructive";

const PILL_BASE = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium";

const TONE_CLASS: Record<Tone, string> = {
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
  ...rest
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn(PILL_BASE, TONE_CLASS[tone], className)} {...rest}>
      {children}
    </span>
  );
}
