"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "./StatusPill";
import { Switch } from "@/components/ui/switch";
import { AssetCustomersListShell } from "./AssetCustomersListShell";
import { useAssetCustomers } from "../hooks/useAssetCustomers";
import type { CustomerListRow } from "../services/asset-customers-service";

const DETAIL_BASE = "/customer-activation/customer-asset/asset-customers";

export function AssetCustomersModule() {
    const {
        query,
        setQuery,
        onlyWithAssets,
        setOnlyWithAssets,
        status,
        setStatus,
        total,
        pageCount,
        pagination,
        onPaginationChange,
        customers,
        isLoading,
        error,
        refresh,
    } = useAssetCustomers();

    const hasActiveFilters = query.trim() !== "" || status !== "all" || !onlyWithAssets;
    const clearFilters = () => {
        setQuery("");
        setStatus("all");
        setOnlyWithAssets(true);
    };

    const columns: ColumnDef<CustomerListRow>[] = [
        {
            accessorKey: "customer_code",
            header: "Code",
            cell: ({ row }) => (
                <span
                    className="block max-w-40 truncate whitespace-nowrap font-mono text-xs tabular-nums"
                    title={row.original.customer_code}
                >
                    {row.original.customer_code}
                </span>
            ),
        },
        {
            accessorKey: "customer_name",
            header: "Name",
            cell: ({ row }) => (
                <span className="block max-w-56 truncate font-medium" title={row.original.customer_name}>
                    {row.original.customer_name}
                </span>
            ),
        },
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) =>
                row.original.isActive ? (
                    <StatusPill tone="success">Active</StatusPill>
                ) : (
                    <StatusPill tone="neutral">Inactive</StatusPill>
                ),
        },
        {
            accessorKey: "assetsHeld",
            header: "Assets held",
            cell: ({ row }) => (
                <span className="block td-num font-mono text-xs">{row.original.assetsHeld}</span>
            ),
        },
        {
            accessorKey: "openAssignments",
            header: "Open assignments",
            cell: ({ row }) => (
                <span className="block td-num font-mono text-xs">{row.original.openAssignments}</span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`${DETAIL_BASE}/${row.original.id}`} aria-label={`View ${row.original.customer_name}`}>
                        <Eye className="size-4" aria-hidden />
                        View
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Customer List</h1>
                    <p className="text-sm text-muted-foreground">
                        Browse customers and open their asset dashboard.
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                        {isLoading ? "Loading customers…" : `${total.toLocaleString()} customers`}
                    </p>
                </div>
            </header>

            <AssetCustomersListShell
                title="Customers"
                description="Every customer with live asset holdings. Read-only — customer records belong to another module."
                columns={columns}
                data={customers}
                isLoading={isLoading}
                error={error}
                onRefresh={refresh}
                manualPagination
                pagination={pagination}
                onPaginationChange={onPaginationChange}
                pageCount={pageCount}
                filters={
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search customers…"
                            aria-label="Search customers"
                            className="h-8 w-44 min-w-0 sm:w-56"
                        />
                        <Select
                            value={status}
                            onValueChange={(v) => setStatus(v as "all" | "active" | "inactive")}
                        >
                            <SelectTrigger aria-label="Filter by status" className="h-8 w-28">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <Switch
                                id="with-assets-only"
                                checked={onlyWithAssets}
                                onCheckedChange={setOnlyWithAssets}
                                aria-label="Show customers with assets only"
                            />
                            <Label htmlFor="with-assets-only" className="whitespace-nowrap text-xs">
                                With assets only
                            </Label>
                        </div>
                        {hasActiveFilters ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="shrink-0"
                            >
                                Clear filters
                            </Button>
                        ) : null}
                    </div>
                }
                emptyTitle="No customers found"
                emptyDescription="Try a different search or turn off the filters."
                cards={
                    isLoading || customers.length === 0 ? null : (
                        <ul className="divide-y">
                            {customers.map((c) => (
                                <li key={c.id} className="grid gap-2 px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                            <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                                                {c.customer_code}
                                            </span>{" "}
                                            <span className="truncate">{c.customer_name}</span>
                                        </p>
                                        <span className="shrink-0">
                                            {c.isActive ? (
                                                <StatusPill tone="success">Active</StatusPill>
                                            ) : (
                                                <StatusPill tone="neutral">Inactive</StatusPill>
                                            )}
                                        </span>
                                    </div>
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                        {c.assetsHeld} assets held · {c.openAssignments} open
                                    </p>
                                    <Button variant="outline" size="sm" className="min-h-11 w-full whitespace-nowrap" asChild>
                                        <Link href={`${DETAIL_BASE}/${c.id}`} aria-label={`View ${c.customer_name}`}>
                                            <Eye className="size-4" aria-hidden />
                                            View
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )
                }
            />
        </div>
    );
}
