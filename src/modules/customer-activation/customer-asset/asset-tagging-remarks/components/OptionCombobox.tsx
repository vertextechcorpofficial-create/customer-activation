"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AvailableItem, CustomerOption } from "../types/asset-tagging-remarks.view";

/** Max rows rendered from a client-side filter — the list is ~3,362 rows. */
const RENDER_LIMIT = 100;

interface ComboOption {
    key: string;
    primary: string;
    secondary?: string | null;
    meta?: string | null;
}

interface BaseComboboxProps {
    id: string;
    placeholder: string;
    options: ComboOption[];
    valueKey: string | null;
    onChange: (key: string) => void;
    isLoading?: boolean;
    loadingText?: string;
    loadError?: string | null;
    onRetry?: () => void;
    searchPlaceholder: string;
    disabled?: boolean;
    ariaInvalid?: boolean;
}

function BaseCombobox({
    id,
    placeholder,
    options,
    valueKey,
    onChange,
    isLoading = false,
    loadingText = "Loading…",
    loadError = null,
    onRetry,
    searchPlaceholder,
    disabled = false,
    ariaInvalid = false,
}: BaseComboboxProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const selected = options.find((o) => o.key === valueKey) ?? null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) =>
            `${o.primary} ${o.secondary ?? ""}`.toLowerCase().includes(q),
        );
    }, [options, query]);

    const visible = useMemo(() => {
        const base = filtered.slice(0, RENDER_LIMIT);
        // Pin the selected option at the top even when the filter or the
        // render cap would hide it, so the selection never disappears.
        if (selected && !base.some((o) => o.key === selected.key)) {
            return [selected, ...base];
        }
        return base;
    }, [filtered, selected]);
    const truncated = filtered.length > RENDER_LIMIT;

    const openPanel = () => {
        if (disabled || isLoading) return;
        setQuery("");
        setActiveIndex(0);
        setOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
    };
    // Close on outside click; the panel sits in-flow so it pushes the form.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    const closePanel = (refocusTrigger = false) => {
        setOpen(false);
        if (refocusTrigger) {
            rootRef.current?.querySelector<HTMLButtonElement>('[data-trigger="true"]')?.focus();
        }
    };

    const pick = (key: string) => {
        onChange(key);
        setOpen(false);
    };

    const onSearchKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (event.key === "Enter") {
            event.preventDefault();
            const target = visible[activeIndex];
            if (target) pick(target.key);
        } else if (event.key === "Escape") {
            event.preventDefault();
            closePanel(true);
        } else if (event.key === "Tab") {
            setOpen(false);
        }
    };

    return (
        <div ref={rootRef}>
            <Button
                type="button"
                variant="outline"
                data-trigger="true"
                disabled={disabled || isLoading}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-invalid={ariaInvalid}
                onClick={() => (open ? closePanel() : openPanel())}
                onKeyDown={(event) => {
                    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
                        event.preventDefault();
                        openPanel();
                    }
                }}
                className="w-full justify-between font-normal"
            >
                <span className="min-w-0 flex-1 truncate text-left">
                    {isLoading ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            {loadingText}
                        </span>
                    ) : (
                        (selected?.primary ?? (
                            <span className="text-muted-foreground">{placeholder}</span>
                        ))
                    )}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
            {open ? (
                <div className="mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                    <div className="p-1">
                        <Input
                            ref={searchRef}
                            id={`${id}-search`}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setActiveIndex(0);
                            }}
                            placeholder={searchPlaceholder}
                            autoComplete="off"
                            role="combobox"
                            aria-expanded="true"
                            aria-controls={listId}
                            aria-activedescendant={
                                visible[activeIndex] ? `${listId}-${visible[activeIndex].key}` : undefined
                            }
                            onKeyDown={onSearchKeyDown}
                        />
                    </div>
                    {loadError ? (
                        <div className="grid gap-2 p-2 text-sm">
                            <p className="text-destructive">{loadError}</p>
                            {onRetry ? (
                                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                                    Retry
                                </Button>
                            ) : null}
                        </div>
                    ) : visible.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {query.trim() ? "No matches. Keep typing to narrow." : "No options available."}
                        </p>
                    ) : (
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label={placeholder}
                            className="max-h-56 overflow-y-auto p-1"
                        >
                            {visible.map((option, index) => {
                                const isSelected = option.key === valueKey;
                                return (
                                    <li key={option.key} id={`${listId}-${option.key}`} role="presentation">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => pick(option.key)}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={cn(
                                                "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                                                index === activeIndex && "bg-accent text-accent-foreground",
                                            )}
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">{option.primary}</span>
                                                {option.secondary ? (
                                                    <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                                                        {option.secondary}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {option.meta ? (
                                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                                    {option.meta}
                                                </span>
                                            ) : null}
                                            {isSelected ? (
                                                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                                            ) : (
                                                <span className="mt-0.5 size-4 shrink-0" aria-hidden />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {truncated && !loadError ? (
                        <p className="border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                            Showing {RENDER_LIMIT} of {filtered.length} — keep typing to narrow
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function customerLabel(c: CustomerOption): string {
    return c.customer_code ? `${c.customer_code} · ${c.customer_name}` : c.customer_name;
}

interface CustomerComboboxProps {
    id?: string;
    customers: CustomerOption[];
    value: CustomerOption | null;
    onChange: (customer: CustomerOption) => void;
    isLoading?: boolean;
    loadError?: string | null;
    onRetry?: () => void;
    disabled?: boolean;
    ariaInvalid?: boolean;
}

export function CustomerCombobox({
    id = "assign-customer",
    customers,
    value,
    onChange,
    isLoading = false,
    loadError = null,
    onRetry,
    disabled = false,
    ariaInvalid = false,
}: CustomerComboboxProps) {
    const options = useMemo<ComboOption[]>(() => {
        const base = customers.map((c) => ({
            key: String(c.id),
            primary: customerLabel(c),
            secondary: c.customer_code ? c.customer_name : null,
        }));
        // Defensive union: keep the selected customer renderable even when it
        // is absent from the list (BaseCombobox pins it past filter and cap).
        if (value && !customers.some((c) => c.id === value.id)) {
            base.unshift({
                key: String(value.id),
                primary: customerLabel(value),
                secondary: value.customer_code ? value.customer_name : null,
            });
        }
        return base;
    }, [customers, value]);
    return (
        <BaseCombobox
            id={id}
            placeholder="Select a customer"
            options={options}
            valueKey={value ? String(value.id) : null}
            onChange={(key) => {
                const found = customers.find((c) => String(c.id) === key);
                if (found) onChange(found);
            }}
            isLoading={isLoading}
            loadingText="Loading customers…"
            loadError={loadError}
            onRetry={onRetry}
            searchPlaceholder="Search customers…"
            disabled={disabled}
            ariaInvalid={ariaInvalid}
        />
    );
}

interface ItemComboboxProps {
    id?: string;
    items: AvailableItem[];
    value: AvailableItem | null;
    onChange: (item: AvailableItem) => void;
    disabled?: boolean;
    ariaInvalid?: boolean;
}

export function ItemCombobox({
    id = "assign-item",
    items,
    value,
    onChange,
    disabled = false,
    ariaInvalid = false,
}: ItemComboboxProps) {
    const available = useMemo(() => items.filter((i) => i.quantity_available > 0), [items]);
    // Union the selected item so it survives an availability drop to 0;
    // BaseCombobox pins it at the top past the filter and the render cap.
    const pool = useMemo(
        () =>
            value && !available.some((i) => i.id === value.id) ? [value, ...available] : available,
        [available, value],
    );
    const options = useMemo<ComboOption[]>(
        () =>
            pool.map((i) => ({
                key: String(i.id),
                primary: `${i.item_code} · ${i.name}`,
                secondary: null,
                meta: `${i.quantity_available} avail.`,
            })),
        [pool],
    );
    return (
        <BaseCombobox
            id={id}
            placeholder="Select an available item"
            options={options}
            valueKey={value ? String(value.id) : null}
            onChange={(key) => {
                const found = pool.find((i) => String(i.id) === key);
                if (found) onChange(found);
            }}
            searchPlaceholder="Search items…"
            disabled={disabled || pool.length === 0}
            ariaInvalid={ariaInvalid}
        />
    );
}
