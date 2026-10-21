"use client";

import { useState } from "react";
import { useDebounce } from "use-debounce";
import { ChevronLeft, ChevronRight, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useProspects } from "../hooks/use-prospects";
import { ProspectStatusSchema, type ProspectStatus } from "../types/prospect.schema";

const PAGE_SIZE = 20;
const ALL = "all";

const STATUS_TONE: Record<ProspectStatus, StatusTone> = {
    new: "neutral",
    contacted: "info",
    qualified: "success",
    converted: "success",
    rejected: "destructive",
};

const STATUS_OPTIONS = ProspectStatusSchema.options;

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "—";
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    const date = new Date(/[+-]\d{2}:\d{2}$|Z$/.test(iso) ? iso : `${iso}+08:00`);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

/** Recent manually-entered prospects, filterable by status or search term. */
export function ProspectTable({ refreshKey = 0 }: { refreshKey?: number }) {
    const [statusFilter, setStatusFilter] = useState<string>(ALL);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [debouncedSearch] = useDebounce(search, 300);

    const { items, meta, isLoading, error, refresh } = useProspects({
        status: statusFilter === ALL ? undefined : (statusFilter as ProspectStatus),
        search: debouncedSearch.trim() || undefined,
        page,
        limit: PAGE_SIZE,
        refreshKey,
    });

    const filtered = statusFilter !== ALL || debouncedSearch.trim() !== "";
    const pageCount = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
    const from = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, meta.total);

    const resetFilters = () => {
        setStatusFilter(ALL);
        setSearch("");
        setPage(1);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle>Recent prospects</CardTitle>
                        <CardDescription>
                            {meta.total} {meta.total === 1 ? "prospect" : "prospects"} entered manually.
                        </CardDescription>
                    </div>
                    {filtered ? (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            <X className="size-4" aria-hidden />
                            Clear filters
                        </Button>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <div className="space-y-1.5">
                        <Label htmlFor="prospect-status">Status</Label>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger id="prospect-status" className="h-11 w-full md:h-9">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All statuses</SelectItem>
                                {STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={status} value={status} className="capitalize">
                                        {status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="prospect-search">Search</Label>
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                            />
                            <Input
                                id="prospect-search"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                placeholder="Company, contact, code, email or mobile"
                                className="h-11 pl-8 md:h-9"
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
                        <p className="text-sm text-destructive">{error}</p>
                        <Button variant="outline" onClick={() => void refresh()}>
                            <RefreshCw className="size-4" aria-hidden />
                            Retry
                        </Button>
                    </div>
                ) : isLoading && items.length === 0 ? (
                    <div className="space-y-2" aria-live="polite">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <SearchX />
                            </EmptyMedia>
                            <EmptyTitle>No prospects to show</EmptyTitle>
                            <EmptyDescription>
                                {filtered
                                    ? "No prospect matches these filters. Widen the status or search term."
                                    : "No prospect has been entered manually yet."}
                            </EmptyDescription>
                        </EmptyHeader>
                        {filtered ? (
                            <EmptyContent>
                                <Button variant="outline" onClick={resetFilters}>
                                    Clear filters
                                </Button>
                            </EmptyContent>
                        ) : null}
                    </Empty>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-28">Code</TableHead>
                                        <TableHead className="max-w-56">Company</TableHead>
                                        <TableHead className="max-w-48">Contact</TableHead>
                                        <TableHead className="w-32">Status</TableHead>
                                        <TableHead className="w-40">Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((prospect) => (
                                        <TableRow key={prospect.prospect_id}>
                                            <TableCell className="font-mono text-xs tabular-nums">
                                                {prospect.prospect_code}
                                            </TableCell>
                                            <TableCell className="max-w-56">
                                                <span
                                                    className="block truncate font-medium"
                                                    title={prospect.company_name}
                                                >
                                                    {prospect.company_name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-48">
                                                <span
                                                    className="block truncate"
                                                    title={prospect.contact_name ?? undefined}
                                                >
                                                    {prospect.contact_name || "—"}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {prospect.mobile || prospect.email || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge tone={STATUS_TONE[prospect.prospect_status]} className="capitalize">
                                                    {prospect.prospect_status}
                                                </StatusBadge>
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {formatDateTime(prospect.created_at)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-muted-foreground">
                                {from}–{to} of {meta.total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1 || isLoading}
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                >
                                    <ChevronLeft className="size-4" aria-hidden />
                                    Previous
                                </Button>
                                <span className="text-sm tabular-nums text-muted-foreground">
                                    Page {page} of {pageCount}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pageCount || isLoading}
                                    onClick={() => setPage((current) => current + 1)}
                                >
                                    Next
                                    <ChevronRight className="size-4" aria-hidden />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
