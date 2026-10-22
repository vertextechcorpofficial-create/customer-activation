"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RefreshCwIcon, ChevronRight } from "lucide-react";
import { StatusPill } from "./StatusPill";
import { useAssetReports } from "../hooks/useAssetReports";
import type { AssetReportRow } from "../types/asset-reports.schema";

function isRetired(value: AssetReportRow["is_retired"]): boolean {
    return value === true || value === 1;
}

function formatStamp(value: string | null | undefined): string {
    if (!value) return "—";
    return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
}

function formatPeso(value: number | string): string {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type StatusFilter = "all" | "active" | "retired";

type ProjectionMode = "today" | "in";
type ProjectionUnit = "days" | "months" | "years";

function toLocalIso(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function computeProjection(mode: ProjectionMode, amount: string, unit: ProjectionUnit): string {
    if (mode === "today") return toLocalIso(new Date());
    const digits = amount.replace(/\D/g, "");
    const n = Math.min(999, Math.max(1, digits === "" ? 1 : Number(digits)));
    const base = new Date();
    if (unit === "days") base.setDate(base.getDate() + n);
    else if (unit === "months") base.setMonth(base.getMonth() + n);
    else base.setFullYear(base.getFullYear() + n);
    return toLocalIso(base);
}

export function AssetReportsModule() {
    const router = useRouter();
    const { rows, isLoading, error, refresh, asOf, setAsOf } = useAssetReports();

    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [holdersFor, setHoldersFor] = useState<AssetReportRow | null>(null);

    const [mode, setMode] = useState<ProjectionMode>("today");
    const [amount, setAmount] = useState("1");
    const [unit, setUnit] = useState<ProjectionUnit>("months");

    const projectedAsOf = useMemo(
        () => computeProjection(mode, amount, unit),
        [mode, amount, unit],
    );

    useEffect(() => {
        if (projectedAsOf !== asOf) setAsOf(projectedAsOf);
    }, [projectedAsOf, asOf, setAsOf]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((row) => {
            if (statusFilter === "active" && isRetired(row.is_retired)) return false;
            if (statusFilter === "retired" && !isRetired(row.is_retired)) return false;
            if (q && !`${row.item_code} ${row.name}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [rows, query, statusFilter]);

    const totals = useMemo(() => {
        let units = 0;
        let value = 0;
        for (const row of filtered) {
            units += row.quantity;
            const total = typeof row.total_value === "number" ? row.total_value : Number(row.total_value);
            if (Number.isFinite(total)) value += total;
        }
        return { units, value };
    }, [filtered]);

    const hasFilters = query.trim() !== "" || statusFilter !== "all" || mode !== "today";

    const resetFilters = () => {
        setQuery("");
        setStatusFilter("all");
        setMode("today");
        setAmount("1");
        setUnit("months");
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="grid gap-1">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Asset Report
                </h1>
                <p className="text-sm text-muted-foreground">
                    Projected value — purchases, valuation, and customer holdings
                    in one place.
                </p>
                <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                    {filtered.length} item{filtered.length === 1 ? "" : "s"} ·{" "}
                    {totals.units.toLocaleString("en-PH")} unit{totals.units === 1 ? "" : "s"} ·{" "}
                    {formatPeso(totals.value)} total value
                </p>
            </header>

            <Card className="overflow-hidden rounded-2xl border-border/50">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
                    <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate">All assets</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Showing {filtered.length} of {rows.length}.
                        </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Report date projection">
                            <ToggleGroup
                                type="single"
                                value={mode}
                                onValueChange={(v) => {
                                    if (v === "today" || v === "in") setMode(v);
                                }}
                                variant="outline"
                                size="sm"
                                aria-label="Report date projection"
                            >
                                <ToggleGroupItem value="today" aria-label="Today">
                                    Today
                                </ToggleGroupItem>
                                <ToggleGroupItem value="in" aria-label="Project into the future">
                                    In
                                </ToggleGroupItem>
                            </ToggleGroup>
                            {mode === "in" ? (
                                <>
                                    <Input
                                        value={amount}
                                        onChange={(event) =>
                                            setAmount(event.target.value.replace(/\D/g, "").slice(0, 3))
                                        }
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        step={1}
                                        aria-label="Projection amount"
                                        className="h-8 w-16 text-right tabular-nums"
                                    />
                                    <Select
                                        value={unit}
                                        onValueChange={(v) => setUnit(v as ProjectionUnit)}
                                    >
                                        <SelectTrigger aria-label="Projection unit" className="h-8 w-auto text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="days">Days</SelectItem>
                                            <SelectItem value="months">Months</SelectItem>
                                            <SelectItem value="years">Years</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : null}
                        </div>
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search code or name…"
                            aria-label="Search by item code or name"
                            className="h-8 w-44 min-w-0 shrink text-xs"
                        />
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <SelectTrigger aria-label="Filter by status" className="h-8 w-auto text-xs">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="retired">Retired</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasFilters ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 shrink-0 px-2 text-xs"
                                onClick={resetFilters}
                            >
                                Clear filters
                            </Button>
                        ) : null}
                        <Button variant="outline" size="sm" onClick={() => refresh()} aria-label="Refresh report" className="shrink-0">
                            <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
                            <span className="whitespace-nowrap">Refresh</span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {error ? (
                        <div className="px-6 pt-6">
                            <Alert variant="destructive">
                                <AlertTitle>Could not load</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        </div>
                    ) : null}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/10">
                                    <TableHead className="py-2 font-bold">Code</TableHead>
                                    <TableHead className="py-2 font-bold">Name</TableHead>
                                    <TableHead className="py-2 text-right font-bold">Qty</TableHead>
                                    <TableHead className="py-2 font-bold">Last purchase</TableHead>
                                    <TableHead className="py-2 text-right font-bold">Unit value</TableHead>
                                    <TableHead className="py-2 text-right font-bold">Total value</TableHead>
                                    <TableHead className="py-2 font-bold">Status</TableHead>
                                    <TableHead className="py-2 font-bold">Holders</TableHead>
                                    <TableHead className="w-8">
                                        <span className="sr-only">Details</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && filtered.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, rowIndex) => (
                                        <TableRow key={rowIndex} className="hover:bg-transparent">
                                            {Array.from({ length: 9 }).map((__, colIndex) => (
                                                <TableCell key={colIndex} className="py-2">
                                                    <div className="h-4 animate-pulse rounded bg-muted" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filtered.length > 0 ? (
                                    filtered.map((row) => (
                                        <TableRow
                                            key={row.item_id}
                                            className="cursor-pointer transition-colors hover:bg-muted/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                                            onClick={(e) => {
                                                // WHY: ignore clicks on nested controls only; Radix dialogs portal to <body> so they never bubble into rows — no dialog clause needed.
                                                if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                router.push(`/customer-activation/customer-asset/asset-reports/${row.item_id}`);
                                            }}
                                            onKeyDown={(e) => {
                                                if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                if (e.key === "Enter") {
                                                    router.push(`/customer-activation/customer-asset/asset-reports/${row.item_id}`);
                                                }
                                                if (e.key === " ") {
                                                    e.preventDefault();
                                                    router.push(`/customer-activation/customer-asset/asset-reports/${row.item_id}`);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="button"
                                            aria-label={`View asset report for ${row.name}`}
                                        >
                                            <TableCell className="py-2">
                                                <Link
                                                    href={`/customer-activation/customer-asset/asset-reports/${row.item_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="block max-w-40 truncate whitespace-nowrap font-mono text-xs tabular-nums underline-offset-4 hover:underline"
                                                    title={row.item_code}
                                                >
                                                    {row.item_code}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Link
                                                    href={`/customer-activation/customer-asset/asset-reports/${row.item_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="block max-w-56 truncate font-medium underline-offset-4 hover:underline"
                                                    title={row.name}
                                                >
                                                    {row.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="block td-num">{row.quantity}</span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span
                                                    className="block max-w-44 truncate whitespace-nowrap text-sm tabular-nums text-muted-foreground"
                                                    title={row.last_purchase_at}
                                                >
                                                    {formatStamp(row.last_purchase_at)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="block whitespace-nowrap td-num">
                                                    {formatPeso(row.unit_value)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="block whitespace-nowrap td-num font-medium">
                                                    {formatPeso(row.total_value)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {isRetired(row.is_retired) ? (
                                                    <StatusPill tone="neutral" className="shrink-0">Retired</StatusPill>
                                                ) : (
                                                    <StatusPill tone="success" className="shrink-0">Active</StatusPill>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {row.holders.length > 0 ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`View holders for ${row.name}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHoldersFor(row);
                                                        }}
                                                        className="h-8 shrink-0 whitespace-nowrap px-2 text-xs"
                                                    >
                                                        {row.holders.length} customer{row.holders.length === 1 ? "" : "s"}
                                                    </Button>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="w-8 pr-4">
                                                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            <p className="font-medium">No assets found</p>
                                            <p className="text-sm text-muted-foreground">
                                                {rows.length === 0
                                                    ? "Assets appear here once items are registered."
                                                    : "Try a different search or clear the filters."}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={holdersFor !== null} onOpenChange={(open) => { if (!open) setHoldersFor(null); }}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="truncate">{holdersFor?.name}</DialogTitle>
                        <DialogDescription>
                            {holdersFor?.item_code} — held by {holdersFor?.holders.length ?? 0} customer{(holdersFor?.holders.length ?? 0) === 1 ? "" : "s"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto px-6 py-6">
                        {holdersFor && holdersFor.holders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/10">
                                            <TableHead className="py-2 font-bold">Customer</TableHead>
                                            <TableHead className="py-2 text-right font-bold">Qty out</TableHead>
                                            <TableHead className="py-2 font-bold">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {holdersFor.holders.map((holder) => (
                                            <TableRow
                                                key={holder.customer_id}
                                                className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`Open ${holder.customer_name}`}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                    router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                }}
                                                onKeyDown={(e) => {
                                                    if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                    if (e.key === "Enter") {
                                                        router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                    }
                                                    if (e.key === " ") {
                                                        e.preventDefault();
                                                        router.push(`/customer-activation/customer-asset/asset-customers/${holder.customer_id}`);
                                                    }
                                                }}
                                            >
                                                <TableCell className="py-2">
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
                                                <TableCell className="py-2">
                                                    <span className="block td-num">{holder.quantity_out}</span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <StatusPill
                                                        tone={holder.status === "open" ? "info" : "warning"}
                                                        className="shrink-0"
                                                    >
                                                        {holder.status === "open" ? "Open" : "Partial"}
                                                    </StatusPill>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No customer currently holds this item.
                            </p>
                        )}
                    </div>
                    <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Close
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
