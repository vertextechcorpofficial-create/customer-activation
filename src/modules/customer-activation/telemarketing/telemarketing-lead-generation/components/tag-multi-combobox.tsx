"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

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

// ponytail: hard ceiling of 100 active tags — never the full collection; the
// list is filtered client-side by the Command input below.
const TAGS_URL = "/api/customer-activation/telemarketing/telemarketing-tags?limit=100";

function TagChip({ children, color }: { children: ReactNode; color?: string | null }) {
    return (
        <span
            className="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-foreground"
            style={color ? { backgroundColor: color + "1f" } : undefined}
        >
            {children}
        </span>
    );
}

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
    const [attempt, setAttempt] = useState(0);

    // Lazy: fetch once on first open, never on mount — the dialog may never
    // need tags, and a retry reuses the same path via `attempt`.
    useEffect(() => {
        if (!open || tags.length > 0 || loading) return;
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
    }, [open, attempt, tags.length, loading]);

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
                                {loading ? (
                                    "Loading tags..."
                                ) : error ? (
                                    <span className="grid gap-2 justify-items-center py-2">
                                        <span>{error}</span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setError(null);
                                                setAttempt((a) => a + 1);
                                            }}
                                        >
                                            Retry
                                        </Button>
                                    </span>
                                ) : (
                                    "No tags found."
                                )}
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
                        <TagChip key={tag.tag_id} color={tag.color}>
                            {tag.tag_name}
                            <button
                                type="button"
                                onClick={() => toggle(tag.tag_id)}
                                aria-label={`Remove ${tag.tag_name}`}
                                className="rounded-sm opacity-70 hover:opacity-100"
                            >
                                <X className="size-3" aria-hidden />
                            </button>
                        </TagChip>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
