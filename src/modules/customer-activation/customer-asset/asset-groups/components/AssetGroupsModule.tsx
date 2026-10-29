"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, Loader2, Pencil, Plus } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "./StatusPill";
import { AssetGroupsListShell } from "./AssetGroupsListShell";
import { AssetGroupFormDialog } from "./AssetGroupFormDialog";
import { useAssetGroups } from "../hooks/useAssetGroups";
import type {
    AssetGroup,
    CreateAssetGroupInput,
} from "../types/asset-groups.schema";

function isActive(value: AssetGroup["is_active"]): boolean {
    return value === true || value === 1;
}

type DialogState = { mode: "create" } | { mode: "edit"; group: AssetGroup } | null;

export function AssetGroupsModule() {
    const { groups, isLoading, error, refresh, createGroup, updateGroup } = useAssetGroups();
    const [dialog, setDialog] = useState<DialogState>(null);
    const [confirmArchive, setConfirmArchive] = useState<AssetGroup | null>(null);
    const [archiving, setArchiving] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

    const filteredGroups = useMemo(
        () =>
            groups.filter((group) => {
                if (statusFilter === "active") return isActive(group.is_active);
                if (statusFilter === "inactive") return !isActive(group.is_active);
                return true;
            }),
        [groups, statusFilter],
    );
    const listRef = useRef<HTMLDivElement>(null);

    const openGroupEditor = (group: AssetGroup) => setDialog({ mode: "edit", group });

    const findGroupForRow = (row: Element): AssetGroup | undefined => {
        const code = row.querySelector("td")?.textContent?.trim() ?? "";
        if (!code) return undefined;
        return filteredGroups.find((group) => group.group_code === code);
    };

    const handleRowClick = (event: ReactMouseEvent) => {
        // WHY: ignore clicks on nested controls only; Radix dialogs portal to <body> so they never bubble into rows — no dialog clause needed.
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row) return;
        const group = findGroupForRow(row);
        if (group) openGroupEditor(group);
    };

    const handleRowKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row || event.target !== row) return;
        if (event.key === " ") event.preventDefault();
        const group = findGroupForRow(row);
        if (group) openGroupEditor(group);
    };

    // The desktop table rows render inside the shared shell, so enhance them
    // in place: whole <tr> opens the edit dialog for that record.
    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const matchGroup = (row: Element): AssetGroup | undefined => {
            const code = row.querySelector("td")?.textContent?.trim() ?? "";
            if (!code) return undefined;
            return filteredGroups.find((group) => group.group_code === code);
        };
        const enhanceRows = () => {
            root.querySelectorAll("tbody tr").forEach((tr) => {
                const rowEl = tr as HTMLElement;
                const group = matchGroup(tr);
                if (!group) return;
                if (rowEl.getAttribute("tabindex") !== "0") rowEl.setAttribute("tabindex", "0");
                if (rowEl.getAttribute("role") !== "button") rowEl.setAttribute("role", "button");
                const label = `Edit ${group.group_name}`;
                if (rowEl.getAttribute("aria-label") !== label) rowEl.setAttribute("aria-label", label);
                if (!rowEl.classList.contains("cursor-pointer")) {
                    rowEl.classList.add(
                        "cursor-pointer",
                        "hover:bg-muted/40",
                        "focus-visible:ring-2",
                        "focus-visible:ring-ring/50",
                    );
                }
            });
        };
        enhanceRows();
        const observer = new MutationObserver(enhanceRows);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [filteredGroups]);

    const columns = useMemo<ColumnDef<AssetGroup, unknown>[]>(() => [
        {
            accessorKey: "group_code",
            header: "Code",
            cell: ({ row }) => (
                <span className="block max-w-40 truncate whitespace-nowrap font-mono text-xs tabular-nums" title={row.original.group_code}>
                    {row.original.group_code}
                </span>
            ),
        },
        {
            accessorKey: "group_name",
            header: "Name",
            cell: ({ row }) => (
                <span className="block max-w-64 truncate" title={row.original.group_name}>
                    {row.original.group_name}
                </span>
            ),
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => (
                <span className="block max-w-80 truncate text-muted-foreground" title={row.original.description ?? ""}>
                    {row.original.description?.trim() ? row.original.description : "—"}
                </span>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) =>
                isActive(row.original.is_active) ? (
                    <StatusPill tone="success">Active</StatusPill>
                ) : (
                    <StatusPill tone="neutral">Inactive</StatusPill>
                ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${row.original.group_name}`}
                        title="Edit asset group"
                        onClick={() => setDialog({ mode: "edit", group: row.original })}
                    >
                        <Pencil className="size-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Archive ${row.original.group_name}`}
                        title="Archive asset group"
                        disabled={!isActive(row.original.is_active)}
                        onClick={() => setConfirmArchive(row.original)}
                    >
                        <Archive className="size-4" />
                    </Button>
                </div>
            ),
        },
    ], []);

    const handleSubmit = async (input: CreateAssetGroupInput): Promise<boolean> => {
        if (dialog?.mode === "edit") {
            return updateGroup(dialog.group.id, input);
        }
        return createGroup(input);
    };

    const handleArchive = async () => {
        if (!confirmArchive || archiving) {
            return;
        }
        setArchiving(true);
        const ok = await updateGroup(confirmArchive.id, { is_active: false });
        setArchiving(false);
        if (ok) {
            setConfirmArchive(null);
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Asset Groups</h1>
                    <p className="text-sm text-muted-foreground">Group asset codes so inventory stays organized.</p>
                </div>
                <Button onClick={() => setDialog({ mode: "create" })} className="shrink-0">
                    <Plus className="size-4" />
                    New asset group
                </Button>
            </header>
            <div ref={listRef} onClick={handleRowClick} onKeyDown={handleRowKeyDown}>
            <AssetGroupsListShell<AssetGroup>
                columns={columns}
                data={filteredGroups}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                searchKey="group_name"
                emptyTitle="No asset groups yet"
                emptyDescription="Create the first asset group to start organizing inventory."
                filters={
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                            <SelectTrigger className="w-[130px]" aria-label="Filter by status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        {statusFilter !== "all" ? (
                            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")}>
                                Clear filters
                            </Button>
                        ) : null}
                    </div>
                }
                cards={
                    isLoading || filteredGroups.length === 0 ? null : (
                        <ul className="divide-y">
                            {filteredGroups.map((group) => {
                                const active = isActive(group.is_active);
                                return (
                                    <li
                                        key={group.id}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Edit ${group.group_name}`}
                                        onClick={(event) => {
                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                            openGroupEditor(group);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;
                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                            if (event.key === " ") event.preventDefault();
                                            openGroupEditor(group);
                                        }}
                                        className="grid cursor-pointer gap-2 px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                                <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                                                    {group.group_code}
                                                </span>{" "}
                                                <span className="truncate">{group.group_name}</span>
                                            </p>
                                            <span className="shrink-0">
                                                {active ? (
                                                    <StatusPill tone="success">Active</StatusPill>
                                                ) : (
                                                    <StatusPill tone="neutral">Inactive</StatusPill>
                                                )}
                                            </span>
                                        </div>
                                        {group.description?.trim() ? (
                                            <p className="truncate text-xs text-muted-foreground" title={group.description}>
                                                {group.description}
                                            </p>
                                        ) : null}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                onClick={() => setDialog({ mode: "edit", group })}
                                            >
                                                <Pencil className="size-4" aria-hidden />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                disabled={!active}
                                                onClick={() => setConfirmArchive(group)}
                                            >
                                                <Archive className="size-4" aria-hidden />
                                                Archive
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )
                }
            />
            </div>
            <AssetGroupFormDialog
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
                editing={dialog?.mode === "edit" ? dialog.group : null}
                onSubmit={handleSubmit}
            />
            <AlertDialog open={confirmArchive !== null} onOpenChange={(open) => !open && setConfirmArchive(null)}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive asset group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmArchive ? `"${confirmArchive.group_name}" becomes inactive. Past assets keep it.` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={archiving} onClick={() => void handleArchive()}>
                            {archiving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Archive className="size-4" />}
                            Archive
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
