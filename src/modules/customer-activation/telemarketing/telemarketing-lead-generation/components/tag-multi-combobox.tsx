"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
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
 *
 * An in-flow disclosure, not a popover: inside a Dialog a portalled panel
 * fights the dismissable layer, and the un-portalled variant gets clipped at
 * the dialog's bottom edge. Living in the form's own scroll container avoids
 * both.
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
    const panelId = useId();
    const [open, setOpen] = useState(false);
    const [tags, setTags] = useState<TagOption[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);

    // Lazy: fetch on first open, never on mount — the dialog may never need
    // tags. The re-entry guard is a ref so the request cannot cancel itself
    // the way a `loading` dependency did.
    async function loadTags() {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(TAGS_URL);
            const body = (await res.json().catch(() => null)) as
                | { success: boolean; data?: TagOption[]; message?: string }
                | null;
            if (!res.ok || !body?.success) throw new Error(body?.message ?? "Could not load tags");
            setTags((body.data ?? []).filter((t) => Number(t.is_active) === 1));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load tags");
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }

    const toggleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next && tags === null) void loadTags();
    };

    const selected = (tags ?? []).filter((t) => value.includes(t.tag_id));
    const toggle = (id: number) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                aria-label="Select tags"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                disabled={disabled}
                onClick={toggleOpen}
                className="w-full justify-between font-normal"
            >
                <span className="truncate">
                    {selected.length
                        ? `${selected.length} tag${selected.length === 1 ? "" : "s"} selected`
                        : "Select tags"}
                </span>
                <ChevronDown
                    className={cn("size-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
                    aria-hidden
                />
            </Button>

            {open ? (
                <div id={panelId} className="overflow-hidden rounded-md border">
                    <Command>
                        <CommandInput placeholder="Search tags..." autoFocus />
                        <CommandList className="max-h-56">
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
                                            onClick={() => void loadTags()}
                                        >
                                            Retry
                                        </Button>
                                    </span>
                                ) : (
                                    "No tags found."
                                )}
                            </CommandEmpty>
                            <CommandGroup>
                                {(tags ?? []).map((tag) => (
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
                </div>
            ) : null}

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
