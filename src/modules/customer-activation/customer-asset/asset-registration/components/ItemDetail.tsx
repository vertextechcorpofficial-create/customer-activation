"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAssetItem } from "../hooks/useAssetItem";
import { lotValue, unitValue } from "../utils/valuation";

function eventTone(event: string): "success" | "info" | "neutral" {
    if (event === "registered" || event === "returned") return "success";
    if (event === "tagged_to_customer") return "info";
    return "neutral";
}

export function ItemDetail({ id }: { id: number }) {
    const { detail, isLoading, error, refresh } = useAssetItem(id);
    const [unit, setUnit] = useState<"month" | "day">("month");

    if (isLoading) {
        return (
            <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading asset…
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                <Alert variant="destructive">
                    <AlertTitle>Could not load the asset</AlertTitle>
                    <AlertDescription>{error ?? "Asset not found."}</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/customer-activation/customer-asset/asset-registration">
                            <ArrowLeft className="size-4" aria-hidden /> Back to assets
                        </Link>
                    </Button>
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
        dateAcquired: item.date_acquired,
        unit,
    });
    const currentLot = lotValue({
        costPerItem: cost,
        lifeSpanMonths: item.life_span_months,
        dateAcquired: item.date_acquired,
        quantity: item.quantity,
        unit,
    });
    const outPct = item.quantity > 0 ? Math.min(100, (detail.quantity_out / item.quantity) * 100) : 0;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid min-w-0 gap-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon-sm" asChild>
                            <Link
                                href="/customer-activation/customer-asset/asset-registration"
                                aria-label="Back to assets"
                            >
                                <ArrowLeft className="size-4" aria-hidden />
                            </Link>
                        </Button>
                        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl" title={item.name}>
                            {item.name}
                        </h1>
                        {retired ? <StatusBadge tone="neutral">Retired</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
                    </div>
                    <p className="truncate font-mono text-xs tabular-nums text-muted-foreground" title={item.item_code}>
                        {item.item_code}
                        {detail.group_name ? ` · ${detail.group_name}` : ""}
                        {item.category ? ` · ${item.category}` : ""}
                    </p>
                </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm">Valuation</CardTitle>
                            <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Depreciation unit">
                                {(["month", "day"] as const).map((u) => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => setUnit(u)}
                                        aria-pressed={unit === u}
                                        className={`rounded px-2 py-0.5 capitalize ${unit === u ? "bg-muted font-medium" : "text-muted-foreground"}`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Unit value</span>
                            <span className="text-2xl font-semibold tabular-nums">{currentUnit.toFixed(2)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Lot value ({item.quantity} units)</span>
                            <span className="text-lg font-medium tabular-nums">{currentLot.toFixed(2)}</span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                            <dt className="text-muted-foreground">Cost / item</dt>
                            <dd className="text-right tabular-nums">{cost.toFixed(2)}</dd>
                            <dt className="text-muted-foreground">Lifespan</dt>
                            <dd className="text-right tabular-nums">{item.life_span_months} mo</dd>
                            <dt className="text-muted-foreground">Acquired</dt>
                            <dd className="text-right tabular-nums">{item.date_acquired}</dd>
                            {item.serial ? (
                                <>
                                    <dt className="text-muted-foreground">Serial</dt>
                                    <dd className="truncate text-right font-mono text-xs tabular-nums" title={item.serial}>
                                        {item.serial}
                                    </dd>
                                </>
                            ) : null}
                        </dl>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle className="text-sm">Quantity</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md border p-3">
                                <p className="text-2xl font-semibold tabular-nums">{item.quantity}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="text-2xl font-semibold tabular-nums">{detail.quantity_out}</p>
                                <p className="text-xs text-muted-foreground">Out</p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="text-2xl font-semibold tabular-nums">{detail.quantity_available}</p>
                                <p className="text-xs text-muted-foreground">Available</p>
                            </div>
                        </div>
                        <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={detail.quantity_out}
                            aria-valuemin={0}
                            aria-valuemax={item.quantity}
                            aria-label="Units assigned out"
                        >
                            <div className="h-full rounded-full bg-primary" style={{ width: `${outPct}%` }} />
                        </div>
                        {item.remarks ? (
                            <p className="truncate text-sm text-muted-foreground" title={item.remarks}>
                                {item.remarks}
                            </p>
                        ) : null}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle className="text-sm">Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {detail.tags.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No tags on this asset.</p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {detail.tags.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex max-w-44 items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs"
                                        title={tag.tag_name}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="truncate">{tag.tag_name}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle className="text-sm">Who holds units</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {detail.holdings.length === 0 ? (
                        <p className="px-6 py-4 text-sm text-muted-foreground">
                            All units are in stock — nothing is assigned out.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <th className="px-6 py-2 font-medium">Customer</th>
                                        <th className="px-4 py-2 font-medium tabular-nums">Units</th>
                                        <th className="px-4 py-2 font-medium">Status</th>
                                        <th className="px-6 py-2 font-medium">Expected return</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.holdings.map((h) => (
                                        <tr key={h.id} className="border-b last:border-0">
                                            <td className="max-w-48 truncate px-6 py-2 tabular-nums" title={String(h.customer_id ?? "")}>
                                                {h.customer_id ?? "—"}
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {Math.max(0, h.quantity - h.returned_quantity)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <StatusBadge tone={h.assignment_status === "open" ? "info" : "neutral"}>
                                                    {h.assignment_status}
                                                </StatusBadge>
                                            </td>
                                            <td className="px-6 py-2 tabular-nums">{h.expected_return ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle className="text-sm">History</CardTitle>
                </CardHeader>
                <CardContent>
                    {detail.history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No history recorded yet.</p>
                    ) : (
                        <ol className="grid gap-3">
                            {detail.history.map((h) => (
                                <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
                                    <StatusBadge tone={eventTone(h.event)}>{h.event}</StatusBadge>
                                    <span className="tabular-nums text-muted-foreground">{h.occurred_at}</span>
                                    {h.quantity_before !== null || h.quantity_after !== null ? (
                                        <span className="tabular-nums">
                                            {h.quantity_before ?? "—"} → {h.quantity_after ?? "—"}
                                        </span>
                                    ) : null}
                                    {h.remarks ? (
                                        <span className="block w-full truncate text-muted-foreground" title={h.remarks}>
                                            {h.remarks}
                                        </span>
                                    ) : null}
                                </li>
                            ))}
                        </ol>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
