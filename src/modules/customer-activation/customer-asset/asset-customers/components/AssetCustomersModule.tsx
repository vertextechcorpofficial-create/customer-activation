"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
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
        customers,
        isLoading,
        error,
        refresh,
    } = useAssetCustomers();

    const columns: ColumnDef<CustomerListRow>[] = [
        {
            accessorKey: "customer_code",
            header: "Code",
            cell: ({ row }) => (
                <span
                    className="block max-w-40 truncate font-mono text-xs tabular-nums"
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
                    <StatusBadge tone="success">Active</StatusBadge>
                ) : (
                    <StatusBadge tone="neutral">Inactive</StatusBadge>
                ),
        },
        {
            accessorKey: "assetsHeld",
            header: "Assets held",
            cell: ({ row }) => (
                <span className="font-mono text-xs tabular-nums">{row.original.assetsHeld}</span>
            ),
        },
        {
            accessorKey: "openAssignments",
            header: "Open assignments",
            cell: ({ row }) => (
                <span className="font-mono text-xs tabular-nums">{row.original.openAssignments}</span>
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
                filters={
                    <div className="flex items-center gap-2">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search customers…"
                            aria-label="Search customers"
                            className="h-8 w-44 sm:w-56"
                        />
                        <div className="flex items-center gap-1.5">
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
                    </div>
                }
                emptyTitle="No customers found"
                emptyDescription="Try a different search, or turn off the assets-only filter."
            />
        </div>
    );
}
