"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Boxes, Package, PackageCheck, RefreshCw, Truck, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAssetReportDetail } from "../hooks/useAssetReportDetail";
import { BackButton } from "./BackButton";
import { StatusPill } from "./StatusPill";

function isRetired(value: number | string | boolean | 0 | 1): boolean {
    return value === true || value === 1 || value === "1";
}

function formatPeso(value: number | string): string {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStamp(value: string | null): string {
    if (!value) return "—";
    return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
}

const humanDateFmt = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

function formatDate(value: string | null): string {
    if (!value) return "—";
    const day = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return day;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return day;
    return humanDateFmt.format(date);
}

const stampFmt = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

function formatHistoryStamp(value: string): string {
    const time = new Date(value.replace(" ", "T")).getTime();
    if (!Number.isFinite(time)) return formatStamp(value);
    return stampFmt.format(new Date(time));
}

function monogram(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function eventLabel(event: string): string {
    switch (event) {
        case "registered":
            return "Registered";
        case "tagged_to_customer":
            return "Tagged to customer";
        case "returned":
            return "Returned";
        case "retired":
            return "Retired";
        default:
            return "Quantity adjusted";
    }
}

function eventDot(event: string): string {
    switch (event) {
        case "registered":
            return "bg-blue-500";
        case "tagged_to_customer":
            return "bg-amber-500";
        case "returned":
            return "bg-emerald-500";
        case "retired":
            return "bg-zinc-400";
        default:
            return "bg-violet-500";
    }
}

function KpiCard({
    label,
    value,
    icon,
    iconClass,
    toneClass,
    className = "",
    children,
}: {
    label: string;
    value: string;
    icon: ReactNode;
    iconClass: string;
    toneClass: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Card
            className={`shadow-none border border-border/60 dark:border-border ${toneClass} ${className}`.trimEnd()}
        >
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
                <p className="truncate text-2xl font-semibold tabular-nums" title={value}>
                    {value}
                </p>
                <div className="truncate text-xs text-muted-foreground">{children}</div>
            </CardContent>
        </Card>
    );
}

export function AssetReportDetail({ id }: { id: number }) {
    const router = useRouter();
    const { detail, isLoading, error, refresh } = useAssetReportDetail(id);

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-[1600px] space-y-4" aria-label="Loading asset report">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <div className="grid gap-3 lg:grid-cols-3 items-start">
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
                    <BackButton fallbackHref="/customer-activation/customer-asset/asset-reports" />
                </div>
                <Alert variant="destructive">
                    <AlertTitle>Could not load asset report</AlertTitle>
                    <AlertDescription>{error ?? "Asset not found."}</AlertDescription>
                </Alert>
                <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
                    Retry
                </Button>
            </div>
        );
    }

    const { item, tags, stock, valuation, holders, history } = detail;
    const retired = isRetired(item.is_retired as 0 | 1);
    const cost = typeof item.cost_per_item === "number" ? item.cost_per_item : Number(item.cost_per_item);
    const lifeSpan =
        typeof valuation.life_span_months === "number" ? valuation.life_span_months : null;
    // Radix reports indeterminate (no aria-valuenow) unless Root receives a
    // finite number. The shared Progress wrapper keeps `value` for its
    // indicator only, so pass the clamped number explicitly together with the
    // matching accessible attributes (do not edit the shared primitive).
    const depreciationRaw =
        typeof valuation.depreciation_pct === "number"
            ? valuation.depreciation_pct
            : Number(valuation.depreciation_pct);
    const depreciationPct = Number.isFinite(depreciationRaw)
        ? Math.min(100, Math.max(0, depreciationRaw))
        : 0;
    const depreciationCaption =
        lifeSpan !== null
            ? `${valuation.elapsed_months} of ${lifeSpan} months depreciated · ${depreciationPct}%`
            : `${valuation.elapsed_months} months elapsed · ${depreciationPct}%`;
    const overdueCount = holders.filter((holder) => holder.overdue).length;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <div className="mb-3">
                <BackButton fallbackHref="/customer-activation/customer-asset/asset-reports" />
            </div>
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] dark:border-primary/20 dark:bg-primary/[0.08]">
                <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Refresh asset report"
                            onClick={refresh}
                            className="-mr-2 -mt-1 shrink-0"
                        >
                            <RefreshCw className="size-4" aria-hidden />
                        </Button>
                    </div>
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                            aria-hidden
                            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
                        >
                            <Package className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1
                                className="line-clamp-2 text-xl font-semibold tracking-tight sm:text-2xl"
                                title={item.name}
                            >
                                {item.name}
                            </h1>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span
                                    className="rounded-md border border-border bg-background/70 px-2 py-0.5 font-mono text-xs tabular-nums"
                                    title={item.item_code}
                                >
                                    {item.item_code}
                                </span>
                                {retired ? (
                                    <StatusPill tone="neutral" className="shrink-0">Retired</StatusPill>
                                ) : (
                                    <StatusPill tone="success" className="shrink-0">Active</StatusPill>
                                )}
                                {item.group_name ? (
                                    <span
                                        className="inline-flex max-w-48 items-center truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                        title={item.group_name}
                                    >
                                        <span className="truncate">{item.group_name}</span>
                                    </span>
                                ) : null}
                            </div>
                            {tags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {tags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            role="img"
                                            aria-label={tag.tag_name}
                                            title={tag.tag_name}
                                            className="inline-flex max-w-40 items-center gap-1.5 truncate rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                        >
                                            <span
                                                aria-hidden
                                                className="size-2.5 shrink-0 rounded-full border"
                                                style={tag.color ? { backgroundColor: tag.color } : undefined}
                                            />
                                            <span className="truncate">{tag.tag_name}</span>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                                Last purchase {formatDate(item.last_purchase_at)} · Acquired {formatDate(item.date_acquired)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Units on hand"
                    value={String(stock.total)}
                    icon={<Boxes className="size-4" aria-hidden />}
                    iconClass="border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                    toneClass="bg-blue-50/50 border-t-2 border-t-blue-400 dark:bg-blue-950/20 dark:border-t-blue-800"
                >
                    {item.group_name ?? "unassigned"}
                </KpiCard>
                <KpiCard
                    label="Available"
                    value={String(stock.available)}
                    icon={<PackageCheck className="size-4" aria-hidden />}
                    iconClass="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    toneClass="bg-emerald-50/50 border-t-2 border-t-emerald-400 dark:bg-emerald-950/20 dark:border-t-emerald-800"
                >
                    {stock.out} out on assignment
                </KpiCard>
                <KpiCard
                    label="Out"
                    value={String(stock.out)}
                    icon={<Truck className="size-4" aria-hidden />}
                    iconClass="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    toneClass="bg-amber-50/50 border-t-2 border-t-amber-400 dark:bg-amber-950/20 dark:border-t-amber-800"
                >
                    {overdueCount > 0 ? (
                        <span className="font-semibold text-rose-700 dark:text-rose-300">
                            {holders.length} holder{holders.length === 1 ? "" : "s"} · {overdueCount} overdue
                        </span>
                    ) : (
                        <span>
                            {holders.length} holder{holders.length === 1 ? "" : "s"}
                        </span>
                    )}
                </KpiCard>
                <KpiCard
                    label="Projected total value"
                    value={formatPeso(valuation.total_value)}
                    icon={<Wallet className="size-4" aria-hidden />}
                    iconClass="border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15"
                    toneClass="bg-primary/[0.04] border-t-2 border-t-primary/60 dark:bg-primary/[0.08]"
                    className="col-span-2 lg:col-span-1"
                >
                    {formatPeso(valuation.unit_value)} / unit
                </KpiCard>
            </div>

            <div className="grid gap-3 lg:grid-cols-3 items-start">
                {/* Left: valuation + holders */}
                <div className="min-w-0 space-y-3 lg:col-span-2">
                    <Card className="shadow-none border border-border/60 dark:border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="leading-none font-semibold">Valuation</h2>
                                {valuation.is_fully_depreciated ? (
                                    <StatusPill tone="destructive" className="shrink-0">Fully depreciated</StatusPill>
                                ) : (
                                    <StatusPill tone="warning" className="shrink-0">Depreciating</StatusPill>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cost per item</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">
                                        {Number.isFinite(cost) ? formatPeso(cost) : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Projected unit value</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">{formatPeso(valuation.unit_value)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total projected value</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">{formatPeso(valuation.total_value)}</dd>
                                </div>
                            </dl>
                            <div className="space-y-1.5">
                                <Progress
                                    value={depreciationPct}
                                    aria-valuenow={depreciationPct}
                                    data-state="determinate"
                                    aria-label="Depreciation progress"
                                />
                                <p className="text-xs text-muted-foreground tabular-nums">{depreciationCaption}</p>
                                {valuation.is_fully_depreciated ? (
                                    <p className="text-xs text-muted-foreground">
                                        Fully depreciated — projected value is ₱0.00.
                                    </p>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border border-border/60 dark:border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="leading-none font-semibold">Holders</h2>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {holders.length} holding{holders.length === 1 ? "" : "s"} · {stock.out} unit{stock.out === 1 ? "" : "s"} out
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            {holders.length === 0 ? (
                                <p className="px-6 pb-6 text-sm text-muted-foreground">
                                    No customer currently holds this item.
                                </p>
                            ) : (
                                <div className="overflow-x-auto border-t border-border/50">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Customer</TableHead>
                                                <TableHead className="text-right">Qty out</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Expected return</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {holders.map((holder) => (
                                                <TableRow
                                                    key={`${holder.customer_id}-${holder.tagged_at ?? holder.expected_return_at ?? holder.quantity_out}`}
                                                    tabIndex={0}
                                                    role="button"
                                                    aria-label={`Open ${holder.customer_name}`}
                                                    onClick={(event) => {
                                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                        router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                        if (event.key === "Enter") {
                                                            router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                        } else if (event.key === " ") {
                                                            event.preventDefault();
                                                            router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                        }
                                                    }}
                                                    className="cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                                >
                                                    <TableCell className="min-w-0">
                                                        <span className="flex min-w-0 items-center gap-2.5">
                                                            <span
                                                                aria-hidden
                                                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                                                            >
                                                                {monogram(holder.customer_name)}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <Link
                                                                    href={`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`}
                                                                    className="block max-w-56 truncate font-medium underline-offset-4 hover:underline"
                                                                    title={`${holder.customer_name} (${holder.customer_code})`}
                                                                >
                                                                    {holder.customer_name}
                                                                </Link>
                                                                <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                                                                    {holder.customer_code}
                                                                </span>
                                                            </span>
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="block td-num">{holder.quantity_out}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusPill
                                                            tone={holder.status === "open" ? "info" : "warning"}
                                                            className="shrink-0"
                                                        >
                                                            {holder.status === "open" ? "Open" : "Partial"}
                                                        </StatusPill>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`block whitespace-nowrap text-sm tabular-nums ${holder.overdue ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}
                                                            title={holder.expected_return_at ?? ""}
                                                        >
                                                            {formatStamp(holder.expected_return_at)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: history */}
                <Card className="shadow-none border border-border/60 dark:border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="leading-none font-semibold">History</h2>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {history.length} event{history.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No history yet.</p>
                        ) : (
                            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                                {history.map((event) => (
                                    <li key={event.id} className="relative min-w-0 pl-6">
                                        <span
                                            aria-hidden
                                            className={`absolute left-0 top-1.5 size-2.5 rounded-full ${eventDot(event.event)}`}
                                        />
                                        <p className="text-sm font-medium">{eventLabel(event.event)}</p>
                                        <p className="text-xs tabular-nums text-muted-foreground" title={event.occurred_at}>
                                            {formatHistoryStamp(event.occurred_at)}
                                        </p>
                                        {event.quantity_before !== null && event.quantity_after !== null ? (
                                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                                {event.quantity_before} → {event.quantity_after}
                                            </p>
                                        ) : null}
                                        {event.customer_name ? (
                                            <p className="mt-0.5 truncate text-xs" title={event.customer_name}>
                                                {event.customer_name}
                                            </p>
                                        ) : null}
                                        {event.remarks ? (
                                            <p className="mt-0.5 break-words text-xs text-muted-foreground">
                                                {event.remarks}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
