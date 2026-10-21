"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContentInDialog, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagOption {
    tag_id: number;
    tag_code: string;
    tag_name: string;
    color: string | null;
    is_active: number | boolean;
}

const TAGS_URL = "/api/customer-activation/telemarketing/telemarketing-tags?limit=100";

/**
 * Searchable multi-select over `telemarketing_tag`.
 * Popover-based (not modal) so it works inside a Dialog without pointer-event fights.
 */
export function TagMultiCombobox({
    value,
    onChange,
    disabled,
}: {
    value: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [tags, setTags] = useState<TagOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(TAGS_URL);
                const body = (await res.json().catch(() => null)) as
                    | { success: boolean; data?: TagOption[]; message?: string }
                    | null;
                if (!res.ok || !body?.success) throw new Error(body?.message ?? "Could not load tags");
                if (alive) {
                    setTags((body.data ?? []).filter((t) => Number(t.is_active) === 1));
                }
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : "Could not load tags");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const selected = tags.filter((t) => value.includes(t.tag_id));
    const toggle = (id: number) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-label="Select tags"
                        disabled={disabled}
                        className="w-full justify-between font-normal"
                    >
                        <span className="truncate">
                            {selected.length
                                ? `${selected.length} tag${selected.length === 1 ? "" : "s"} selected`
                                : "Select tags"}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContentInDialog
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                >
                    <Command>
                        <CommandInput placeholder="Search tags..." />
                        <CommandList className="max-h-64">
                            <CommandEmpty>
                                {loading ? "Loading tags..." : (error ?? "No tags found.")}
                            </CommandEmpty>
                            <CommandGroup>
                                {tags.map((tag) => (
                                    <CommandItem
                                        key={tag.tag_id}
                                        value={`${tag.tag_name} ${tag.tag_code}`}
                                        onSelect={() => toggle(tag.tag_id)}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="mr-2 size-3 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{tag.tag_name}</span>
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                value.includes(tag.tag_id) ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContentInDialog>
            </Popover>

            {selected.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {selected.map((tag) => (
                        <Badge key={tag.tag_id} variant="secondary" className="gap-1">
                            {tag.tag_name}
                            <button
                                type="button"
                                onClick={() => toggle(tag.tag_id)}
                                aria-label={`Remove ${tag.tag_name}`}
                                className="rounded-sm opacity-70 hover:opacity-100"
                            >
                                <X className="size-3" aria-hidden />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
