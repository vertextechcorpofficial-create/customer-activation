"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
    Activity,
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Building2,
    Flame,
    Mail,
    MapPin,
    Minus,
    Phone,
    RefreshCw,
    StickyNote,
    Trophy,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAgentHistory } from "../hooks/use-agent-history";
import { PeriodSelect } from "../../_shared/period-select";
import type {
    AgentHistory as AgentHistoryData,
    AgentHistoryActivity,
} from "../services/agent-history-service";
import { PERIOD_OPTIONS, type ReportPeriod } from "../types/report.schema";
import { DonutChart } from "./donut-chart";
import { StatusPill, type Tone } from "./status-pill";

const KIND_ICON: Record<string, LucideIcon> = {
    call: Phone,
    email: Mail,
    visit: MapPin,
    meeting: UsersRound,
    note: StickyNote,
};

/** Kind colour — the same channel map as the index activity bars (per-user-table KIND_META). */
const KIND_TONE: Record<string, Tone> = {
    call: "primary",
    email: "info",
    visit: "success",
    meeting: "warning",
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

const KIND_TEXT: Record<string, string> = {
    call: "text-primary",
    email: "text-info",
    visit: "text-success",
    meeting: "text-warning",
};

const MIX_ORDER = [
    { key: "call", label: "Calls" },
    { key: "email", label: "Emails" },
    { key: "visit", label: "Visits" },
    { key: "meeting", label: "Meetings" },
] as const;

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

/** Ratio → one-decimal percent; null (no claims) renders as an em dash. */
function formatRate(rate: number | null): string {
    return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
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

function LeadLink({
    leadId,
    company,
    code,
}: {
    leadId: number;
    company?: string | null;
    code?: string | null;
}) {
    const name = company?.trim() || code?.trim() || "Unknown lead";
    const secondary = company?.trim() ? code?.trim() || null : null;
    const label = company?.trim()
        ? `Open lead ${code?.trim() || leadId}, ${company.trim()}`
        : code?.trim()
          ? `Open lead ${code.trim()}`
          : "Open lead, Unknown lead";
    return (
        <Link
            href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${leadId}`}
            className="inline-flex min-w-0 max-w-full items-baseline gap-x-1.5 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={label}
            title={name}
        >
            <span className="min-w-0 truncate">{name}</span>
            {secondary ? (
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    · {secondary}
                </span>
            ) : null}
        </Link>
    );
}

/**
 * Period-over-period delta line. Renders NOTHING when the delta is null (no
 * baseline) — never a "0%" placeholder or dash-chip. `deltas.conv_rate` is
 * percentage points ("pts"); activities/claimed/won are percent change ("%").
 * Higher is better for every metric here, so up = success, down = destructive.
 */
function DeltaLine({ delta, unit }: { delta: number | null; unit: "%" | "pts" }) {
    if (delta === null) return null;
    const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
    const tone =
        delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";
    const magnitude = `${Math.abs(delta).toFixed(1)}${unit}`;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "unchanged";
    return (
        <p
            className={cn("flex items-center gap-1 text-xs tabular-nums", tone)}
            aria-label={`${direction} ${magnitude} versus previous period`}
        >
            <Icon className="size-3 shrink-0" aria-hidden />
            <span>{magnitude}</span>
            <span className="font-normal text-muted-foreground">vs previous period</span>
        </p>
    );
}

/** Streak badge — local duplicate (never import from sibling module folders). */
function StreakBadge({ days }: { days: number }) {
    if (days <= 0) return null;
    return (
        <span
            aria-label={`${days} day activity streak`}
            className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
                days >= 7
                    ? "border-transparent bg-destructive/15 text-destructive"
                    : days >= 3
                      ? "border-transparent bg-warning/15 text-warning"
                      : "border bg-muted text-muted-foreground",
            )}
        >
            <Flame className="size-3" aria-hidden />
            {days}d
        </span>
    );
}

/** KPI band — top-accent border, faint tint, icon chip; rank lives in the hero now. */
function KpiCard({
    label,
    value,
    icon,
    iconClass,
    toneClass,
    className = "",
    children,
}: {
    label: string;
    value: string;
    icon: ReactNode;
    iconClass: string;
    toneClass: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Card className={cn("shadow-none border-border/70 bg-card", toneClass, className)}>
            <CardContent className="space-y-1 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {label}
                    </p>
                    <span
                        aria-hidden
                        className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                            iconClass,
                        )}
                    >
                        {icon}
                    </span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <div className="text-xs text-muted-foreground">{children}</div>
            </CardContent>
        </Card>
    );
}

function KpiBand({ history }: { history: AgentHistoryData }) {
    const { kpis, deltas } = history;
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Agent KPIs">
            <KpiCard
                label="Activities"
                value={String(kpis.activities)}
                icon={<Activity className="size-4" aria-hidden />}
                iconClass="border-primary/20 bg-primary/10 text-primary"
                toneClass="border-t-2 border-t-primary bg-primary/[0.04]"
            >
                <DeltaLine delta={deltas.activities} unit="%" />
            </KpiCard>
            <KpiCard
                label="Claimed"
                value={String(kpis.claimed)}
                icon={<UsersRound className="size-4" aria-hidden />}
                iconClass="border-info/20 bg-info/10 text-info"
                toneClass="border-t-2 border-t-info bg-info/[0.06]"
            >
                <DeltaLine delta={deltas.claimed} unit="%" />
            </KpiCard>
            <KpiCard
                label="Won"
                value={String(kpis.won)}
                icon={<Trophy className="size-4" aria-hidden />}
                iconClass="border-success/20 bg-success/10 text-success"
                toneClass="border-t-2 border-t-success bg-success/[0.06]"
                className="col-span-2 sm:col-span-1"
            >
                <p className="tabular-nums">
                    {kpis.won}/{kpis.claimed} claimed · {formatRate(kpis.conv_rate)}
                </p>
                <DeltaLine delta={deltas.conv_rate} unit="pts" />
            </KpiCard>
        </div>
    );
}

function countGapChip(
    agent: number,
    teamAvg: number,
): { text: string; className: string; label: string } {
    const base =
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums";
    if (!teamAvg) {
        return {
            text: "—",
            className: cn(base, "border bg-muted text-muted-foreground"),
            label: "No team average",
        };
    }
    const gap = Math.round(((agent - teamAvg) / teamAvg) * 1000) / 10;
    if (gap === 0) {
        return {
            text: "level",
            className: cn(base, "border bg-muted text-muted-foreground"),
            label: "Level with the team average",
        };
    }
    const abs = Math.abs(gap).toFixed(1);
    return gap > 0
        ? {
              text: `+${abs}%`,
              className: cn(base, "border-transparent bg-success/15 text-success"),
              label: `${abs} percent above the team average`,
          }
        : {
              text: `−${abs}%`,
              className: cn(base, "border-transparent bg-destructive/15 text-destructive"),
              label: `${abs} percent below the team average`,
          };
}

function rateGapChip(
    agent: number | null,
    teamAvg: number | null,
): { text: string; className: string; label: string } {
    const base =
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums";
    const muted = {
        text: "—",
        className: cn(base, "border bg-muted text-muted-foreground"),
        label: "No team average",
    };
    if (agent === null || teamAvg === null || !teamAvg) return muted;
    const pts = Math.round((agent - teamAvg) * 1000) / 10;
    if (pts === 0) {
        return {
            text: "level",
            className: cn(base, "border bg-muted text-muted-foreground"),
            label: "Level with the team average",
        };
    }
    const abs = Math.abs(pts).toFixed(1);
    return pts > 0
        ? {
              text: `+${abs} pts`,
              className: cn(base, "border-transparent bg-success/15 text-success"),
              label: `${abs} points above the team average`,
          }
        : {
              text: `−${abs} pts`,
              className: cn(base, "border-transparent bg-destructive/15 text-destructive"),
              label: `${abs} points below the team average`,
          };
}

function WorkMixHalf({ history }: { history: AgentHistoryData }) {
    const total = MIX_ORDER.reduce((sum, { key }) => sum + history.breakdown[key], 0);
    const segments = [
        { label: "Calls", value: history.breakdown.call, strokeClass: "stroke-primary" },
        { label: "Emails", value: history.breakdown.email, strokeClass: "stroke-info" },
        { label: "Visits", value: history.breakdown.visit, strokeClass: "stroke-success" },
        { label: "Meetings", value: history.breakdown.meeting, strokeClass: "stroke-warning" },
    ];
    return (
        <section aria-label="Work mix" className="min-w-0">
            <h2 className="text-sm font-semibold leading-none">Work mix</h2>
            {total === 0 ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Activity className="size-4 shrink-0" aria-hidden />
                    No activity in this period.
                </p>
            ) : (
                <div className="mt-4 grid min-w-0 gap-4">
                    <div className="mx-auto w-fit">
                        <DonutChart
                            segments={segments}
                            label="total touches"
                            size={200}
                            strokeWidth={28}
                        />
                    </div>
                    <ul className="grid min-w-0 gap-2" aria-label="Activity mix legend">
                        {MIX_ORDER.map(({ key, label }) => {
                            const count = history.breakdown[key];
                            const share = total > 0 ? (count / total) * 100 : 0;
                            const Icon = KIND_ICON[key] ?? StickyNote;
                            return (
                                <li
                                    key={key}
                                    className="flex min-w-0 items-center gap-2 text-sm"
                                >
                                    <Icon
                                        className={cn("size-4 shrink-0", KIND_TEXT[key])}
                                        aria-hidden
                                    />
                                    <span className="min-w-0 truncate">{label}</span>
                                    <span className="ml-auto font-semibold tabular-nums">
                                        {count}
                                    </span>
                                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                        {share.toFixed(1)}%
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}

function VersusTeamHalf({ history }: { history: AgentHistoryData }) {
    const { kpis, team } = history;
    const countRows = (["activities", "claimed", "won"] as const).map((key) => {
        const agent = kpis[key];
        const teamAvg =
            key === "activities"
                ? team.avg_activities
                : key === "claimed"
                  ? team.avg_claimed
                  : team.avg_won;
        return {
            label: key === "activities" ? "Activities" : key === "claimed" ? "Claimed" : "Won",
            agentText: String(agent),
            teamText: teamAvg.toFixed(1),
            chip: countGapChip(agent, teamAvg),
        };
    });
    const rateRow = {
        label: "Conversion rate",
        agentText: formatRate(kpis.conv_rate),
        teamText: formatRate(team.avg_conv_rate),
        chip: rateGapChip(kpis.conv_rate, team.avg_conv_rate),
    };
    const rows = [...countRows, rateRow];
    return (
        <section
            aria-label="Versus team"
            className="min-w-0 lg:border-l lg:border-border lg:pl-6"
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold leading-none">Versus team</h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {team.agents} in team
                </span>
            </div>
            <table className="mt-4 w-full min-w-0 text-sm" aria-label="Agent versus team averages">
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.label}
                            className="border-b border-border last:border-0"
                        >
                            <th
                                scope="row"
                                className="min-w-0 py-2 pr-2 text-left font-normal text-muted-foreground"
                            >
                                <span className="block truncate">{row.label}</span>
                            </th>
                            <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                                {row.agentText}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                                {row.teamText}
                            </td>
                            <td className="py-2 text-right">
                                <span className={row.chip.className} aria-label={row.chip.label}>
                                    {row.chip.text}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
                Averages cover agents with activity this period; the team rate is pooled team
                won ÷ claimed.
            </p>
        </section>
    );
}

function MixAndVersusCard({ history }: { history: AgentHistoryData }) {
    return (
        <Card className="min-w-0 shadow-none border-border/70 bg-card">
            <CardContent className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-6">
                <WorkMixHalf history={history} />
                <VersusTeamHalf history={history} />
            </CardContent>
        </Card>
    );
}

function HistorySkeleton() {
    return (
        <div className="grid min-w-0 gap-3" aria-label="Loading agent history">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full col-span-2 sm:col-span-1" />
            </div>
            <div className="grid items-start gap-3 lg:grid-cols-3">
                <Skeleton className="h-72 w-full lg:col-span-2" />
                <Skeleton className="h-72 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

/** One agent's KPIs, activity timeline and claimed leads for a period. */
export function AgentHistory({ agentId }: { agentId: number }) {
    const { history, period, setPeriod, isLoading, error, refresh } = useAgentHistory(
        agentId,
        "last_30",
    );
    const router = useRouter();

    // Period changes refetch with the previous response still cached — keep it
    // on screen (aria-busy) instead of blanking back to the skeleton.
    if (isLoading && !history) return <HistorySkeleton />;

    if (error && !history) {
        return (
            <div className="grid min-w-0 gap-3">
                <div className="rounded-2xl border border-primary/15 bg-primary/[0.04]">
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                        <Link
                            href="/customer-activation/telemarketing/telemarketing-agent-report"
                            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                            aria-label="Back to agent report"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Agent report
                        </Link>
                        <div className="flex items-center gap-2">
                            <PeriodSelect
                                value={period}
                                options={PERIOD_OPTIONS}
                                onChange={(value) => setPeriod(value as ReportPeriod)}
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => void refresh()}
                                aria-label="Refresh agent history"
                            >
                                <RefreshCw className="size-4" aria-hidden />
                            </Button>
                        </div>
                    </div>
                </div>
                <Card className="shadow-none border-border/70 bg-card">
                    <CardContent className="p-4 sm:p-5">
                        <Alert variant="destructive">
                            <AlertTitle>Could not load the agent history.</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-4"
                            onClick={() => void refresh()}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!history) return null;

    const { agent } = history;
    const dayGroups = groupByDay(history.activities);

    return (
        <div className="grid min-w-0 gap-3">
            {/* Hero band */}
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.04]">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="grid min-w-0 gap-1.5">
                        <Link
                            href="/customer-activation/telemarketing/telemarketing-agent-report"
                            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                            aria-label="Back to agent report"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Agent report
                        </Link>
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                            {agent.display_name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <code className="rounded border border-border bg-background/70 px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                                {agent.agent_code}
                            </code>
                            <span
                                className="text-xs tabular-nums text-muted-foreground"
                                aria-label={`Team rank ${history.rank.position} of ${history.rank.of}`}
                            >
                                #{history.rank.position} of {history.rank.of}
                            </span>
                            <StreakBadge days={history.streak_days} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Same control and default as the index list, so one agent's
                        row and page describe the same window. */}
                        <PeriodSelect
                            value={period}
                            options={PERIOD_OPTIONS}
                            onChange={(value) => setPeriod(value as ReportPeriod)}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => void refresh()}
                            aria-label="Refresh agent history"
                        >
                            <RefreshCw
                                className={cn("size-4", isLoading && "animate-spin")}
                                aria-hidden
                            />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Period refetch keeps prior data on screen — no full-page flash. */}
            <div
                aria-busy={isLoading}
                className={cn("grid min-w-0 gap-3", isLoading && "opacity-70")}
            >
                <KpiBand history={history} />

                {/* Primary timeline + side claimed leads; merged mix/versus sits
                full-width below so the donut and table keep room at 1440. */}
                <div className="grid min-w-0 items-start gap-3 lg:grid-cols-3">
                    <Card className="min-w-0 shadow-none border-border/70 bg-card lg:col-span-2">
                        <CardHeader>
                            <div className="flex flex-wrap items-center gap-2">
                                <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <h2 className="text-sm font-semibold leading-none">Activity</h2>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    Showing {history.activities.length} entries ·{" "}
                                    {history.kpis.activities} stage moves
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                aria-label="Activity timeline"
                                tabIndex={0}
                                className="max-h-[62dvh] min-w-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                        {history.activities.length === 0 ? (
                            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                <Activity className="size-4 shrink-0" aria-hidden="true" />
                                No activity in this period.
                            </p>
                        ) : (
                            <div className="grid gap-5">
                                {dayGroups.map((group) => (
                                    <div key={group.key}>
                                        <p className="sticky top-0 z-10 bg-card py-1 text-xs font-medium text-muted-foreground">
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
                                                                <p className="mt-1 min-w-0 text-xs text-muted-foreground">
                                                                    <LeadLink
                                                                        leadId={activity.lead_id}
                                                                        company={activity.lead_company}
                                                                        code={activity.lead_code}
                                                                    />
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
                                                                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                                    {activity.duration_minutes !=
                                                                    null ? (
                                                                        <span className="tabular-nums">
                                                                            {activity.duration_minutes}{" "}
                                                                            min
                                                                        </span>
                                                                    ) : null}
                                                                    <LeadLink
                                                                        leadId={activity.lead_id}
                                                                        company={activity.lead_company}
                                                                        code={activity.lead_code}
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
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 shadow-none border-border/70 bg-card">
                        <CardHeader>
                            <div className="flex flex-wrap items-center gap-2">
                                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <h2 className="text-sm font-semibold leading-none">Claimed leads</h2>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {history.leads_total}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div
                                aria-label="Claimed leads"
                                tabIndex={0}
                                className="max-h-[62dvh] min-w-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                        {history.leads.length === 0 ? (
                            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                <Building2 className="size-4 shrink-0" aria-hidden="true" />
                                No claimed leads in this period.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {history.leads.map((lead) => (
                                    <li
                                        key={lead.lead_id}
                                        onClick={(event) => {
                                            if (isRowClickIgnored(event.target)) return;
                                            router.push(
                                                `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`,
                                            );
                                        }}
                                        className="flex cursor-pointer items-center gap-3 rounded-md py-2 hover:bg-muted/50"
                                    >
                                        <Building2
                                            className="size-4 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
                                                onClick={(event) => event.stopPropagation()}
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
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <MixAndVersusCard history={history} />
            </div>
        </div>
    );
}
