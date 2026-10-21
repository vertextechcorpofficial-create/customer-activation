"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetReportsListShell } from "./AssetReportsListShell";
import { useAssetReports, type AssetReportTab } from "../hooks/useAssetReports";
import type {
    CustomerAssetRow,
    LastPurchaseRow,
    ValuationRow,
} from "../types/asset-reports.schema";

function isRetired(value: LastPurchaseRow["is_retired"]): boolean {
    return value === true || value === 1;
}

function formatMoney(value: number | string): string {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n)
        ? n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";
}

interface CustomerAssetLine {
    customer_id: number;
    customer_code: string;
    customer_name: string;
    item_id: number;
    item_code: string;
    name: string;
    quantity_out: number;
}

const lastPurchaseColumns: ColumnDef<LastPurchaseRow>[] = [
    {
        accessorKey: "item_code",
        header: "Code",
        cell: ({ row }) => (
            <span
                className="block max-w-40 truncate font-mono text-xs tabular-nums"
                title={row.original.item_code}
            >
                {row.original.item_code}
            </span>
        ),
    },
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
            <span className="block max-w-56 truncate font-medium" title={row.original.name}>
                {row.original.name}
            </span>
        ),
    },
    {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => (
            <span className="block text-right tabular-nums">{row.original.quantity}</span>
        ),
    },
    {
        accessorKey: "last_purchase_at",
        header: "Last purchase",
        cell: ({ row }) => (
            <span
                className="block max-w-44 truncate text-sm tabular-nums text-muted-foreground"
                title={row.original.last_purchase_at}
            >
                {row.original.last_purchase_at}
            </span>
        ),
    },
    {
        accessorKey: "is_retired",
        header: "Status",
        cell: ({ row }) =>
            isRetired(row.original.is_retired) ? (
                <StatusBadge tone="neutral">Retired</StatusBadge>
            ) : (
                <span className="text-sm text-muted-foreground">—</span>
            ),
    },
];

const customerAssetColumns: ColumnDef<CustomerAssetLine>[] = [
    {
        accessorKey: "customer_code",
        header: "Customer code",
        cell: ({ row }) => (
            <span
                className="block max-w-32 truncate font-mono text-xs tabular-nums"
                title={row.original.customer_code}
            >
                {row.original.customer_code}
            </span>
        ),
    },
    {
        accessorKey: "customer_name",
        header: "Customer",
        cell: ({ row }) => (
            <span className="block max-w-56 truncate font-medium" title={row.original.customer_name}>
                {row.original.customer_name}
            </span>
        ),
    },
    {
        accessorKey: "item_code",
        header: "Asset code",
        cell: ({ row }) => (
            <span
                className="block max-w-32 truncate font-mono text-xs tabular-nums"
                title={row.original.item_code}
            >
                {row.original.item_code}
            </span>
        ),
    },
    {
        accessorKey: "name",
        header: "Asset",
        cell: ({ row }) => (
            <span className="block max-w-56 truncate" title={row.original.name}>
                {row.original.name}
            </span>
        ),
    },
    {
        accessorKey: "quantity_out",
        header: "Qty out",
        cell: ({ row }) => (
            <span className="block text-right tabular-nums">{row.original.quantity_out}</span>
        ),
    },
];

const valuationColumns: ColumnDef<ValuationRow>[] = [
    {
        accessorKey: "item_code",
        header: "Code",
        cell: ({ row }) => (
            <span
                className="block max-w-40 truncate font-mono text-xs tabular-nums"
                title={row.original.item_code}
            >
                {row.original.item_code}
            </span>
        ),
    },
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
            <span className="block max-w-56 truncate font-medium" title={row.original.name}>
                {row.original.name}
            </span>
        ),
    },
    {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => (
            <span className="block text-right tabular-nums">{row.original.quantity}</span>
        ),
    },
    {
        accessorKey: "unit_value",
        header: "Unit value",
        cell: ({ row }) => (
            <span className="block text-right tabular-nums">{formatMoney(row.original.unit_value)}</span>
        ),
    },
    {
        accessorKey: "total_value",
        header: "Total value",
        cell: ({ row }) => (
            <span className="block text-right font-medium tabular-nums">
                {formatMoney(row.original.total_value)}
            </span>
        ),
    },
    {
        accessorKey: "is_fully_depreciated",
        header: "Status",
        cell: ({ row }) =>
            row.original.is_fully_depreciated ? (
                <StatusBadge tone="warning">Fully depreciated</StatusBadge>
            ) : (
                <span className="text-sm text-muted-foreground">—</span>
            ),
    },
];

function flattenCustomerAssets(rows: CustomerAssetRow[]): CustomerAssetLine[] {
    return rows.flatMap((row) =>
        row.items.map((item) => ({
            customer_id: row.customer_id,
            customer_code: row.customer_code,
            customer_name: row.customer_name,
            item_id: item.item_id,
            item_code: item.item_code,
            name: item.name,
            quantity_out: item.quantity_out,
        })),
    );
}

export function AssetReportsModule() {
    const {
        tab,
        setTab,
        asOf,
        setAsOf,
        lastPurchase,
        customerAssets,
        valuation,
        isLoading,
        error,
        refresh,
    } = useAssetReports();

    const customerLines = useMemo(() => flattenCustomerAssets(customerAssets), [customerAssets]);

    const totals = useMemo(() => {
        let quantity = 0;
        let value = 0;
        for (const row of valuation) {
            quantity += row.quantity;
            const total = typeof row.total_value === "number" ? row.total_value : Number(row.total_value);
            if (Number.isFinite(total)) value += total;
        }
        return { quantity, value };
    }, [valuation]);

    const activeData = tab === "last-purchase" ? lastPurchase.length : tab === "customer-assets" ? customerLines.length : valuation.length;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Asset Report
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Last purchases, assets placed with customers, and current valuation.
                    </p>
                </div>
            </header>

            <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as AssetReportTab)}
                className="space-y-4"
            >
                <TabsList aria-label="Asset report sections">
                    <TabsTrigger value="last-purchase">Last Purchase</TabsTrigger>
                    <TabsTrigger value="customer-assets">Customer → Assets</TabsTrigger>
                    <TabsTrigger value="valuation">Valuation</TabsTrigger>
                </TabsList>

                <TabsContent value="last-purchase" className="space-y-4">
                    <AssetReportsListShell
                        title="Last Purchase"
                        description="Newest stock updates first; restocks land on top because edits refresh the timestamp."
                        columns={lastPurchaseColumns}
                        data={lastPurchase}
                        isLoading={isLoading && tab === "last-purchase" && activeData === 0}
                        error={tab === "last-purchase" ? error : null}
                        onRefresh={() => refresh()}
                        searchKey="name"
                        emptyTitle="No assets yet"
                        emptyDescription="Assets appear here once items are registered."
                    />
                </TabsContent>

                <TabsContent value="customer-assets" className="space-y-4">
                    <AssetReportsListShell
                        title="Customer → Assets"
                        description="Every asset currently placed with a customer, with quantities still out."
                        columns={customerAssetColumns}
                        data={customerLines}
                        isLoading={isLoading && tab === "customer-assets" && activeData === 0}
                        error={tab === "customer-assets" ? error : null}
                        onRefresh={() => refresh()}
                        searchKey="customer_name"
                        emptyTitle="No assets placed"
                        emptyDescription="Taggings appear here once assets are assigned to customers."
                    />
                </TabsContent>

                <TabsContent value="valuation" className="space-y-4">
                    <AssetReportsListShell
                        title="Valuation"
                        description="Depreciated value of on-hand stock as of the selected date."
                        columns={valuationColumns}
                        data={valuation}
                        isLoading={isLoading && tab === "valuation" && activeData === 0}
                        error={tab === "valuation" ? error : null}
                        onRefresh={() => refresh()}
                        searchKey="name"
                        emptyTitle="Nothing to value"
                        emptyDescription="Valuation appears here once items are registered."
                        filters={
                            <div className="flex items-center gap-2">
                                <Label htmlFor="valuation-as-of" className="shrink-0 text-sm text-muted-foreground">
                                    As of
                                </Label>
                                <Input
                                    id="valuation-as-of"
                                    type="date"
                                    value={asOf}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(event) => {
                                        if (event.target.value) setAsOf(event.target.value);
                                    }}
                                    className="w-auto tabular-nums"
                                    aria-label="Valuation as-of date"
                                />
                            </div>
                        }
                    />
                    <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">
                            Total units{" "}
                            <span className="font-semibold text-foreground tabular-nums">
                                {totals.quantity.toLocaleString("en-PH")}
                            </span>
                        </span>
                        <span className="text-muted-foreground">
                            Total value{" "}
                            <span className="font-semibold text-foreground tabular-nums">
                                {totals.value.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </span>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
