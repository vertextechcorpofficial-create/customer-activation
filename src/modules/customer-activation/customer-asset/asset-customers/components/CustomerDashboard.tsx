"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import {
    AlertTriangle,
    ArrowUpRight,
    Boxes,
    Building2,
    CheckCircle2,
    ChevronRight,
    History,
    Package,
    Plus,
    RefreshCw,
    StickyNote,
    Undo2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import type { AssignmentRecord, Holding } from "../services/asset-customers-service";
import { BackButton } from "./BackButton";
import { RichTextEditor } from "./RichTextEditor";
import { StatusPill } from "./StatusPill";
import { formatHuman } from "../utils/datetime";

const DAY_MS = 86_400_000;

// Plain-text check for rich-text validation (mirrors the server preview strip).
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    return value.length >= 10 ? value.slice(0, 10) : value;
}

function toTime(value: string | null): number | null {
    if (!value) return null;
    const t = new Date(value.replace(" ", "T")).getTime();
    return Number.isFinite(t) ? t : null;
}

function assignmentLabel(status: string): string {
    const s = status.toLowerCase();
    if (s === "open") return "Open";
    if (s === "partial") return "Partial";
    if (s === "returned") return "Returned";
    return status;
}

function holdingTone(status: string): "info" | "warning" {
    return status.toLowerCase() === "open" ? "info" : "warning";
}

function viewingTone(status: string): "info" | "warning" | "success" | "neutral" {
    const s = status.toLowerCase();
    if (s === "open") return "info";
    if (s === "partial") return "warning";
    if (s === "returned") return "success";
    return "neutral";
}

function monogram(name: string): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
    return initials || "?";
}

function timeAgo(value: string | null, now: number): string {
    if (!value) return "—";
    const then = new Date(value.replace(" ", "T")).getTime();
    if (!Number.isFinite(then)) return value;
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function attentionLine(h: Holding, now: number): { text: string; late: boolean } {
    const t = toTime(h.expectedReturnAt);
    if (t === null) return { text: "no return date", late: false };
    const diffDays = Math.ceil((t - now) / DAY_MS);
    if (diffDays < 0) return { text: `${Math.floor((now - t) / DAY_MS)}d late`, late: true };
    if (diffDays === 0) return { text: "due today", late: false };
    return { text: `due in ${diffDays}d`, late: false };
}

function KpiCard({ label, value, icon, iconClass, toneClass, className = "", children }: {
    label: string;
    value: string;
    icon: ReactNode;
    iconClass: string;
    toneClass: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Card className={`shadow-none border border-border/60 dark:border-border ${toneClass} ${className}`.trimEnd()}>
            <CardContent className="space-y-1 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <span
                        aria-hidden
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${iconClass}`}
                    >
                        {icon}
                    </span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <div className="text-xs text-muted-foreground">{children}</div>
            </CardContent>
        </Card>
    );
}

export function CustomerDashboard({ id }: { id: number }) {
    const { detail, isLoading, error, refresh, addNote } = useCustomerDetail(id);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [now] = useState(() => Date.now());
    const [noteOpen, setNoteOpen] = useState(false);
    const [viewing, setViewing] = useState<AssignmentRecord | null>(null);

    const draftHasText = stripHtml(draft).length > 0;

    const submitDraft = async () => {
        if (!draftHasText || saving) return;
        setSaving(true);
        const ok = await addNote(draft);
        setSaving(false);
        if (ok) {
            setDraft("");
            setNoteOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-[1600px] space-y-4" aria-label="Loading customer">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <Skeleton className="h-72 w-full lg:col-span-2" />
                    <Skeleton className="h-72 w-full" />
                </div>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="mx-auto w-full max-w-[1600px]">
                <div className="mb-3">
                    <BackButton fallbackHref="/customer-activation/customer-asset/asset-customers" />
                </div>
                <Alert variant="destructive">
                    <AlertTitle>Could not load customer</AlertTitle>
                    <AlertDescription>{error ?? "Customer not found."}</AlertDescription>
                </Alert>
                <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
                    Retry
                </Button>
            </div>
        );
    }

    const { customer, holdings, history, notes, assetsHeld, openAssignments } = detail;

    const overdueCount = holdings.filter((h) => {
        const t = toTime(h.expectedReturnAt);
        return t !== null && t < now;
    }).length;
    const returnedCount = history.filter((h) => h.status.toLowerCase() === "returned").length;
    const distinctItems = new Set(holdings.map((h) => h.itemCode)).size;
    const nextReturnAt = [...holdings]
        .filter((h) => toTime(h.expectedReturnAt) !== null)
        .sort((a, b) => (toTime(a.expectedReturnAt) ?? 0) - (toTime(b.expectedReturnAt) ?? 0))[0]
        ?.expectedReturnAt ?? null;
    const nextReturnLabel = (() => {
        if (nextReturnAt === null) return "no upcoming returns";
        const t = toTime(nextReturnAt) ?? now;
        const diffDays = Math.ceil((t - now) / DAY_MS);
        return diffDays < 0
            ? `next ${formatDate(nextReturnAt)} · ${Math.floor((now - t) / DAY_MS)}d late`
            : `next ${formatDate(nextReturnAt)} · in ${diffDays}d`;
    })();
    const needsAttention = [...holdings].sort((a, b) => {
        const ta = toTime(a.expectedReturnAt);
        const tb = toTime(b.expectedReturnAt);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return ta - tb;
    });
    const totalUnits = holdings.reduce((sum, h) => sum + h.held, 0);

    const viewingExpected = viewing ? toTime(viewing.expectedReturnAt) : null;
    const viewingIsOpen = viewing
        ? viewing.status.toLowerCase() === "open" || viewing.status.toLowerCase() === "partial"
        : false;
    const viewingLate = viewingExpected !== null && viewingExpected < now && viewingIsOpen;
    const viewingDaysLate =
        viewingLate && viewingExpected !== null ? Math.floor((now - viewingExpected) / DAY_MS) : 0;
    const showReturnRemarks = viewing
        ? viewing.returnRemarks != null ||
          viewing.status.toLowerCase() === "returned" ||
          viewing.status.toLowerCase() === "partial"
        : false;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <div className="mb-3">
                <BackButton fallbackHref="/customer-activation/customer-asset/asset-customers" />
            </div>
            {/* 1. Hero */}
            <div className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] dark:border-primary/20 dark:bg-primary/[0.08]">
                <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground"
                        >
                            {monogram(customer.customer_name)}
                        </div>
                        <div className="min-w-0">
                            <h1
                                className="line-clamp-2 text-xl font-semibold tracking-tight leading-tight break-words sm:text-2xl"
                                title={customer.customer_name}
                            >
                                {customer.customer_name}
                            </h1>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="rounded-md border border-border bg-background/70 px-2 py-0.5 font-mono text-xs tabular-nums" title={customer.customer_code}>
                                    {customer.customer_code}
                                </span>
                                {customer.isActive ? (
                                    <StatusPill tone="success">Active</StatusPill>
                                ) : (
                                    <StatusPill tone="neutral">Inactive</StatusPill>
                                )}
                                {overdueCount > 0 && (
                                    <StatusPill tone="destructive">
                                        {overdueCount} Overdue
                                    </StatusPill>
                                )}
                            </div>
                            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Building2 className="size-3 shrink-0" aria-hidden />
                                Customer record (read-only)
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refresh} className="shrink-0">
                        <RefreshCw className="size-4" aria-hidden />
                    </Button>
                </div>
            </div>

            {/* 2. KPI row */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                <KpiCard
                    label="Units held"
                    value={String(assetsHeld)}
                    icon={<Boxes className="size-4" aria-hidden />}
                    iconClass="border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                    toneClass="bg-blue-50/50 border-t-2 border-t-blue-400 dark:bg-blue-950/20 dark:border-t-blue-800"
                >
                    across {distinctItems} item{distinctItems === 1 ? "" : "s"}
                </KpiCard>
                <KpiCard
                    label="Open assignments"
                    value={String(openAssignments)}
                    icon={<ArrowUpRight className="size-4" aria-hidden />}
                    iconClass="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    toneClass="bg-amber-50/50 border-t-2 border-t-amber-400 dark:bg-amber-950/20 dark:border-t-amber-800"
                >
                    {overdueCount > 0 ? (
                        <span className="font-semibold text-rose-700 dark:text-rose-300">
                            {overdueCount} overdue
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            All on schedule
                        </span>
                    )}
                </KpiCard>
                <KpiCard
                    label="Returns"
                    value={`${returnedCount}/${history.length}`}
                    icon={<Undo2 className="size-4" aria-hidden />}
                    iconClass="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    toneClass={overdueCount > 0 ? "bg-rose-50/50 border-t-2 border-t-rose-400 dark:bg-rose-950/20 dark:border-t-rose-800" : "bg-emerald-50/50 border-t-2 border-t-emerald-400 dark:bg-emerald-950/20 dark:border-t-emerald-800"}
                    className="col-span-2 sm:col-span-1"
                >
                    {nextReturnLabel}
                </KpiCard>
            </div>

            {/* 3. Top row: holdings + attention */}
            <div className="grid gap-3 lg:grid-cols-3 items-start">
                <Card className="shadow-none border-border/70 bg-card overflow-hidden lg:col-span-2 dark:border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="leading-none font-semibold">Current holdings</h2>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {holdings.length} item{holdings.length === 1 ? "" : "s"} · {totalUnits} unit{totalUnits === 1 ? "" : "s"}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 pb-0">
                        {holdings.length === 0 ? (
                            <div className="px-6 pb-6">
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyTitle>No holdings</EmptyTitle>
                                        <EmptyDescription>
                                            This customer is not holding any assets right now.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {holdings.map((h) => {
                                    const t = toTime(h.expectedReturnAt);
                                    const late = t !== null && t < now;
                                    return (
                                        <li
                                            key={h.taggingId}
                                            className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                                <span
                                                    aria-hidden
                                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                                                >
                                                    <Package className="size-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium" title={h.itemName}>
                                                        {h.itemName}
                                                    </p>
                                                    <p className="truncate font-mono text-xs text-muted-foreground tabular-nums" title={h.itemCode}>
                                                        {h.itemCode}
                                                    </p>
                                                    {h.tags.length > 0 && (
                                                        <span className="mt-1 flex items-center gap-1">
                                                            {h.tags.slice(0, 3).map((tag) => (
                                                                <span
                                                                    key={tag.id}
                                                                    role="img"
                                                                    aria-label={tag.tag_name}
                                                                    title={tag.tag_name}
                                                                    className="size-2.5 rounded-full border border-border"
                                                                    style={{ backgroundColor: tag.color ?? "transparent" }}
                                                                />
                                                            ))}
                                                            {h.tags.length > 3 && (
                                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                                    +{h.tags.length - 3}
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                <StatusPill tone={holdingTone(h.status)}>
                                                    {assignmentLabel(h.status)}
                                                </StatusPill>
                                                <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs tabular-nums">
                                                    ×{h.held}{h.held !== h.quantity ? `/${h.quantity}` : ""}
                                                </span>
                                                <span
                                                    className={`text-xs tabular-nums ${late ? "text-destructive" : "text-muted-foreground"}`}
                                                    title={h.expectedReturnAt ?? ""}
                                                >
                                                    {formatHuman(h.expectedReturnAt)}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none border-amber-200/60 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/10">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                                <AlertTriangle className="size-4" />
                            </span>
                            <h2 className="leading-none font-semibold">Needs attention</h2>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {needsAttention.length === 0 ? (
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                    <CheckCircle2 className="size-4" />
                                </span>
                                <p className="text-sm text-muted-foreground">Nothing overdue</p>
                            </div>
                        ) : (
                            <ul className="space-y-2.5">
                                {needsAttention.map((h) => {
                                    const line = attentionLine(h, now);
                                    return (
                                        <li key={h.taggingId} className="flex min-w-0 items-baseline justify-between gap-2">
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={h.itemName}>
                                                {h.itemName}
                                            </span>
                                            <span
                                                className={`shrink-0 text-xs tabular-nums ${line.late ? "font-semibold text-rose-700 dark:text-rose-300" : "text-amber-800 dark:text-amber-300"}`}
                                            >
                                                {line.text}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 4. Bottom row: history + notes */}
            <div className="grid gap-3 lg:grid-cols-3 items-start">
            <Card className="shadow-none border-border/70 bg-card overflow-hidden lg:col-span-2 dark:border-border">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="flex items-center gap-2 leading-none font-semibold">
                            <History className="size-4 text-muted-foreground" aria-hidden />
                            Assignment history
                        </h2>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                            {history.length} record{history.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {history.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">No assignments on record.</p>
                    ) : (
                        <div className="overflow-x-auto border-t border-border/50">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Tagged</TableHead>
                                        <TableHead>Closed</TableHead>
                                        <TableHead className="w-8">
                                            <span className="sr-only">Details</span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((h) => (
                                        <TableRow
                                            key={h.taggingId}
                                            onClick={() => setViewing(h)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") setViewing(h);
                                                if (e.key === " ") {
                                                    e.preventDefault();
                                                    setViewing(h);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`View assignment for ${h.itemName}`}
                                            className="cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                        >
                                            <TableCell className="min-w-0">
                                                <span className="block max-w-56 truncate font-medium" title={h.itemName}>
                                                    {h.itemName}
                                                </span>
                                                <span className="block max-w-40 truncate whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                                                    {h.itemCode}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs tabular-nums">
                                                {h.quantity}
                                                {h.returnedQuantity > 0 ? ` (${h.returnedQuantity} returned)` : ""}
                                            </TableCell>
                                            <TableCell>
                                                <StatusPill
                                                    tone={h.status.toLowerCase() === "open" ? "info" : "neutral"}
                                                    className="shrink-0"
                                                >
                                                    {assignmentLabel(h.status)}
                                                </StatusPill>
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate whitespace-nowrap text-sm tabular-nums" title={h.taggedAt ?? ""}>
                                                {formatHuman(h.taggedAt ?? null)}
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate whitespace-nowrap text-sm tabular-nums" title={h.closedAt ?? ""}>
                                                {formatHuman(h.closedAt ?? null)}
                                            </TableCell>
                                            <TableCell className="w-8 pr-4">
                                                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

                <Card className="shadow-none border-border/70 bg-card dark:border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="flex items-center gap-2 leading-none font-semibold">
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
                                >
                                    <StickyNote className="size-4" />
                                </span>
                                Notes
                            </h2>
                            <Button size="sm" onClick={() => setNoteOpen(true)}>
                                <Plus className="size-4" aria-hidden />
                                Add note
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {notes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No notes yet.</p>
                        ) : (
                            <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                                {notes.map((note) => (
                                    <li key={note.id}>
                                        <Link
                                            href={`/customer-activation/customer-asset/asset-customers/${id}/notes/${note.id}`}
                                            aria-label={`Read note from ${timeAgo(note.updated_at, now)}`}
                                            className="block rounded-md border border-l-2 border-l-border bg-muted/20 p-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                        >
                                            <p className="line-clamp-3 overflow-hidden text-sm">
                                                {note.preview || stripHtml(note.body) || "—"}
                                            </p>
                                            <span className="mt-2 flex items-center justify-between gap-2">
                                                <span
                                                    className="text-xs text-muted-foreground"
                                                    title={note.updated_at}
                                                >
                                                    {timeAgo(note.updated_at, now)}
                                                </span>
                                                <span
                                                    className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                                                    aria-hidden
                                                >
                                                    Read more
                                                    <ChevronRight className="size-3.5" />
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[480px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Add note</DialogTitle>
                        <DialogDescription>Internal note about this customer.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 px-6 py-6">
                        <RichTextEditor
                            value={draft}
                            onChange={setDraft}
                            placeholder="Add a note about this customer…"
                            ariaLabel="New note"
                        />
                        <DialogFooter className="-mx-6 -mb-6 justify-end border-t bg-muted/20 px-6 py-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="button"
                                onClick={() => void submitDraft()}
                                disabled={saving || !draftHasText}
                            >
                                {saving ? "Adding…" : "Add note"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[480px]">
                    <DialogHeader className="px-6 pt-6">
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                            >
                                <Package className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <DialogTitle className="truncate" title={viewing?.itemName ?? "Assignment"}>
                                    {viewing?.itemName ?? "Assignment"}
                                </DialogTitle>
                                <DialogDescription className="truncate">
                                    {viewing ? `${viewing.itemCode} · ${customer.customer_name}` : "—"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {viewing ? (
                        <>
                            <div className="max-h-[70dvh] overflow-y-auto px-6 py-6">
                                <div className="grid gap-4">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <StatusPill tone={viewingTone(viewing.status)} className="shrink-0">
                                            {assignmentLabel(viewing.status)}
                                        </StatusPill>
                                        {viewingLate ? (
                                            <StatusPill tone="destructive" className="shrink-0">
                                                Overdue
                                            </StatusPill>
                                        ) : null}
                                    </div>
                                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <div className="min-w-0 rounded-lg border px-2.5 py-2">
                                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Quantity
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                                {viewing.quantity}
                                            </dd>
                                        </div>
                                        <div className="min-w-0 rounded-lg border px-2.5 py-2">
                                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Returned
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                                {viewing.returnedQuantity}
                                            </dd>
                                        </div>
                                        <div className="min-w-0 rounded-lg border px-2.5 py-2">
                                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Held
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                                                {viewing.held}
                                            </dd>
                                        </div>
                                        <div className="min-w-0 rounded-lg border px-2.5 py-2">
                                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                Expected return
                                            </dt>
                                            <dd
                                                className={`mt-0.5 text-sm font-semibold tabular-nums ${viewingLate ? "text-rose-700 dark:text-rose-300" : ""}`}
                                                title={viewing.expectedReturnAt ?? ""}
                                            >
                                                {formatHuman(viewing.expectedReturnAt)}
                                                {viewingLate ? ` · ${viewingDaysLate}d late` : ""}
                                            </dd>
                                        </div>
                                    </dl>
                                    <p className="text-xs text-muted-foreground">
                                        Tagged{" "}
                                        <span title={viewing.taggedAt ?? ""}>
                                            {formatHuman(viewing.taggedAt)}
                                        </span>
                                        {viewing.closedAt ? (
                                            <>
                                                {" "}· Closed{" "}
                                                <span title={viewing.closedAt ?? ""}>
                                                    {formatHuman(viewing.closedAt)}
                                                </span>
                                            </>
                                        ) : (
                                            ""
                                        )}
                                    </p>
                                    <div className="grid gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Remarks
                                            </p>
                                            {viewing.remarks ? (
                                                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                                                    {viewing.remarks}
                                                </p>
                                            ) : (
                                                <p className="mt-1 text-sm text-muted-foreground">No remarks</p>
                                            )}
                                        </div>
                                        {showReturnRemarks ? (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    Return remarks
                                                </p>
                                                {viewing.returnRemarks ? (
                                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                                                        {viewing.returnRemarks}
                                                    </p>
                                                ) : (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        No return remarks
                                                    </p>
                                                )}
                                            </div>
                                        ) : null}
                                        {viewing.conditionOut || viewing.conditionIn ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {viewing.conditionOut ? (
                                                    <div className="min-w-0">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            Condition out
                                                        </p>
                                                        <p className="mt-1 break-words text-sm">
                                                            {viewing.conditionOut}
                                                        </p>
                                                    </div>
                                                ) : null}
                                                {viewing.conditionIn ? (
                                                    <div className="min-w-0">
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                            Condition in
                                                        </p>
                                                        <p className="mt-1 break-words text-sm">
                                                            {viewing.conditionIn}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Close
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

        </div>
    );
}
