"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AssetTag } from "../types/asset-registration.schema";

const MAX_RENDER = 50;

export function TagsMultiSelect({
    tags,
    value,
    onChange,
}: {
    tags: AssetTag[];
    value: number[];
    onChange: (ids: number[]) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const selected = React.useMemo(() => value ?? [], [value]);

    const byId = React.useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
    const selectedTags = React.useMemo(
        () => selected.map((id) => byId.get(id)).filter((t): t is AssetTag => t !== undefined),
        [selected, byId],
    );

    const matches = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tags;
        return tags.filter(
            (t) => t.tag_name.toLowerCase().includes(q) || t.tag_code.toLowerCase().includes(q),
        );
    }, [tags, search]);
    const visible = matches.slice(0, MAX_RENDER);

    const toggle = (id: number) => {
        onChange(
            selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
        );
    };

    const shownChips = selectedTags.slice(0, 3);
    const extraCount = selectedTags.length - shownChips.length;

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={selected.length > 0 ? `${selected.length} tags selected` : "Select tags"}
                    className={cn(
                        "h-auto min-h-9 w-full justify-between gap-2 py-1.5",
                        selected.length === 0 && "text-muted-foreground",
                    )}
                >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        {selected.length === 0 ? (
                            <span className="truncate text-sm">Select tags</span>
                        ) : (
                            <>
                                {shownChips.map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex max-w-28 items-center gap-1 rounded-sm border bg-muted px-1.5 py-0.5 text-xs"
                                    >
                                        <span
                                            aria-hidden="true"
                                            title={tag.tag_name}
                                            className="size-2 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="truncate">{tag.tag_name}</span>
                                    </span>
                                ))}
                                {extraCount > 0 ? (
                                    <span className="text-xs text-muted-foreground">+{extraCount}</span>
                                ) : null}
                                <span className="text-xs text-muted-foreground">
                                    {selected.length} selected
                                </span>
                            </>
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[9999] w-[min(360px,calc(100vw-2rem))] p-0"
                align="start"
                sideOffset={4}
                collisionPadding={12}
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search tags..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                            {visible.map((tag) => {
                                const checked = selected.includes(tag.id);
                                return (
                                    <CommandItem
                                        key={tag.id}
                                        value={`${tag.tag_name} ${tag.tag_code}`}
                                        role="option"
                                        aria-selected={checked}
                                        data-checked={checked}
                                        onSelect={toggle.bind(null, tag.id)}
                                    >
                                        <Checkbox
                                            checked={checked}
                                            tabIndex={-1}
                                            aria-hidden="true"
                                            className="pointer-events-none"
                                        />
                                        <span
                                            aria-hidden="true"
                                            title={tag.tag_name}
                                            className="size-2.5 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="truncate">{tag.tag_name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {matches.length > MAX_RENDER ? (
                            <p className="border-t px-2 py-1.5 text-xs text-muted-foreground">
                                Showing {MAX_RENDER} of {matches.length}
                            </p>
                        ) : null}
                    </CommandList>
                    <div className="flex items-center justify-between gap-2 border-t p-2">
                        <span
                            className="px-1 text-xs text-muted-foreground tabular-nums"
                            aria-live="polite"
                        >
                            {selected.length} selected
                        </span>
                        <span className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={selected.length === 0}
                                onClick={() => onChange([])}
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                    setSearch("");
                                    setOpen(false);
                                }}
                            >
                                Done
                            </Button>
                        </span>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
