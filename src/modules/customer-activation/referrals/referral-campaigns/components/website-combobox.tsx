"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ReferralWebsite } from "../providers/website-provider";

function matches(site: ReferralWebsite, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
        site.name.toLowerCase().includes(q) ||
        site.website_code.toLowerCase().includes(q)
    );
}

/**
 * Required single-select over the referral websites catalogue — Popover +
 * Command. Per-module copy by project rule: no cross-module imports.
 */
export function WebsiteCombobox({
    controlId,
    value,
    onChange,
    websites,
    websitesLoading,
    disabled,
    invalid,
    describedBy,
}: {
    controlId: string;
    value: string;
    onChange: (websiteId: string) => void;
    websites: ReferralWebsite[];
    websitesLoading: boolean;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const filtered = websites.filter((site) => matches(site, query));
    const selected = websites.find((site) => String(site.website_id) === value) ?? null;
    const label = selected
        ? selected.name
        : websitesLoading
          ? "Loading websites…"
          : "Select a website";

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={controlId}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Website"
                    aria-required="true"
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    disabled={disabled || websitesLoading}
                    className="w-full justify-between font-normal"
                >
                    <span className="min-w-0 flex-1 truncate text-left" title={label}>
                        {label}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false} label="Search websites">
                    <CommandInput
                        placeholder="Search websites…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList className="max-h-60">
                        <CommandEmpty>
                            {websitesLoading ? "Loading websites…" : "No websites found."}
                        </CommandEmpty>
                        <CommandGroup>
                            {filtered.map((site) => {
                                const isSelected = String(site.website_id) === value;
                                return (
                                    <CommandItem
                                        key={site.website_id}
                                        value={`${site.name} ${site.website_code} ${site.website_id}`}
                                        keywords={[site.name, site.website_code]}
                                        title={site.name}
                                        onSelect={() => {
                                            onChange(String(site.website_id));
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                isSelected ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 truncate">{site.name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

/** Toolbar filter: "All websites" first, then each website by name. */
export function WebsiteFilterCombobox({
    value,
    onChange,
    websites,
    isLoading,
    error,
    onRetry,
    disabled,
}: {
    value: number | null;
    onChange: (websiteId: number | null) => void;
    websites: ReferralWebsite[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const filtered = websites.filter((site) => matches(site, query));
    const selected = value == null ? null : (websites.find((site) => site.website_id === value) ?? null);
    const label = selected ? selected.name : isLoading ? "Loading websites…" : "All websites";

    if (error && websites.length === 0) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="shrink-0 whitespace-nowrap"
            >
                Retry websites
            </Button>
        );
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Filter by website"
                    disabled={disabled || isLoading}
                    className="w-[150px] shrink-0 justify-between font-normal sm:w-[170px]"
                >
                    <span className="min-w-0 flex-1 truncate text-left" title={label}>
                        {label}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false} label="Search websites">
                    <CommandInput
                        placeholder="Search websites…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList className="max-h-60">
                        <CommandEmpty>
                            {isLoading ? "Loading websites…" : "No websites found."}
                        </CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all websites"
                                keywords={["all", "websites"]}
                                title="All websites"
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                    setQuery("");
                                }}
                            >
                                <Check
                                    className={cn(
                                        "size-4 shrink-0",
                                        value == null ? "opacity-100" : "opacity-0",
                                    )}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate">All websites</span>
                            </CommandItem>
                            {filtered.map((site) => {
                                const isSelected = site.website_id === value;
                                return (
                                    <CommandItem
                                        key={site.website_id}
                                        value={`${site.name} ${site.website_code} ${site.website_id}`}
                                        keywords={[site.name, site.website_code]}
                                        title={site.name}
                                        onSelect={() => {
                                            onChange(site.website_id);
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                isSelected ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 truncate">{site.name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
