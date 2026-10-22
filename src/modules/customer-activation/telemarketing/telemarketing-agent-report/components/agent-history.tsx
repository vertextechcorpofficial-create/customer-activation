"use client";

import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    Building2,
    Crosshair,
    Mail,
    MapPin,
    Percent,
    Phone,
    StickyNote,
    Trophy,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentHistory } from "../hooks/use-agent-history";
import type { AgentHistoryActivity } from "../services/agent-history-service";
import { PERIOD_OPTIONS, type ReportPeriod } from "../types/report.schema";
import { StatusPill, type Tone } from "./status-pill";

const KIND_ICON: Record<string, LucideIcon> = {
    call: Phone,
    email: Mail,
    visit: MapPin,
    meeting: UsersRound,
    note: StickyNote,
};

/** Kind colour, mirroring the module-local status-pill tone vocabulary. */
const KIND_TONE: Record<string, Tone> = {
    call: "info",
    email: "primary",
    visit: "warning",
    meeting: "success",
    note: "neutral",
};

const KIND_BADGE: Record<Tone, string> = {
    neutral: "border bg-muted text-muted-foreground",
    info: "border-transparent bg-info/15 text-info",
    primary: "border-transparent bg-primary/15 text-primary",
    success: "border-transparent bg-success/15 text-success",
    warning: "border-transparent bg-warning/15 text-warning",
    destructive: "border-transparent bg-destructive/15 text-destructive",
};

const OUTCOME_TONE: Record<string, Tone> = {
    connected: "success",
    interested: "primary",
    callback: "info",
    no_answer: "warning",
    wrong_number: "destructive",
    not_interested: "neutral",
};

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function stageTone(stageName: string): Tone {
    const name = stageName.toLowerCase();
    if (name.includes("won")) return "success";
    if (name.includes("lost")) return "destructive";
    return "neutral";
}

/**
 * Stored values are Philippine wall-clock ("YYYY-MM-DD HH:mm:ss"), so the
 * day, time and short date are read straight from the string — no timezone
 * conversion, no locale surprises.
 */
function parseWallClock(value: string | null | undefined): {
    dayKey: string;
    time: string;
    label: string;
} | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value ?? "");
    if (!m) return null;
    const monthIndex = Number(m[2]) - 1;
    const month = MONTHS[monthIndex] ?? "";
    const weekday = WEEKDAYS[new Date(Number(m[1]), monthIndex, Number(m[3])).getDay()] ?? "";
    if (!month || !weekday) return null;
    return {
        dayKey: `${m[1]}-${m[2]}-${m[3]}`,
        time: `${m[4]}:${m[5]}`,
        label: `${weekday}, ${month} ${Number(m[3])}`,
    };
}

function formatClaimedDate(value: string | null | undefined): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
    if (!m) return "—";
    const month = MONTHS[Number(m[2]) - 1] ?? "";
    if (!month) return "—";
    return `${month} ${Number(m[3])}, ${m[1]}`;
}

interface DayGroup {
    key: string;
    label: string;
    rows: Array<{ activity: AgentHistoryActivity; time: string }>;
}

function groupByDay(activities: AgentHistoryActivity[]): DayGroup[] {
    const groups: DayGroup[] = [];
    for (const activity of activities) {
        const parsed = parseWallClock(activity.occurred_at);
        const key = parsed?.dayKey ?? "unknown";
        const label = parsed?.label ?? "Unknown date";
        const time = parsed?.time ?? "—";
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.rows.push({ activity, time });
        else groups.push({ key, label, rows: [{ activity, time }] });
    }
    return groups;
}

function LeadLink({ leadId }: { leadId: number }) {
    return (
        <Link
            href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${leadId}`}
            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Open lead ${leadId}`}
        >
            Lead #{leadId}
        </Link>
    );
}

/** One agent's KPIs, activity timeline and claimed leads for a period. */
export function AgentHistory({ agentId }: { agentId: number }) {
    const { history, period, setPeriod, isLoading, error, refresh } = useAgentHistory(agentId);

    if (isLoading) {
        return (
            <div className="grid gap-6" aria-label="Loading agent history">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                    <div className="grid gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-9 w-56" />
                    </div>
                    <Skeleton className="h-9 w-full sm:w-44" />
                </div>
                <div className="grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-4">
                    <Skeleton className="h-20 rounded-none" />
                    <Skeleton className="h-20 rounded-none" />
                    <Skeleton className="h-20 rounded-none" />
                    <Skeleton className="h-20 rounded-none" />
                </div>
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="grid gap-4">
                        {[0, 1, 2, 3].map((row) => (
                            <div key={row} className="flex items-start gap-3">
                                <Skeleton className="h-4 w-10 shrink-0" />
                                <Skeleton className="size-7 shrink-0 rounded-full" />
                                <Skeleton className="h-4 flex-1" />
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-2">
                        {[0, 1, 2].map((row) => (
                            <Skeleton key={row} className="h-12 w-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium">Could not load the agent history.</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <div>
                    <Button size="sm" variant="outline" onClick={() => void refresh()}>
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    if (!history) return null;

    const { agent, kpis } = history;
    const convLabel = kpis.conv_rate === null ? "—" : `${Math.round(kpis.conv_rate * 100)}%`;
    const stats = [
        { label: "Activities", value: String(kpis.activities), icon: Activity },
        { label: "Claimed", value: String(kpis.claimed), icon: Crosshair },
        { label: "Won", value: String(kpis.won), icon: Trophy },
        { label: "Conversion rate", value: convLabel, icon: Percent },
    ];
    const cellClass = [
        "border-b border-r border-border p-4 sm:border-b-0",
        "border-b border-border p-4 sm:border-b-0 sm:border-r",
        "border-r border-border p-4",
        "p-4",
    ];
    const dayGroups = groupByDay(history.activities);

    return (
        <div className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div className="grid gap-2">
                    <Link
                        href="/customer-activation/telemarketing/telemarketing-agent-report"
                        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label="Back to agent report"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Back to report
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            {agent.display_name}
                        </h1>
                        <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {agent.agent_code}
                        </code>
                    </div>
                </div>
                <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
                    <SelectTrigger className="w-full sm:w-44" aria-label="History period">
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {PERIOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-4" aria-label="Agent KPIs">
                {stats.map((stat, index) => (
                    <div key={stat.label} className={cellClass[index]}>
                        <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <stat.icon className="size-4 shrink-0" aria-hidden="true" />
                            {stat.label}
                        </dt>
                        <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                            {stat.value}
                        </dd>
                    </div>
                ))}
            </dl>

            {/* Pane bound: shell header 4rem + main padding 2rem + identity ~4rem + KPI strip ~5.25rem + gaps 3rem ≈ 18rem, plus measured 6px overscroll (836 vs 842) → subtract both so shell main never scrolls at lg. */}
            <div className="grid min-h-0 items-start gap-6 lg:h-[calc(100dvh-18rem-6px)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-stretch">
                <section
                    aria-label="Activity timeline"
                    className="min-h-0 min-w-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                >
                    <div className="flex items-center gap-2 lg:sticky lg:top-0 lg:z-20 lg:bg-background lg:py-2">
                        <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <h2 className="text-sm font-semibold">Activity</h2>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {history.activities_total}
                        </span>
                    </div>
                    {history.activities.length === 0 ? (
                        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <Activity className="size-4 shrink-0" aria-hidden="true" />
                            No activity in this period.
                        </p>
                    ) : (
                        <div className="mt-3 grid gap-5 lg:mt-1">
                            {dayGroups.map((group) => (
                                <div key={group.key}>
                                    <p className="sticky top-0 z-10 bg-background py-1 text-xs font-medium text-muted-foreground lg:top-9">
                                        {group.label}
                                    </p>
                                    <ol className="mt-1">
                                        {group.rows.map(({ activity, time }, rowIndex) => {
                                            const isNote = activity.kind === "note";
                                            const isLast = rowIndex === group.rows.length - 1;
                                            const Icon = KIND_ICON[activity.kind] ?? StickyNote;
                                            const kindTone = KIND_TONE[activity.kind] ?? "neutral";
                                            const tone =
                                                OUTCOME_TONE[activity.outcome ?? ""] ?? "neutral";
                                            return (
                                                <li
                                                    key={activity.activity_id}
                                                    className="grid grid-cols-[2.75rem_1.75rem_minmax(0,1fr)] gap-x-3"
                                                >
                                                    <span className="pt-1 text-right text-xs tabular-nums text-muted-foreground">
                                                        {time}
                                                    </span>
                                                    <span
                                                        className="relative flex justify-center"
                                                        aria-hidden="true"
                                                    >
                                                        <span
                                                            className={
                                                                isLast
                                                                    ? isNote
                                                                        ? "absolute top-0 h-4 w-px bg-border"
                                                                        : "absolute top-0 h-7 w-px bg-border"
                                                                    : "absolute inset-y-0 w-px bg-border"
                                                            }
                                                        />
                                                        {isNote ? (
                                                            <span className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                                                        ) : (
                                                            <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border ${KIND_BADGE[kindTone]}`}>
                                                                <Icon className="size-3.5" />
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isNote ? (
                                                        <div className="min-w-0 pb-5">
                                                            <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                                                                {activity.notes ?? "Note"}
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                <LeadLink leadId={activity.lead_id} />
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="min-w-0 pb-5">
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                <span className="text-sm font-medium capitalize">
                                                                    {activity.kind}
                                                                </span>
                                                                {activity.outcome ? (
                                                                    <StatusPill
                                                                        tone={tone}
                                                                        className="capitalize"
                                                                    >
                                                                        {activity.outcome.replace(
                                                                            /_/g,
                                                                            " ",
                                                                        )}
                                                                    </StatusPill>
                                                                ) : null}
                                                            </div>
                                                            {activity.notes ? (
                                                                <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                                                                    {activity.notes}
                                                                </p>
                                                            ) : null}
                                                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                                {activity.duration_minutes !=
                                                                null ? (
                                                                    <span className="tabular-nums">
                                                                        {activity.duration_minutes}{" "}
                                                                        min
                                                                    </span>
                                                                ) : null}
                                                                <LeadLink
                                                                    leadId={activity.lead_id}
                                                                />
                                                            </p>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section
                    aria-label="Claimed leads"
                    className="min-h-0 min-w-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                >
                    <div className="flex items-center gap-2 lg:sticky lg:top-0 lg:z-20 lg:bg-background lg:py-2">
                        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <h2 className="text-sm font-semibold">Claimed leads</h2>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {history.leads_total}
                        </span>
                    </div>
                    {history.leads.length === 0 ? (
                        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <Building2 className="size-4 shrink-0" aria-hidden="true" />
                            No claimed leads in this period.
                        </p>
                    ) : (
                        <ul className="mt-1 divide-y divide-border lg:mt-0">
                            {history.leads.map((lead) => (
                                <li
                                    key={lead.lead_id}
                                    className="flex items-center gap-3 py-2"
                                >
                                    <Building2
                                        className="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
                                            className="block truncate text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                            title={`${lead.company_name} (${lead.lead_code})`}
                                            aria-label={`Open lead ${lead.lead_code}, ${lead.company_name}`}
                                        >
                                            {lead.company_name}
                                        </Link>
                                        <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
                                            {lead.lead_code} · {formatClaimedDate(lead.claimed_at)}
                                        </p>
                                    </div>
                                    <StatusPill
                                        tone={stageTone(lead.stage_name)}
                                        className="shrink-0"
                                    >
                                        {lead.stage_name}
                                    </StatusPill>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
