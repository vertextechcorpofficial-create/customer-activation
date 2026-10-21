"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { AssetListShell } from "./AssetListShell";
import { AssetItemFormDialog } from "./AssetItemFormDialog";
import { useAssetItems } from "../hooks/useAssetItems";
import type { EnrichedAssetItem } from "../services/asset-registration-service";

function isRetired(value: EnrichedAssetItem["is_retired"]): boolean {
    return value === true || value === 1;
}

type Availability = "all" | "available" | "fully-out";

export function AssetRegistrationModule() {
    const router = useRouter();
    const { items, groups, tags, isLoading, error, refresh, createItem, updateItem, saveItemTags } =
        useAssetItems();
    const [dialog, setDialog] = useState<{ open: boolean; item: EnrichedAssetItem | null }>({
        open: false,
        item: null,
    });
    const [tagTarget, setTagTarget] = useState<EnrichedAssetItem | null>(null);
    const [tagSelection, setTagSelection] = useState<number[]>([]);
    const [savingTags, setSavingTags] = useState(false);
    const [groupFilter, setGroupFilter] = useState<string>("");
    const [tagFilter, setTagFilter] = useState<string>("");
    const [availability, setAvailability] = useState<Availability>("all");
    const [showRetired, setShowRetired] = useState(true);

    const filtered = useMemo(() => {
        return items.filter((item) => {
            if (!showRetired && isRetired(item.is_retired)) return false;
            if (groupFilter !== "") {
                if (groupFilter === "none") {
                    if (item.group_id != null) return false;
                } else if (String(item.group_id ?? "") !== groupFilter) return false;
            }
            if (tagFilter !== "" && !item.tags.some((t) => String(t.id) === tagFilter)) return false;
            if (availability === "available" && item.quantity_available <= 0) return false;
            if (availability === "fully-out" && item.quantity_available > 0) return false;
            return true;
        });
    }, [items, showRetired, groupFilter, tagFilter, availability]);

    const columns = useMemo<ColumnDef<EnrichedAssetItem>[]>(
        () => [
            {
                accessorKey: "item_code",
                header: "Code",
                cell: ({ row }) => (
                    <span
                        className="block max-w-36 truncate font-mono text-xs tabular-nums"
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
                id: "group",
                header: "Group",
                cell: ({ row }) => (
                    <span
                        className="block max-w-40 truncate text-sm text-muted-foreground"
                        title={row.original.group_name ?? ""}
                    >
                        {row.original.group_name ?? "—"}
                    </span>
                ),
            },
            {
                id: "tags",
                header: "Tags",
                cell: ({ row }) =>
                    row.original.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                        <span className="flex max-w-56 flex-wrap items-center gap-1">
                            {row.original.tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag.id}
                                    className="inline-flex max-w-28 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px]"
                                    title={tag.tag_name}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-2 shrink-0 rounded-full border"
                                        style={{ backgroundColor: tag.color ?? "transparent" }}
                                    />
                                    <span className="truncate">{tag.tag_name}</span>
                                </span>
                            ))}
                            {row.original.tags.length > 3 ? (
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                    +{row.original.tags.length - 3}
                                </span>
                            ) : null}
                        </span>
                    ),
            },
            {
                accessorKey: "quantity",
                header: "Qty",
                cell: ({ row }) => (
                    <span className="tabular-nums">{row.original.quantity}</span>
                ),
            },
            {
                accessorKey: "quantity_out",
                header: "Out",
                cell: ({ row }) => (
                    <span className="tabular-nums">{row.original.quantity_out}</span>
                ),
            },
            {
                accessorKey: "quantity_available",
                header: "Available",
                cell: ({ row }) => (
                    <span className="tabular-nums">{row.original.quantity_available}</span>
                ),
            },
            {
                accessorKey: "unit_value",
                header: "Unit value",
                cell: ({ row }) => (
                    <span className="tabular-nums">{row.original.unit_value.toFixed(2)}</span>
                ),
            },
            {
                id: "status",
                header: "Status",
                cell: ({ row }) =>
                    isRetired(row.original.is_retired) ? (
                        <StatusBadge tone="neutral">Retired</StatusBadge>
                    ) : (
                        <StatusBadge tone="success">Active</StatusBadge>
                    ),
            },
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => {
                    const item = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.name}`}>
                                    <Pencil className="size-4" aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDialog({ open: true, item })}>
                                    <Pencil className="size-4" aria-hidden /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setTagTarget(item);
                                        setTagSelection(item.tags.map((t) => t.id));
                                    }}
                                >
                                    <Tags className="size-4" aria-hidden /> Add tags
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() =>
                                        router.push(
                                            `/customer-activation/customer-asset/asset-registration/${item.id}`,
                                        )
                                    }
                                >
                                    <Eye className="size-4" aria-hidden /> View
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
        ],
        [router],
    );

    const filters = (
        <div className="flex flex-wrap items-center gap-2">
            <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter by group"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
            >
                <option value="">All groups</option>
                <option value="none">No group</option>
                {groups.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                        {g.group_name}
                    </option>
                ))}
            </select>
            <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
            >
                <option value="">All tags</option>
                {tags.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                        {t.tag_name}
                    </option>
                ))}
            </select>
            <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value as Availability)}
                aria-label="Filter by availability"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs tabular-nums"
            >
                <option value="all">All stock</option>
                <option value="available">Available</option>
                <option value="fully-out">Fully out</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={showRetired} onCheckedChange={setShowRetired} aria-label="Show retired assets" />
                Retired
            </label>
        </div>
    );

    const saveTags = async () => {
        if (!tagTarget || savingTags) return;
        setSavingTags(true);
        const ok = await saveItemTags(tagTarget.id, tagSelection);
        setSavingTags(false);
        if (ok) setTagTarget(null);
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Asset Registration
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Register assets, track stock in and out, and follow value over time.
                    </p>
                </div>
                <Button onClick={() => setDialog({ open: true, item: null })} className="shrink-0">
                    <Plus className="size-4" aria-hidden />
                    New asset
                </Button>
            </header>

            <AssetListShell
                title="Assets"
                description="Every registered asset with live stock and depreciated value."
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                filters={filters}
                searchKey="name"
                emptyTitle="No assets yet"
                emptyDescription="Register the first asset to start tracking inventory."
            />

            <AssetItemFormDialog
                open={dialog.open}
                onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
                item={dialog.item}
                groups={groups}
                tags={tags}
                onCreate={createItem}
                onUpdate={async (id, input) => {
                    const { tag_ids, ...rest } = input;
                    const ok = await updateItem(id, rest);
                    if (ok && tag_ids) await saveItemTags(id, tag_ids);
                    return ok;
                }}
            />

            <Dialog open={tagTarget !== null} onOpenChange={(open) => !open && setTagTarget(null)}>
                <DialogContent className="w-[95vw] sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Add tags</DialogTitle>
                        <DialogDescription>
                            {tagTarget ? `Choose tags for "${tagTarget.name}".` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2">
                        {tags.length === 0 ? (
                            <p className="p-2 text-sm text-muted-foreground">No active tags available.</p>
                        ) : (
                            tags.map((tag) => {
                                const checked = tagSelection.includes(tag.id);
                                return (
                                    <label
                                        key={tag.id}
                                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                                setTagSelection((prev) =>
                                                    checked ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                                                )
                                            }
                                            className="size-4 shrink-0 accent-primary"
                                            aria-label={`Tag ${tag.tag_name}`}
                                        />
                                        <span
                                            aria-hidden="true"
                                            className="size-3 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="truncate">{tag.tag_name}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setTagTarget(null)}>
                            Cancel
                        </Button>
                        <Button type="button" disabled={savingTags} onClick={() => void saveTags()}>
                            Save tags
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
