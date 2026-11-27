"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
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
    const router = useRouter();
    const listRef = useRef<HTMLDivElement>(null);
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

    // The desktop table (<tr> rendering) lives in the shared DataTable, which
    // this module must not edit. Enhance rendered body rows in place: each row
    // already contains its own View link, so read the destination href from
    // the row itself — robust to client-side sorting/column visibility.
    useEffect(() => {
        const root = listRef.current;
        if (!root || customers.length === 0) return;
        const table = root.querySelector("table");
        if (!table) return;
        const bodyRows = Array.from(table.querySelectorAll("tbody > tr"));
        const cleanups: Array<() => void> = [];
        bodyRows.forEach((tr) => {
            const rowEl = tr as HTMLTableRowElement;
            if (rowEl.querySelector("td[colspan]")) return;
            const link = rowEl.querySelector<HTMLAnchorElement>(`a[href^="${DETAIL_BASE}/"]`);
            const href = link?.getAttribute("href");
            if (!href) return;
            const viewLabel = link?.getAttribute("aria-label");
            rowEl.classList.add("cursor-pointer", "hover:bg-muted/40");
            rowEl.classList.add("focus-visible:ring-2", "focus-visible:ring-ring/50");
            rowEl.tabIndex = 0;
            rowEl.setAttribute("role", "button");
            rowEl.setAttribute("aria-label", viewLabel?.replace(/^View\s+/, "Open ") ?? href);
            const onClick = (event: MouseEvent) => {
                // WHY: ignore clicks on nested controls only; Radix dialogs portal to <body> so they never bubble into rows — no dialog clause needed.
                if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                router.push(href);
            };
            const onKeyDown = (event: KeyboardEvent) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                if (event.key === " ") event.preventDefault();
                router.push(href);
            };
            rowEl.addEventListener("click", onClick);
            rowEl.addEventListener("keydown", onKeyDown);
            cleanups.push(() => {
                rowEl.removeEventListener("click", onClick);
                rowEl.removeEventListener("keydown", onKeyDown);
            });
        });
        return () => {
            cleanups.forEach((fn) => fn());
        };
    }, [customers, router]);

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
            header: () => <div className="text-right">Assets held</div>,
            cell: ({ row }) => (
                <span className="block td-num font-mono text-xs">{row.original.assetsHeld}</span>
            ),
        },
        {
            accessorKey: "openAssignments",
            header: () => <div className="text-right">Open assignments</div>,
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
        <div ref={listRef} className="mx-auto w-full max-w-[1600px] space-y-4">
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
                        <div className="flex h-8 shrink-0 items-center gap-2 rounded-md border bg-background px-2.5">
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
                                <li
                                    key={c.id}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`Open ${c.customer_name}`}
                                    className="grid gap-2 px-4 py-3 cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    onClick={(event) => {
                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                        router.push(`${DETAIL_BASE}/${c.id}`);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                        if (event.key === " ") event.preventDefault();
                                        router.push(`${DETAIL_BASE}/${c.id}`);
                                    }}
                                >
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
