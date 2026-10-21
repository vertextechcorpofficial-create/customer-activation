"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { AssetTaggingRemarksListShell } from "./AssetTaggingRemarksListShell";
import { AssignAssetDialog } from "./AssignAssetDialog";
import { ReturnAssetDialog } from "./ReturnAssetDialog";
import { useAssignments } from "../hooks/useAssignments";
import type { AssignmentView } from "../types/asset-tagging-remarks.view";

function statusTone(status: AssignmentView["assignment_status"]): "info" | "warning" | "success" {
    if (status === "returned") return "success";
    if (status === "partial") return "warning";
    return "info";
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
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {row.original.item_code}
                    </span>{" "}
                    {row.original.item_name}
                </span>
            ),
        },
        {
            accessorKey: "quantity",
            header: "Qty",
            cell: ({ row }) => (
                <span className="tabular-nums">
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
                    <StatusBadge tone={statusTone(row.original.assignment_status)} className="capitalize">
                        {row.original.assignment_status}
                    </StatusBadge>
                    {row.original.overdue ? <StatusBadge tone="destructive">Overdue</StatusBadge> : null}
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
                data={assignments}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                searchKey="customer_name"
                emptyTitle="No assignments yet"
                emptyDescription="Tag the first asset to a customer to start tracking."
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
                <DialogContent className="w-[95vw] sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Remarks</DialogTitle>
                        <DialogDescription>
                            {remarksTarget
                                ? `${remarksTarget.item_name} → ${remarksTarget.customer_name}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 text-sm">
                        <div className="grid gap-1">
                            <p className="font-medium">Tagging remarks</p>
                            <p className="text-muted-foreground">{remarksTarget?.remarks || "—"}</p>
                            {remarksTarget?.condition_out ? (
                                <p className="text-muted-foreground">Condition out: {remarksTarget.condition_out}</p>
                            ) : null}
                        </div>
                        <div className="grid gap-1">
                            <p className="font-medium">Return remarks</p>
                            <p className="text-muted-foreground">{remarksTarget?.return_remarks || "—"}</p>
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
