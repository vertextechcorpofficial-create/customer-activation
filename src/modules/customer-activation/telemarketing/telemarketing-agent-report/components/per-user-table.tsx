"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Mail, MapPin, Phone, StickyNote, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, type AgentReportRow, type ReportPeriod } from "../types/report.schema";

interface PerUserTableProps {
    rows: AgentReportRow[];
    period: ReportPeriod;
    onPeriodChange: (period: ReportPeriod) => void;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    rangeLabel?: string;
}

const KIND_META = [
    { key: "call", label: "Calls", short: "C", Icon: Phone },
    { key: "email", label: "Emails", short: "E", Icon: Mail },
    { key: "visit", label: "Visits", short: "V", Icon: MapPin },
    { key: "meeting", label: "Meetings", short: "M", Icon: Users },
    { key: "note", label: "Notes", short: "N", Icon: StickyNote },
] as const;

function compactSummary(row: AgentReportRow): string {
    return KIND_META.map(({ key, short }) => `${short} ${row.breakdown[key]}`).join(" · ");
}

function BreakdownDetail({ row }: { row: AgentReportRow }) {
    return (
        <div className="flex flex-wrap gap-2 py-1">
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

export function PerUserTable({
    rows,
    period,
    onPeriodChange,
    isLoading,
    error,
    onRetry,
    rangeLabel,
}: PerUserTableProps) {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-1">
                    <CardTitle>Per-user report</CardTitle>
                    <CardDescription>
                        {rangeLabel ?? "Activities and conversions by agent."}
                    </CardDescription>
                </div>
                <Select
                    value={period}
                    onValueChange={(value) => onPeriodChange(value as ReportPeriod)}
                >
                    <SelectTrigger className="w-full sm:w-44" aria-label="Report period">
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                        {PERIOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="grid gap-3">
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
                                No activities or conversions fall inside this period.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">Activities</TableHead>
                                    <TableHead className="text-right">Claimed</TableHead>
                                    <TableHead className="text-right">Won</TableHead>
                                    <TableHead className="hidden text-right sm:table-cell">
                                        Last activity
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => {
                                    const expanded = expandedId === row.agent_id;
                                    return (
                                        <Fragment key={row.agent_id}>
                                            <TableRow
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    setExpandedId(expanded ? null : row.agent_id)
                                                }
                                            >
                                                <TableCell className="min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <ChevronDown
                                                            className={cn(
                                                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                                                expanded && "rotate-180",
                                                            )}
                                                        />
                                                        <span
                                                            className="block max-w-[160px] truncate font-medium sm:max-w-[220px]"
                                                            title={row.display_name}
                                                        >
                                                            {row.display_name}
                                                        </span>
                                                    </span>
                                                    <span className="pl-6 text-xs text-muted-foreground">
                                                        {row.agent_code}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-semibold tabular-nums">
                                                        {row.activities_total}
                                                    </span>
                                                    <span
                                                        className="block text-xs text-muted-foreground tabular-nums"
                                                        title={compactSummary(row)}
                                                    >
                                                        {compactSummary(row)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {row.leads_claimed}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <StatusBadge
                                                        tone={row.conversions > 0 ? "success" : "neutral"}
                                                    >
                                                        <span className="tabular-nums">{row.conversions}</span>
                                                    </StatusBadge>
                                                </TableCell>
                                                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                                                    {row.last_activity_at ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                            {expanded ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="bg-muted/30">
                                                        <BreakdownDetail row={row} />
                                                        <p className="text-xs text-muted-foreground sm:hidden">
                                                            Last activity: {row.last_activity_at ?? "—"}
                                                        </p>
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
