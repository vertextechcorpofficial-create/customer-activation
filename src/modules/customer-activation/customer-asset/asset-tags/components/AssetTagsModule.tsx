"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";

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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "./StatusPill";
import { AssetTagsListShell } from "./AssetTagsListShell";
import { AssetTagFormDialog } from "./AssetTagFormDialog";
import { useAssetTags } from "../hooks/useAssetTags";
import type { AssetTag } from "../types/asset-tags.schema";

function isActive(value: AssetTag["is_active"]): boolean {
    return value === true || value === 1;
}

export function AssetTagsModule() {
    const { tags, isLoading, error, refresh, createTag, updateTag } = useAssetTags();
    const [dialog, setDialog] = useState<{ open: boolean; tag: AssetTag | null }>({
        open: false,
        tag: null,
    });
    const [archiveTarget, setArchiveTarget] = useState<AssetTag | null>(null);
    const [archiving, setArchiving] = useState(false);
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

    const filteredTags = useMemo(
        () =>
            tags.filter((tag) => {
                if (statusFilter === "active") return isActive(tag.is_active);
                if (statusFilter === "archived") return !isActive(tag.is_active);
                return true;
            }),
        [tags, statusFilter],
    );
    const listRef = useRef<HTMLDivElement>(null);

    const openTagEditor = (tag: AssetTag) => setDialog({ open: true, tag });

    const findTagForRow = (row: Element): AssetTag | undefined => {
        const code = row.querySelector("td")?.textContent?.trim() ?? "";
        if (!code) return undefined;
        return filteredTags.find((tag) => tag.tag_code === code);
    };

    const handleRowClick = (event: ReactMouseEvent) => {
        // WHY: ignore clicks on nested controls only; Radix dialogs portal to <body> so they never bubble into rows — no dialog clause needed.
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row) return;
        const tag = findTagForRow(row);
        if (tag) openTagEditor(tag);
    };

    const handleRowKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row || event.target !== row) return;
        if (event.key === " ") event.preventDefault();
        const tag = findTagForRow(row);
        if (tag) openTagEditor(tag);
    };

    // The desktop table rows render inside the shared shell, so enhance them
    // in place: whole <tr> opens the edit dialog for that record.
    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const matchTag = (row: Element): AssetTag | undefined => {
            const code = row.querySelector("td")?.textContent?.trim() ?? "";
            if (!code) return undefined;
            return filteredTags.find((tag) => tag.tag_code === code);
        };
        const enhanceRows = () => {
            root.querySelectorAll("tbody tr").forEach((tr) => {
                const rowEl = tr as HTMLElement;
                const tag = matchTag(tr);
                if (!tag) return;
                if (rowEl.getAttribute("tabindex") !== "0") rowEl.setAttribute("tabindex", "0");
                if (rowEl.getAttribute("role") !== "button") rowEl.setAttribute("role", "button");
                const label = `Edit ${tag.tag_name}`;
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
    }, [filteredTags]);

    const columns: ColumnDef<AssetTag>[] = [
        {
            accessorKey: "tag_code",
            header: "Code",
            cell: ({ row }) => (
                <span
                    className="block max-w-40 truncate whitespace-nowrap font-mono text-xs tabular-nums"
                    title={row.original.tag_code}
                >
                    {row.original.tag_code}
                </span>
            ),
        },
        {
            accessorKey: "tag_name",
            header: "Name",
            cell: ({ row }) => (
                <span className="block max-w-56 truncate font-medium" title={row.original.tag_name}>
                    {row.original.tag_name}
                </span>
            ),
        },
        {
            accessorKey: "color",
            header: "Colour",
            cell: ({ row }) => (
                <span className="flex min-w-0 items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: row.original.color ?? "transparent" }}
                    />
                    <span className="block max-w-24 truncate font-mono text-xs tabular-nums text-muted-foreground">
                        {row.original.color ?? "—"}
                    </span>
                </span>
            ),
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => (
                <span
                    className="block max-w-64 truncate text-sm text-muted-foreground"
                    title={row.original.description ?? ""}
                >
                    {row.original.description || "—"}
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
                    <StatusPill tone="neutral">Archived</StatusPill>
                ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const tag = row.original;
                const active = isActive(tag.is_active);
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${tag.tag_name}`}>
                                <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDialog({ open: true, tag })}>
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={!active}
                                onClick={() => setArchiveTarget(tag)}
                            >
                                Archive
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const confirmArchive = async () => {
        if (!archiveTarget || archiving) return;
        setArchiving(true);
        const ok = await updateTag(archiveTarget.id, { is_active: false });
        setArchiving(false);
        if (ok) setArchiveTarget(null);
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Asset Tags
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Create colour-coded asset tags to label and segment customer assets.
                    </p>
                </div>
                <Button onClick={() => setDialog({ open: true, tag: null })} className="shrink-0">
                    <Plus className="size-4" aria-hidden />
                    New asset tag
                </Button>
            </header>

            <div ref={listRef} onClick={handleRowClick} onKeyDown={handleRowKeyDown}>
            <AssetTagsListShell
                columns={columns}
                data={filteredTags}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                searchKey="tag_name"
                emptyTitle="No asset tags yet"
                emptyDescription="Create the first asset tag to start labelling assets."
                filters={
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                            <SelectTrigger className="w-[130px]" aria-label="Filter by status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
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
                    isLoading || filteredTags.length === 0 ? null : (
                        <ul className="divide-y">
                            {filteredTags.map((tag) => {
                                const active = isActive(tag.is_active);
                                return (
                                    <li
                                        key={tag.id}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Edit ${tag.tag_name}`}
                                        onClick={(event) => {
                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                            openTagEditor(tag);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;
                                            if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                            if (event.key === " ") event.preventDefault();
                                            openTagEditor(tag);
                                        }}
                                        className="grid cursor-pointer gap-2 px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                aria-hidden="true"
                                                className="size-3 shrink-0 rounded-full border"
                                                style={{ backgroundColor: tag.color ?? "transparent" }}
                                            />
                                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                                <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                                                    {tag.tag_code}
                                                </span>{" "}
                                                <span className="truncate">{tag.tag_name}</span>
                                            </p>
                                            <span className="shrink-0">
                                                {active ? (
                                                    <StatusPill tone="success">Active</StatusPill>
                                                ) : (
                                                    <StatusPill tone="neutral">Archived</StatusPill>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                onClick={() => setDialog({ open: true, tag })}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="min-h-11 flex-1 whitespace-nowrap"
                                                disabled={!active}
                                                onClick={() => setArchiveTarget(tag)}
                                            >
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

            <AssetTagFormDialog
                open={dialog.open}
                onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
                tag={dialog.tag}
                onCreate={createTag}
                onUpdate={updateTag}
            />

            <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive asset tag?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {archiveTarget
                                ? `"${archiveTarget.tag_name}" will no longer be offered for new assets. Assets already carrying it keep it.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={archiving} onClick={() => void confirmArchive()}>
                            Archive
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
