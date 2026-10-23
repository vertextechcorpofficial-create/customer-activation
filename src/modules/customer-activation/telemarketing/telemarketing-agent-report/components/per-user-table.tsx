"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronDown,
    Mail,
    MapPin,
    Phone,
    Search,
    SearchX,
    Users,
    UsersRound,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn, formatDateTime as formatSharedDateTime } from "@/lib/utils";
import {
    type AgentReportRow,
} from "../types/report.schema";

interface PerUserTableProps {
    rows: AgentReportRow[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

/** Canonical channel colours — the agent page donut/legend uses this same mapping. */
const KIND_META = [
    { key: "call", label: "Calls", short: "C", Icon: Phone, bar: "bg-primary" },
    { key: "email", label: "Emails", short: "E", Icon: Mail, bar: "bg-info" },
    { key: "visit", label: "Visits", short: "V", Icon: MapPin, bar: "bg-success" },
    { key: "meeting", label: "Meetings", short: "M", Icon: Users, bar: "bg-warning" },
] as const;

type SortKey = "activities" | "claimed" | "won" | "rate";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Array<{ key: SortKey; label: string }> = [
    { key: "activities", label: "Activities" },
    { key: "claimed", label: "Claimed" },
    { key: "won", label: "Won" },
    { key: "rate", label: "Conv. rate" },
];

function compactSummary(row: AgentReportRow): string {
    return KIND_META.map(({ key, short }) => `${short} ${row.breakdown[key]}`).join(" · ");
}

/** Conversions ÷ leads claimed — both counted inside the selected period; null when there is no base. */
function convRate(row: AgentReportRow): number | null {
    if (row.leads_claimed <= 0) return null;
    return row.conversions / row.leads_claimed;
}

/**
 * Stacked channel distribution — the per-agent activity mix from the one
 * bounded query the service already returns (no extra reads).
 */
function DistributionBar({ row }: { row: AgentReportRow }) {
    if (row.activities_total <= 0) return null;
    return (
        <span
            className="mt-1 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Activity mix: ${compactSummary(row)}`}
            title={compactSummary(row)}
        >
            {KIND_META.map(({ key, bar, label }) =>
                row.breakdown[key] > 0 ? (
                    <span
                        key={key}
                        className={bar}
                        title={`${label}: ${row.breakdown[key]}`}
                        style={{
                            width: `${(row.breakdown[key] / row.activities_total) * 100}%`,
                        }}
                    />
                ) : null,
            )}
        </span>
    );
}

/**
 * The stored value is Philippine wall-clock ("YYYY-MM-DD HH:mm:ss"), so it is
 * read as +08:00 before formatting via the shared formatter — one human
 * format everywhere (DESIGN §3).
 */
function formatDbDateTime(value: string | null | undefined): string {
    if (!value) return "—";
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
    const date = new Date(hasZone ? iso : `${iso}+08:00`);
    return Number.isNaN(date.getTime()) ? "—" : formatSharedDateTime(date);
}

function BreakdownDetail({ row }: { row: AgentReportRow }) {
    return (
        // Capped to the visible scroller width so chips wrap instead of clipping mid-word.
        <div className="flex max-w-[calc(100vw-6rem)] flex-wrap gap-2 py-1 md:max-w-none">
            {KIND_META.map(({ key, label, Icon }) => (
                <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
                >
                    <Icon className="size-3.5" />
                    {label}
                    <span className="font-semibold text-foreground tabular-nums">{row.breakdown[key]}</span>
                </span>
            ))}
        </div>
    );
}

function SortHeaderButton({
    label,
    column,
    sortKey,
    sortDir,
    onToggle,
}: {
    label: string;
    column: SortKey;
    sortKey: SortKey | null;
    sortDir: SortDir;
    onToggle: (column: SortKey) => void;
}) {
    const active = sortKey === column;
    const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
        <button
            type="button"
            onClick={() => onToggle(column)}
            aria-label={`Sort by ${label}${active ? (sortDir === "desc" ? " (descending)" : " (ascending)") : ""}`}
            className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            {label}
            <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
        </button>
    );
}

/** Row clicks must ignore interactive elements and portalled menus. */
function isRowClickIgnored(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.closest(
            "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
        ) !== null
    );
}

/** Default order (service): conversions desc, then activities desc, then id. */
function defaultCompare(a: AgentReportRow, b: AgentReportRow): number {
    return (
        b.conversions - a.conversions ||
        b.activities_total - a.activities_total ||
        a.agent_id - b.agent_id
    );
}

export function PerUserTable({
    rows,
    isLoading,
    error,
    onRetry,
}: PerUserTableProps) {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    // ponytail: search/filter/sort run client-side over the already-fetched
    // bounded roster (AGENT_CAP ceiling in per-user-service.ts) — the rows
    // already carry the kind breakdown, so a server round-trip per keystroke
    // would buy nothing.
    const visibleRows = useMemo(() => {
        const q = debouncedQuery.trim().toLowerCase();
        const filtered = rows.filter((row) => {
            if (
                q &&
                !`${row.display_name} ${row.agent_code}`.toLowerCase().includes(q)
            ) {
                return false;
            }
            return true;
        });
        if (sortKey === null) return filtered;
        const valueOf = (row: AgentReportRow): number | null => {
            switch (sortKey) {
                case "activities":
                    return row.activities_total;
                case "claimed":
                    return row.leads_claimed;
                case "won":
                    return row.conversions;
                case "rate":
                    return convRate(row);
            }
        };
        return [...filtered].sort((a, b) => {
            const av = valueOf(a);
            const bv = valueOf(b);
            if (av === null && bv === null) return defaultCompare(a, b);
            if (av === null) return 1;
            if (bv === null) return -1;
            if (av !== bv) return sortDir === "desc" ? bv - av : av - bv;
            return defaultCompare(a, b);
        });
    }, [rows, debouncedQuery, sortKey, sortDir]);

    const trimmedQuery = debouncedQuery.trim();
    const isActive =
        query.trim() !== "" || sortKey !== null || expandedIds.size > 0;

    // Header count follows the module convention ("4 agents", "1 of 4 agents").
    const countLabel =
        error || isLoading
            ? "—"
            : trimmedQuery !== ""
              ? `${visibleRows.length} of ${rows.length} ${rows.length === 1 ? "agent" : "agents"}`
              : `${rows.length} ${rows.length === 1 ? "agent" : "agents"}`;

    function resetControls() {
        setQuery("");
        setDebouncedQuery("");
        setSortKey(null);
        setSortDir("desc");
        setExpandedIds(new Set());
    }

    function toggleSort(column: SortKey) {
        if (sortKey !== column) {
            setSortKey(column);
            setSortDir("desc");
            return;
        }
        if (sortDir === "desc") {
            setSortDir("asc");
            return;
        }
        setSortKey(null);
        setSortDir("desc");
    }

    function toggleExpand(agentId: number) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(agentId)) next.delete(agentId);
            else next.add(agentId);
            return next;
        });
    }

    const allExpanded =
        visibleRows.length > 0 && visibleRows.every((row) => expandedIds.has(row.agent_id));

    function toggleAll() {
        if (allExpanded) setExpandedIds(new Set());
        else setExpandedIds(new Set(visibleRows.map((row) => row.agent_id)));
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-baseline gap-2">
                    <CardTitle>Per-user report</CardTitle>
                    <p
                        className="text-xs tabular-nums text-muted-foreground"
                        aria-live="polite"
                    >
                        {countLabel}
                    </p>
                </div>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3">
                {isLoading ? (
                    <div className="grid gap-2" aria-label="Loading report">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ) : error ? (
                    <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-sm font-medium">Could not load the report.</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <div>
                            <Button size="sm" variant="outline" onClick={onRetry}>
                                Try again
                            </Button>
                        </div>
                    </div>
                ) : rows.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <UsersRound className="size-5" />
                            </EmptyMedia>
                            <EmptyTitle>No agent activity</EmptyTitle>
                            <EmptyDescription>
                                No activities, claims, or conversions fall inside this period.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-56">
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden
                                />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name or code"
                                    aria-label="Search agents by name or code"
                                    className={cn("h-9 pr-8 pl-8", query === "" && "pr-3")}
                                />
                                {query !== "" ? (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        aria-label="Clear search"
                                        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        <X className="size-4" aria-hidden />
                                    </button>
                                ) : null}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={toggleAll}
                                className="h-9 border border-muted-foreground sm:ml-auto"
                            >
                                {allExpanded ? "Collapse all" : "Expand all"}
                            </Button>
                            {isActive ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetControls}
                                    className="h-9 border border-muted-foreground"
                                >
                                    Reset
                                </Button>
                            ) : null}
                        </div>
                        {visibleRows.length === 0 ? (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <SearchX className="size-5" />
                                    </EmptyMedia>
                                    <EmptyTitle>
                                        {`No agents match ‘${trimmedQuery}’`}
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        Try a different search or clear the search.
                                    </EmptyDescription>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={resetControls}
                                    >
                                        Reset
                                    </Button>
                                </EmptyHeader>
                            </Empty>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                    <ul
                                        aria-label="Channel colours"
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                                    >
                                        {KIND_META.map(({ key, label, bar }) => (
                                            <li
                                                key={key}
                                                className="inline-flex items-center gap-1.5"
                                            >
                                                <span
                                                    className={cn(
                                                        "size-2 shrink-0 rounded-full",
                                                        bar,
                                                    )}
                                                    aria-hidden
                                                />
                                                {label}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-muted-foreground md:hidden">
                                        Scroll sideways for more columns.
                                    </p>
                                </div>
                                <div className="max-w-full overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card">
                                            <TableRow>
                                                <TableHead>Agent</TableHead>
                                                {SORT_COLUMNS.map(({ key, label }) => (
                                                    <TableHead
                                                        key={key}
                                                        aria-sort={
                                                            sortKey === key
                                                                ? sortDir === "desc"
                                                                    ? "descending"
                                                                    : "ascending"
                                                                : "none"
                                                        }
                                                        className="text-right tabular-nums"
                                                    >
                                                        <SortHeaderButton
                                                            label={label}
                                                            column={key}
                                                            sortKey={sortKey}
                                                            sortDir={sortDir}
                                                            onToggle={toggleSort}
                                                        />
                                                    </TableHead>
                                                ))}
                                                <TableHead className="whitespace-nowrap text-right tabular-nums">
                                                    Last activity
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {visibleRows.map((row) => {
                                                const expanded = expandedIds.has(row.agent_id);
                                                return (
                                                    <Fragment key={row.agent_id}>
                                                        <TableRow
                                                            className="cursor-pointer hover:bg-muted/50"
                                                            onClick={(event) => {
                                                                if (isRowClickIgnored(event.target))
                                                                    return;
                                                                router.push(
                                                                    `/customer-activation/telemarketing/telemarketing-agent-report/${row.agent_id}`,
                                                                );
                                                            }}
                                                        >
                                                            <TableCell className="min-w-0">
                                                                <span className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        data-no-row-click
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleExpand(row.agent_id);
                                                                        }}
                                                                        aria-expanded={expanded}
                                                                        aria-controls={`breakdown-${row.agent_id}`}
                                                                        aria-label={`${expanded ? "Collapse" : "Expand"} channel breakdown for ${row.display_name}`}
                                                                        title={`${expanded ? "Collapse" : "Expand"} breakdown`}
                                                                        className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                                                                    >
                                                                        <ChevronDown
                                                                            className={cn(
                                                                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                                                                expanded && "rotate-180",
                                                                            )}
                                                                        />
                                                                    </button>
                                                                    <Link
                                                                        href={`/customer-activation/telemarketing/telemarketing-agent-report/${row.agent_id}`}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title={`Open history for ${row.display_name} (${row.agent_code})`}
                                                                        aria-label={`Open history for ${row.display_name}, ${row.agent_code}`}
                                                                        className="block max-w-40 truncate font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:max-w-56"
                                                                    >
                                                                        {row.display_name}
                                                                    </Link>
                                                                </span>
                                                                <span className="pl-6 text-xs text-muted-foreground">
                                                                    {row.agent_code}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                <span className="font-semibold tabular-nums">
                                                                    {row.activities_total}
                                                                </span>
                                                                <span
                                                                    className="block text-xs text-muted-foreground tabular-nums"
                                                                    title={compactSummary(row)}
                                                                >
                                                                    {compactSummary(row)}
                                                                </span>
                                                                <DistributionBar row={row} />
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {row.leads_claimed}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                <StatusPill
                                                                    tone={row.conversions > 0 ? "success" : "neutral"}
                                                                >
                                                                    <span className="tabular-nums">{row.conversions}</span>
                                                                </StatusPill>
                                                            </TableCell>
                                                            <TableCell className="text-right text-muted-foreground tabular-nums">
                                                                {(() => {
                                                                    const rate = convRate(row);
                                                                    return rate === null
                                                                        ? "—"
                                                                        : `${(rate * 100).toFixed(1)}%`;
                                                                })()}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap text-right text-muted-foreground tabular-nums">
                                                                {formatDbDateTime(row.last_activity_at)}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow
                                                            id={`breakdown-${row.agent_id}`}
                                                            hidden={!expanded}
                                                            aria-label={`Channel breakdown for ${row.display_name}`}
                                                        >
                                                            <TableCell colSpan={6} className="bg-muted/30">
                                                                <BreakdownDetail row={row} />
                                                            </TableCell>
                                                        </TableRow>
                                                    </Fragment>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
