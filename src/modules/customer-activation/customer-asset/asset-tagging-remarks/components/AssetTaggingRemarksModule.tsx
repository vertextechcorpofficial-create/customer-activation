"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "./StatusPill";
import { AssetTaggingRemarksListShell } from "./AssetTaggingRemarksListShell";
import { AssignAssetDialog } from "./AssignAssetDialog";
import { ReturnAssetDialog } from "./ReturnAssetDialog";
import { useAssignments } from "../hooks/useAssignments";
import type { AssignmentView } from "../types/asset-tagging-remarks.view";

type StatusFilter = "all" | AssignmentView["assignment_status"] | "overdue";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "partial", label: "Partial" },
    { value: "returned", label: "Returned" },
    { value: "overdue", label: "Overdue" },
];

function statusTone(status: AssignmentView["assignment_status"]): "info" | "warning" | "success" {
    if (status === "returned") return "success";
    if (status === "partial") return "warning";
    return "info";
}

function statusLabel(status: AssignmentView["assignment_status"]): string {
    if (status === "open") return "Open";
    if (status === "partial") return "Partial";
    if (status === "returned") return "Returned";
    return status;
}

function TagDots({ tags }: { tags: AssignmentView["tags"] }) {
    if (tags.length === 0) return null;
    const shown = tags.slice(0, 3);
    const extra = tags.length - shown.length;
    return (
        <span className="ml-1.5 inline-flex shrink-0 items-center gap-1 align-middle" aria-label={`${tags.length} tag(s)`}>
            {shown.map((t) => (
                <span
                    key={t.id}
                    title={t.tag_name}
                    aria-label={t.tag_name}
                    className="size-2 rounded-full border"
                    style={{ backgroundColor: t.color ?? "transparent" }}
                />
            ))}
            {extra > 0 ? (
                <span className="text-[10px] leading-none text-muted-foreground">+{extra}</span>
            ) : null}
        </span>
    );
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
}

export function AssetTaggingRemarksModule() {
    const { assignments, items, isLoading, error, refresh, searchCustomers, assign, returnItems } =
        useAssignments();
    const [assignOpen, setAssignOpen] = useState(false);
    const [returnTarget, setReturnTarget] = useState<AssignmentView | null>(null);
    const [remarksTarget, setRemarksTarget] = useState<AssignmentView | null>(null);
    const [customerQuery, setCustomerQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [itemFilter, setItemFilter] = useState("all");

    const itemOptions = useMemo(
        () => [
            { value: "all", label: "All items" },
            ...items.map((i) => ({ value: String(i.id), label: `${i.item_code} — ${i.name}` })),
        ],
        [items],
    );

    // Client-side over the loaded rows. Overdue is the single `overdue` flag
    // from the service — the same flag the badge renders — so badge and
    // filter can never disagree.
    const filtered = useMemo(() => {
        const q = customerQuery.trim().toLowerCase();
        return assignments.filter((a) => {
            if (statusFilter === "overdue") {
                if (!a.overdue) return false;
            } else if (statusFilter !== "all" && a.assignment_status !== statusFilter) {
                return false;
            }
            if (itemFilter !== "all" && a.item_id !== Number(itemFilter)) return false;
            if (
                q &&
                !`${a.customer_name} ${a.customer_code ?? ""}`.toLowerCase().includes(q)
            ) {
                return false;
            }
            return true;
        });
    }, [assignments, customerQuery, statusFilter, itemFilter]);

    const filtersActive = statusFilter !== "all" || itemFilter !== "all" || customerQuery.trim() !== "";
    const showClear = statusFilter !== "all" || itemFilter !== "all";
    const clearFilters = () => {
        setStatusFilter("all");
        setItemFilter("all");
        setCustomerQuery("");
    };

    const columns: ColumnDef<AssignmentView>[] = [
        {
            accessorKey: "customer_name",
            header: "Customer",
            cell: ({ row }) => (
                <span className="block max-w-52 truncate font-medium" title={row.original.customer_name}>
                    {row.original.customer_name}
                </span>
            ),
        },
        {
            accessorKey: "item_name",
            header: "Item",
            cell: ({ row }) => (
                <span className="block max-w-52 truncate" title={`${row.original.item_code} — ${row.original.item_name}`}>
                    <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                        {row.original.item_code}
                    </span>{" "}
                    {row.original.item_name}
                    <TagDots tags={row.original.tags} />
                </span>
            ),
        },
        {
            accessorKey: "quantity",
            header: "Qty",
            cell: ({ row }) => (
                <span className="block td-num">
                    {row.original.returned_quantity}/{row.original.quantity}
                    <span className="text-muted-foreground"> returned</span>
                </span>
            ),
        },
        {
            accessorKey: "assignment_status",
            header: "Status",
            cell: ({ row }) => (
                <span className="flex items-center gap-1.5">
                    <StatusPill tone={statusTone(row.original.assignment_status)} className="shrink-0">
                        {statusLabel(row.original.assignment_status)}
                    </StatusPill>
                    {row.original.overdue ? <StatusPill tone="destructive" className="shrink-0">Overdue</StatusPill> : null}
                </span>
            ),
        },
        {
            accessorKey: "tagged_at",
            header: "Tagged",
            cell: ({ row }) => (
                <span className="block truncate tabular-nums text-sm text-muted-foreground">
                    {formatDate(row.original.tagged_at)}
                </span>
            ),
        },
        {
            accessorKey: "expected_return_at",
            header: "Expected return",
            cell: ({ row }) => (
                <span className="block truncate tabular-nums text-sm text-muted-foreground">
                    {formatDate(row.original.expected_return_at)}
                </span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const a = row.original;
                const done = a.assignment_status === "returned";
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${a.item_name} tagged to ${a.customer_name}`}
                            >
                                <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled={done} onClick={() => setReturnTarget(a)}>
                                Return
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRemarksTarget(a)}>
                                View remarks
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Tagging &amp; Remarks
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Assign assets to customers and track their return.
                    </p>
                </div>
                <Button onClick={() => setAssignOpen(true)} className="shrink-0">
                    <Plus className="size-4" aria-hidden />
                    Tag customer
                </Button>
            </header>

            <AssetTaggingRemarksListShell
                title="Assignments"
                description="Open assignments hold units out of stock until they are returned."
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                emptyTitle={filtersActive ? "No assignments match" : "No assignments yet"}
                emptyDescription={
                    filtersActive
                        ? "Adjust the filters to see more assignments."
                        : "Tag the first asset to a customer to start tracking."
                }
                filters={
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Input
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Search customers…"
                            aria-label="Search customers"
                            className="h-8 min-h-8 w-full min-w-0 sm:w-52"
                        />
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <SelectTrigger size="sm" aria-label="Filter by status" className="min-h-8 w-full sm:w-36">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="w-full min-w-0 sm:w-56">
                            <SearchableSelect
                                options={itemOptions}
                                value={itemFilter}
                                onValueChange={setItemFilter}
                                placeholder="All items"
                                className="min-h-8"
                            />
                        </div>
                        {showClear ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="min-h-8 shrink-0"
                            >
                                <X className="size-4" aria-hidden />
                                Clear filters
                            </Button>
                        ) : null}
                    </div>
                }
                cards={
                    isLoading || filtered.length === 0 ? null : (
                        <ul className="divide-y">
                            {filtered.map((a) => {
                                const done = a.assignment_status === "returned";
                                return (
                                    <li key={a.id} className="grid gap-2 px-4 py-3">
                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                            <p className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold">{a.customer_name}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    <span className="whitespace-nowrap font-mono tabular-nums">{a.item_code}</span>
                                                    {" "}{a.item_name}
                                                    <TagDots tags={a.tags} />
                                                </span>
                                            </p>
                                            <span className="flex shrink-0 items-center gap-1.5">
                                                <StatusPill tone={statusTone(a.assignment_status)}>
                                                    {statusLabel(a.assignment_status)}
                                                </StatusPill>
                                                {a.overdue ? <StatusPill tone="destructive">Overdue</StatusPill> : null}
                                            </span>
                                        </div>
                                        <dl className="grid grid-cols-3 gap-2 text-xs">
                                            <div className="min-w-0 rounded-md border px-2 py-1.5">
                                                <dt className="text-muted-foreground">Qty</dt>
                                                <dd className="truncate font-semibold tabular-nums">
                                                    {a.returned_quantity}/{a.quantity} returned
                                                </dd>
                                            </div>
                                            <div className="min-w-0 rounded-md border px-2 py-1.5">
                                                <dt className="text-muted-foreground">Tagged</dt>
                                                <dd className="truncate font-medium tabular-nums">{formatDate(a.tagged_at)}</dd>
                                            </div>
                                            <div className="min-w-0 rounded-md border px-2 py-1.5">
                                                <dt className="text-muted-foreground">Expected</dt>
                                                <dd className="truncate font-medium tabular-nums">{formatDate(a.expected_return_at)}</dd>
                                            </div>
                                        </dl>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                disabled={done}
                                                onClick={() => setReturnTarget(a)}
                                            >
                                                Return
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                onClick={() => setRemarksTarget(a)}
                                            >
                                                View remarks
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )
                }
            />

            <AssignAssetDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                items={items}
                onSearchCustomers={searchCustomers}
                onAssign={assign}
            />

            <ReturnAssetDialog
                open={returnTarget !== null}
                onOpenChange={(open) => !open && setReturnTarget(null)}
                assignment={returnTarget}
                onReturn={returnItems}
            />

            <Dialog open={remarksTarget !== null} onOpenChange={(open) => !open && setRemarksTarget(null)}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[480px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Remarks</DialogTitle>
                        <DialogDescription>
                            {remarksTarget
                                ? `${remarksTarget.item_name} → ${remarksTarget.customer_name}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 px-6 py-6 text-sm">
                        <div className="grid gap-1">
                            <p className="font-medium">Tagging remarks</p>
                            <p className="max-h-[160px] overflow-y-auto break-words text-muted-foreground">{remarksTarget?.remarks || "—"}</p>
                            {remarksTarget?.condition_out ? (
                                <p className="text-muted-foreground">Condition out: {remarksTarget.condition_out}</p>
                            ) : null}
                        </div>
                        <div className="grid gap-1">
                            <p className="font-medium">Return remarks</p>
                            <p className="max-h-[160px] overflow-y-auto break-words text-muted-foreground">{remarksTarget?.return_remarks || "—"}</p>
                            {remarksTarget?.condition_in ? (
                                <p className="text-muted-foreground">Condition in: {remarksTarget.condition_in}</p>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
