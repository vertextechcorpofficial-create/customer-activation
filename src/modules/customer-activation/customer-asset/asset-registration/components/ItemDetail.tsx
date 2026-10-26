"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, Package, PackageCheck, Pencil, RefreshCw, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";

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
import { StatusPill } from "./StatusPill";
import { BackButton } from "./BackButton";
import { AssetItemFormDialog } from "./AssetItemFormDialog";
import { useAssetItem } from "../hooks/useAssetItem";
import { assetRegistrationRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type {
    AssetGroup,
    AssetTag,
    UpdateAssetItemInput,
} from "../types/asset-registration.schema";
import type { EnrichedAssetItem } from "../services/asset-registration-service";
import { lotValue, round2, unitValue } from "../utils/valuation";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

function formatPeso(value: number | string): string {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const humanDateFmt = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

function formatDate(value: string | null | undefined): string {
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
    if (!Number.isFinite(time)) {
        return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
    }
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

function elapsedMonths(dateAcquired: string): number {
    const part = dateAcquired.slice(0, 10).split("-").map(Number);
    const now = new Date();
    const year = part[0];
    const month = part[1];
    const day = part[2];
    if (!year || !month || !day) return 0;
    let months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
    if (now.getDate() < day) months -= 1;
    return months > 0 ? months : 0;
}

function isLate(expectedReturn: string | null): boolean {
    if (!expectedReturn) return false;
    const t = new Date(expectedReturn.replace(" ", "T")).getTime();
    return Number.isFinite(t) && t < Date.now();
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

export function ItemDetail({ id }: { id: number }) {
    const router = useRouter();
    const { detail, isLoading, error, refresh } = useAssetItem(id);
    const [unit, setUnit] = useState<"month" | "day">("month");
    const [editOpen, setEditOpen] = useState(false);
    const [groups, setGroups] = useState<AssetGroup[]>([]);
    const [catalogTags, setCatalogTags] = useState<AssetTag[]>([]);
    const [catalogsLoaded, setCatalogsLoaded] = useState(false);

    const ensureCatalogs = useCallback(async () => {
        if (catalogsLoaded) return;
        try {
            const res = await fetch(assetRegistrationRoutes.catalogs, { cache: "no-store" });
            const body = (await res.json().catch(() => null)) as ApiEnvelope<{
                groups: AssetGroup[];
                tags: AssetTag[];
            }> | null;
            if (!res.ok || !body || body.success === false) throw new Error();
            setGroups(body.data.groups);
            setCatalogTags(body.data.tags);
            setCatalogsLoaded(true);
        } catch {
            // Dialogs still open with an empty catalogue and explain it there.
        }
    }, [catalogsLoaded]);

    const openEdit = useCallback(() => {
        void ensureCatalogs();
        setEditOpen(true);
    }, [ensureCatalogs]);

    const handleUpdate = useCallback(
        async (itemId: number, input: UpdateAssetItemInput & { tag_ids?: number[] }): Promise<boolean> => {
            const { tag_ids, ...rest } = input;
            try {
                const res = await fetch(assetRegistrationRoutes.item(itemId), {
                    method: "PATCH",
                    cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rest),
                });
                const body = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
                if (!res.ok || !body || body.success === false) {
                    throw new Error(
                        (body && body.success === false && body.message) || "Could not update the asset.",
                    );
                }
                if (tag_ids) {
                    const tagsRes = await fetch(assetRegistrationRoutes.itemTags(itemId), {
                        method: "PUT",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tag_ids }),
                    });
                    const tagsBody = (await tagsRes.json().catch(() => null)) as ApiEnvelope<unknown> | null;
                    if (!tagsRes.ok || !tagsBody || tagsBody.success === false) {
                        throw new Error(
                            (tagsBody && tagsBody.success === false && tagsBody.message) ||
                                "Could not update the asset tags.",
                        );
                    }
                }
                toast.success("Asset updated");
                await refresh();
                return true;
            } catch (err) {
                toast.error("Failed to update asset", { description: toMessage(err) });
                return false;
            }
        },
        [refresh],
    );

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-[1600px] space-y-4" aria-label="Loading asset">
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
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                <div className="mb-3">
                    <BackButton fallbackHref="/customer-activation/customer-asset/asset-registration" />
                </div>
                <Alert variant="destructive">
                    <AlertTitle>Could not load the asset</AlertTitle>
                    <AlertDescription>{error ?? "Asset not found."}</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const { item } = detail;
    const retired = item.is_retired === true || item.is_retired === 1;
    const cost = Number(item.cost_per_item);
    const currentUnit = unitValue({
        costPerItem: cost,
        lifeSpanMonths: item.life_span_months,
        dateAcquired: item.date_acquired.slice(0, 10),
        unit,
    });
    const currentLot = lotValue({
        costPerItem: cost,
        lifeSpanMonths: item.life_span_months,
        dateAcquired: item.date_acquired.slice(0, 10),
        quantity: item.quantity,
        unit,
    });
    const depreciationPct =
        cost > 0 ? Math.min(100, Math.max(0, round2((1 - currentUnit / cost) * 100))) : 0;
    const elapsed = elapsedMonths(item.date_acquired);
    const depreciationCaption = `${elapsed} of ${item.life_span_months} months depreciated · ${depreciationPct}%`;
    const overdueCount = detail.holdings.filter((h) => isLate(h.expected_return)).length;
    const enriched: EnrichedAssetItem = {
        ...item,
        group_name: detail.group_name,
        tags: detail.tags,
        quantity_out: detail.quantity_out,
        quantity_available: detail.quantity_available,
        unit_value: detail.unit_value,
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <div className="mb-3">
                <BackButton fallbackHref="/customer-activation/customer-asset/asset-registration" />
            </div>
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] dark:border-primary/20 dark:bg-primary/[0.08]">
                <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="sm" onClick={openEdit}>
                                <Pencil className="size-4" aria-hidden />
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Refresh asset"
                                onClick={() => void refresh()}
                                className="-mr-2 shrink-0"
                            >
                                <RefreshCw className="size-4" aria-hidden />
                            </Button>
                        </div>
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
                                {detail.group_name ? (
                                    <span
                                        className="inline-flex max-w-48 items-center truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                        title={detail.group_name}
                                    >
                                        <span className="truncate">{detail.group_name}</span>
                                    </span>
                                ) : null}
                            </div>
                            {detail.tags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {detail.tags.map((tag) => (
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
                                Last purchase {formatDate(item.updated_at)} · Acquired {formatDate(item.date_acquired)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Units"
                    value={String(item.quantity)}
                    icon={<Boxes className="size-4" aria-hidden />}
                    iconClass="border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                    toneClass="bg-blue-50/50 border-t-2 border-t-blue-400 dark:bg-blue-950/20 dark:border-t-blue-800"
                >
                    {detail.group_name ?? "Unassigned"}
                </KpiCard>
                <KpiCard
                    label="Available"
                    value={String(detail.quantity_available)}
                    icon={<PackageCheck className="size-4" aria-hidden />}
                    iconClass="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    toneClass="bg-emerald-50/50 border-t-2 border-t-emerald-400 dark:bg-emerald-950/20 dark:border-t-emerald-800"
                >
                    {detail.quantity_out} out on assignment
                </KpiCard>
                <KpiCard
                    label="Out"
                    value={String(detail.quantity_out)}
                    icon={<Truck className="size-4" aria-hidden />}
                    iconClass={
                        overdueCount > 0
                            ? "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                            : "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    }
                    toneClass={
                        overdueCount > 0
                            ? "bg-rose-50/50 border-t-2 border-t-rose-400 dark:bg-rose-950/20 dark:border-t-rose-800"
                            : "bg-amber-50/50 border-t-2 border-t-amber-400 dark:bg-amber-950/20 dark:border-t-amber-800"
                    }
                >
                    {overdueCount > 0 ? (
                        <span className="font-semibold text-rose-700 dark:text-rose-300">
                            {detail.holdings.length} holder{detail.holdings.length === 1 ? "" : "s"} · {overdueCount} overdue
                        </span>
                    ) : (
                        <span>
                            {detail.holdings.length} holder{detail.holdings.length === 1 ? "" : "s"}
                        </span>
                    )}
                </KpiCard>
                <KpiCard
                    label="Projected value"
                    value={formatPeso(currentLot)}
                    icon={<Wallet className="size-4" aria-hidden />}
                    iconClass="border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15"
                    toneClass="bg-primary/[0.04] border-t-2 border-t-primary/60 dark:bg-primary/[0.08]"
                    className="col-span-2 lg:col-span-1"
                >
                    {formatPeso(currentUnit)} / unit
                </KpiCard>
            </div>

            <div className="grid gap-3 lg:grid-cols-3 items-start">
                {/* Left: valuation + holders */}
                <div className="min-w-0 space-y-3 lg:col-span-2">
                    <Card className="shadow-none border border-border/60 dark:border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="leading-none font-semibold">Valuation</h2>
                                {currentUnit === 0 ? (
                                    <StatusPill tone="destructive" className="shrink-0">Fully depreciated</StatusPill>
                                ) : (
                                    <StatusPill tone="warning" className="shrink-0">Depreciating</StatusPill>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-end">
                                <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Depreciation unit">
                                    {(["month", "day"] as const).map((u) => (
                                        <Button
                                            key={u}
                                            type="button"
                                            size="sm"
                                            variant={unit === u ? "secondary" : "ghost"}
                                            onClick={() => setUnit(u)}
                                            aria-pressed={unit === u}
                                            className="capitalize"
                                        >
                                            {u}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cost per item</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">
                                        {Number.isFinite(cost) ? formatPeso(cost) : "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Unit value</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">{formatPeso(currentUnit)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total value</dt>
                                    <dd className="mt-1 text-sm font-medium tabular-nums">{formatPeso(currentLot)}</dd>
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
                                {currentUnit === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Fully depreciated — projected value is {formatPeso(0)}.
                                    </p>
                                ) : null}
                            </div>
                            <dl className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2">
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Serial number</dt>
                                    <dd
                                        className={`mt-1 text-sm ${item.serial ? "font-mono tabular-nums" : "text-muted-foreground"}`}
                                        title={item.serial ?? ""}
                                    >
                                        {item.serial ?? "—"}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Category</dt>
                                    <dd className={`mt-1 text-sm ${item.category ? "" : "text-muted-foreground"}`}>
                                        {item.category ?? "—"}
                                    </dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Remarks</dt>
                                    <dd
                                        className={`mt-1 line-clamp-2 break-words text-sm ${item.remarks ? "" : "text-muted-foreground"}`}
                                        title={item.remarks ?? ""}
                                    >
                                        {item.remarks ?? "—"}
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border border-border/60 dark:border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="leading-none font-semibold">Who holds units</h2>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {detail.holdings.length} holding{detail.holdings.length === 1 ? "" : "s"} · {detail.quantity_out} unit{detail.quantity_out === 1 ? "" : "s"} out
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            {detail.holdings.length === 0 ? (
                                <p className="px-6 pb-6 text-sm text-muted-foreground">
                                    All units are in stock — nothing is assigned out.
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
                                            {detail.holdings.map((h) => {
                                                const qtyOut = Math.max(0, h.quantity - h.returned_quantity);
                                                const late = isLate(h.expected_return);
                                                const customerName = h.customer_name ?? (h.customer_id != null ? `Customer ${h.customer_id}` : "Unknown customer");
                                                return (
                                                    <TableRow
                                                        key={h.id}
                                                        tabIndex={0}
                                                        role="button"
                                                        aria-label={`Open ${customerName}`}
                                                        onClick={(event) => {
                                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                            router.push(`/customer-activation/customer-asset/asset-customers/${h.customer_id}`);
                                                        }}
                                                        onKeyDown={(event) => {
                                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                                            if (event.key === "Enter") {
                                                                router.push(`/customer-activation/customer-asset/asset-customers/${h.customer_id}`);
                                                            } else if (event.key === " ") {
                                                                event.preventDefault();
                                                                router.push(`/customer-activation/customer-asset/asset-customers/${h.customer_id}`);
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
                                                                    {monogram(customerName)}
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <Link
                                                                        href={`/customer-activation/customer-asset/asset-customers/${h.customer_id}`}
                                                                        className="block max-w-56 truncate font-medium underline-offset-4 hover:underline"
                                                                        title={h.customer_code ? `${customerName} (${h.customer_code})` : customerName}
                                                                    >
                                                                        {customerName}
                                                                    </Link>
                                                                    {h.customer_code ? (
                                                                        <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                                                                            {h.customer_code}
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="block td-num">{qtyOut}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <StatusPill
                                                                tone={h.assignment_status === "open" ? "info" : "warning"}
                                                                className="shrink-0"
                                                            >
                                                                {h.assignment_status === "open" ? "Open" : "Partial"}
                                                            </StatusPill>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span
                                                                className={`block whitespace-nowrap text-sm tabular-nums ${late ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}
                                                                title={h.expected_return ?? ""}
                                                            >
                                                                {h.expected_return
                                                                    ? formatHistoryStamp(h.expected_return)
                                                                    : "—"}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
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
                                {detail.history.length} event{detail.history.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {detail.history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No history recorded yet.</p>
                        ) : (
                            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                                {detail.history.map((event) => (
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

            <AssetItemFormDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                item={enriched}
                groups={groups}
                tags={catalogTags}
                onCreate={async () => false}
                onUpdate={handleUpdate}
            />
        </div>
    );
}
