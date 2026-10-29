"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogClose,
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
import { Switch } from "@/components/ui/switch";
import { AssetListShell } from "./AssetListShell";
import { AssetItemFormDialog } from "./AssetItemFormDialog";
import { StatusPill } from "./StatusPill";
import { TagFilterCombobox } from "./TagFilterCombobox";
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
    const tableWrapRef = useRef<HTMLDivElement | null>(null);
    const itemByCodeRef = useRef<Map<string, EnrichedAssetItem>>(new Map());

    const openItem = useCallback(
        (id: number) => {
            router.push(`/customer-activation/customer-asset/asset-registration/${id}`);
        },
        [router],
    );

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

    const itemByCode = useMemo(
        () => new Map(filtered.map((item) => [item.item_code, item])),
        [filtered],
    );

    useEffect(() => {
        itemByCodeRef.current = itemByCode;
    }, [itemByCode]);

    useEffect(() => {
        const root = tableWrapRef.current;
        if (!root) return;
        const decorate = () => {
            const byCode = itemByCodeRef.current;
            root.querySelectorAll("tbody tr").forEach((el) => {
                const rowEl = el as HTMLTableRowElement;
                const code = rowEl.querySelector("td")?.textContent?.trim() ?? "";
                const item = byCode.get(code);
                if (!item) return;
                rowEl.setAttribute("data-item-id", String(item.id));
                rowEl.tabIndex = 0;
                rowEl.setAttribute("role", "button");
                rowEl.setAttribute("aria-label", `Open ${item.name}`);
                rowEl.classList.add(
                    "cursor-pointer",
                    "hover:bg-muted/40",
                    "focus-visible:ring-2",
                    "focus-visible:ring-ring/50",
                );
                rowEl.classList.remove("hover:bg-muted/10");
            });
        };
        decorate();
        const observer = new MutationObserver(decorate);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    const handleTableClick = (event: ReactMouseEvent<HTMLDivElement>) => {
        // WHY: ignore clicks on nested controls only; Radix dialogs portal to <body> so they never bubble into rows — no dialog clause needed.
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const tr = (event.target as HTMLElement).closest("tbody tr[data-item-id]");
        if (!tr) return;
        const id = Number(tr.getAttribute("data-item-id"));
        if (!Number.isFinite(id)) return;
        openItem(id);
    };

    const handleTableKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
        const tr = (event.target as HTMLElement).closest("tbody tr[data-item-id]");
        if (!tr) return;
        const id = Number(tr.getAttribute("data-item-id"));
        if (!Number.isFinite(id)) return;
        if (event.key === "Enter") {
            openItem(id);
        } else if (event.key === " ") {
            event.preventDefault();
            openItem(id);
        }
    };

    const columns = useMemo<ColumnDef<EnrichedAssetItem>[]>(
        () => [
            {
                accessorKey: "item_code",
                header: "Code",
                cell: ({ row }) => (
                    <span
                        className="block max-w-36 truncate whitespace-nowrap font-mono text-xs tabular-nums"
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
                        <span className="flex min-w-0 max-w-56 flex-wrap items-center gap-1">
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
                    <span className="td-num block">{row.original.quantity}</span>
                ),
            },
            {
                accessorKey: "quantity_out",
                header: "Out",
                cell: ({ row }) => (
                    <span className="td-num block">{row.original.quantity_out}</span>
                ),
            },
            {
                accessorKey: "quantity_available",
                header: "Available",
                cell: ({ row }) => (
                    <span className="td-num block">{row.original.quantity_available}</span>
                ),
            },
            {
                accessorKey: "unit_value",
                header: "Unit value",
                cell: ({ row }) => (
                    <span className="td-num block">{row.original.unit_value.toFixed(2)}</span>
                ),
            },
            {
                id: "status",
                header: "Status",
                cell: ({ row }) =>
                    isRetired(row.original.is_retired) ? (
                        <StatusPill tone="neutral">Retired</StatusPill>
                    ) : (
                        <StatusPill tone="success">Active</StatusPill>
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchableSelect
                options={[
                    { value: "all", label: "All groups" },
                    { value: "none", label: "No group" },
                    ...groups.map((g) => ({ value: String(g.id), label: g.group_name })),
                ]}
                value={groupFilter === "" ? "all" : groupFilter}
                onValueChange={(v) => setGroupFilter(v === "all" ? "" : v)}
                placeholder="All groups"
                className="h-8 w-auto min-w-36 text-xs"
            />
            <TagFilterCombobox
                options={[
                    { value: "all", label: "All tags" },
                    ...tags.map((t) => ({ value: String(t.id), label: t.tag_name, color: t.color ?? null })),
                ]}
                value={tagFilter === "" ? "all" : tagFilter}
                onValueChange={(v) => setTagFilter(v === "all" ? "" : v)}
                placeholder="All tags"
                className="h-8 w-auto min-w-36 text-xs"
            />
            <Select value={availability} onValueChange={(v) => setAvailability(v as Availability)}>
                <SelectTrigger aria-label="Filter by availability" className="h-8 w-auto text-xs tabular-nums">
                    <SelectValue placeholder="All stock" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All stock</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="fully-out">Fully out</SelectItem>
                </SelectContent>
            </Select>
            <Label className="flex h-8 shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 text-xs">
                <Switch checked={showRetired} onCheckedChange={setShowRetired} aria-label="Show retired assets" />
                Retired
            </Label>
            {groupFilter !== "" || tagFilter !== "" ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs"
                    onClick={() => {
                        setGroupFilter("");
                        setTagFilter("");
                        setAvailability("all");
                    }}
                >
                    Clear filters
                </Button>
            ) : null}
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

            <div ref={tableWrapRef} onClick={handleTableClick} onKeyDown={handleTableKeyDown}>
            <AssetListShell
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                filters={filters}
                searchKey="name"
                emptyTitle="No assets yet"
                emptyDescription="Register the first asset to start tracking inventory."
                cards={
                    isLoading || filtered.length === 0 ? null : (
                        <ul className="divide-y">
                            {filtered.map((item) => (
                                <li
                                    key={item.id}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`Open ${item.name}`}
                                    onClick={(event) => {
                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                        openItem(item.id);
                                    }}
                                    onKeyDown={(event) => {
                                        if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label,[role="menuitem"]')) return;
                                        if (event.key === "Enter") {
                                            openItem(item.id);
                                        } else if (event.key === " ") {
                                            event.preventDefault();
                                            openItem(item.id);
                                        }
                                    }}
                                    className="grid cursor-pointer gap-2 px-4 py-3 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                                            <span className="whitespace-nowrap font-mono text-xs tabular-nums">
                                                {item.item_code}
                                            </span>{" "}
                                            <span className="truncate">{item.name}</span>
                                        </p>
                                        <span className="shrink-0">
                                            {isRetired(item.is_retired) ? (
                                                <StatusPill tone="neutral">Retired</StatusPill>
                                            ) : (
                                                <StatusPill tone="success">Active</StatusPill>
                                            )}
                                        </span>
                                    </div>
                                    {item.tags.length > 0 ? (
                                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                                            {item.tags.slice(0, 3).map((tag) => (
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
                                            {item.tags.length > 3 ? (
                                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                                    +{item.tags.length - 3}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <dl className="grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-md border px-2 py-1.5">
                                            <dt className="text-[11px] text-muted-foreground">Qty</dt>
                                            <dd className="font-semibold tabular-nums">{item.quantity}</dd>
                                        </div>
                                        <div className="rounded-md border px-2 py-1.5">
                                            <dt className="text-[11px] text-muted-foreground">Out</dt>
                                            <dd className="font-semibold tabular-nums">{item.quantity_out}</dd>
                                        </div>
                                        <div className="rounded-md border px-2 py-1.5">
                                            <dt className="text-[11px] text-muted-foreground">Avail</dt>
                                            <dd className="font-semibold tabular-nums">{item.quantity_available}</dd>
                                        </div>
                                    </dl>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 flex-1 whitespace-nowrap"
                                            onClick={() =>
                                                router.push(
                                                    `/customer-activation/customer-asset/asset-registration/${item.id}`,
                                                )
                                            }
                                        >
                                            <Eye className="size-4" aria-hidden />
                                            View
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 flex-1 whitespace-nowrap"
                                            onClick={() => setDialog({ open: true, item })}
                                        >
                                            <Pencil className="size-4" aria-hidden />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 flex-1 whitespace-nowrap"
                                            onClick={() => {
                                                setTagTarget(item);
                                                setTagSelection(item.tags.map((t) => t.id));
                                            }}
                                        >
                                            <Tags className="size-4" aria-hidden />
                                            Tags
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                }
            />
            </div>

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
                <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[440px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Add tags</DialogTitle>
                        <DialogDescription>
                            {tagTarget ? `Choose tags for "${tagTarget.name}".` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mx-6 mt-6 grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2">
                        {tags.length === 0 ? (
                            <p className="p-2 text-sm text-muted-foreground">No active tags available.</p>
                        ) : (
                            tags.map((tag) => {
                                const checked = tagSelection.includes(tag.id);
                                return (
                                    <Label
                                        key={tag.id}
                                        htmlFor={`asset-list-tag-${tag.id}`}
                                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                                    >
                                        <Checkbox
                                            id={`asset-list-tag-${tag.id}`}
                                            checked={checked}
                                            onCheckedChange={() =>
                                                setTagSelection((prev) =>
                                                    checked ? prev.filter((id) => id !== tag.id) : [...prev, tag.id],
                                                )
                                            }
                                            aria-label={`Tag ${tag.tag_name}`}
                                        />
                                        <span
                                            aria-hidden="true"
                                            className="size-3 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="truncate">{tag.tag_name}</span>
                                    </Label>
                                );
                            })
                        )}
                    </div>
                    <DialogFooter className="mt-6 justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => setTagTarget(null)}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="button" disabled={savingTags} onClick={() => void saveTags()}>
                            Save tags
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
