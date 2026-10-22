"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

function formatDate(value: string | null): string {
    if (!value) return "—";
    return value.length >= 10 ? value.slice(0, 10) : value;
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <Card className="shadow-none border-border">
            <CardContent className="space-y-1 p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="truncate text-2xl font-semibold tabular-nums" title={value}>
                    {value}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={sub}>
                    {sub}
                </p>
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

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <Link
                        href="/customer-activation/customer-asset/asset-reports"
                        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                        <ArrowLeft className="size-3.5" aria-hidden />
                        Asset report
                    </Link>
                    <div className="min-w-0">
                        <h1
                            className="truncate text-xl font-semibold tracking-tight sm:text-2xl"
                            title={item.name}
                        >
                            {item.name}
                        </h1>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-xs tabular-nums text-muted-foreground" title={item.item_code}>
                                {item.item_code}
                            </span>
                            {retired ? (
                                <StatusPill tone="neutral" className="shrink-0">Retired</StatusPill>
                            ) : (
                                <StatusPill tone="success" className="shrink-0">Active</StatusPill>
                            )}
                            {item.group_name ? (
                                <span className="truncate text-xs text-muted-foreground" title={item.group_name}>
                                    {item.group_name}
                                </span>
                            ) : null}
                        </div>
                        {tags.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex max-w-40 items-center gap-1.5 truncate rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                        title={tag.tag_name}
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

            {/* KPI row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Units on hand" value={String(stock.total)} sub={`${stock.total} unit${stock.total === 1 ? "" : "s"} total`} />
                <KpiCard label="Available" value={String(stock.available)} sub="ready to assign" />
                <KpiCard label="Out on assignment" value={String(stock.out)} sub={`${holders.length} holding${holders.length === 1 ? "" : "s"}`} />
                <KpiCard
                    label="Projected total value"
                    value={formatPeso(valuation.total_value)}
                    sub={`${formatPeso(valuation.unit_value)} / unit`}
                />
            </div>

            <div className="grid gap-3 lg:grid-cols-3 items-start">
                {/* Left: valuation + holders */}
                <div className="min-w-0 space-y-3 lg:col-span-2">
                    <Card className="shadow-none border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="leading-none font-semibold">Valuation</h2>
                                {valuation.is_fully_depreciated ? (
                                    <StatusPill tone="neutral" className="shrink-0">Fully depreciated</StatusPill>
                                ) : null}
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

                    <Card className="shadow-none border-border overflow-hidden">
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
                                                            className={`block whitespace-nowrap text-sm tabular-nums ${holder.overdue ? "text-destructive" : "text-muted-foreground"}`}
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
                <Card className="shadow-none border-border">
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
                                            className="absolute left-0 top-1.5 size-2.5 rounded-full border border-border bg-muted-foreground/40"
                                        />
                                        <p className="text-sm font-medium">{eventLabel(event.event)}</p>
                                        <p className="text-xs tabular-nums text-muted-foreground" title={event.occurred_at}>
                                            {formatStamp(event.occurred_at)}
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
