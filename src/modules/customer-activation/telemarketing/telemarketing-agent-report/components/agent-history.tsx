"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAgentHistory } from "../hooks/use-agent-history";
import type {
    AgentHistory as AgentHistoryData,
    AgentHistoryActivity,
} from "../services/agent-history-service";
import type { ReportPeriod } from "../types/report.schema";
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

/** Kind → donut stroke (CSS vars, no hex) and legend icon tint. */
const KIND_STROKE: Record<string, string> = {
    call: "var(--color-info)",
    email: "var(--color-primary)",
    visit: "var(--color-warning)",
    meeting: "var(--color-success)",
};

const KIND_TEXT: Record<string, string> = {
    call: "text-info",
    email: "text-primary",
    visit: "text-warning",
    meeting: "text-success",
};

const MIX_ORDER = [
    { key: "call", label: "Calls" },
    { key: "email", label: "Emails" },
    { key: "visit", label: "Visits" },
    { key: "meeting", label: "Meetings" },
] as const;

/** Donut geometry: r=40, stroke-width=12, viewBox 0 0 120 120, ~2% gap. */
const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_GAP = DONUT_C * 0.02;
const DONUT_STROKE = 12;

const OUTCOME_TONE: Record<string, Tone> = {
    connected: "success",
    interested: "primary",
    callback: "info",
    no_answer: "warning",
    wrong_number: "destructive",
    not_interested: "neutral",
};

const PERIOD_SEGMENTS: Array<{ value: ReportPeriod; label: string }> = [
    { value: "mtd", label: "MTD" },
    { value: "last_30", label: "30d" },
    { value: "last_90", label: "90d" },
];

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
            aria-label={`${direction} ${magnitude} versus previous`}
        >
            <Icon className="size-3 shrink-0" aria-hidden />
            <span>{magnitude}</span>
            <span className="font-normal text-muted-foreground">vs previous</span>
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
                "mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
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

/** Tinted summary band — same visual language as the pipeline health hero band. */
function SummaryBand({ history }: { history: AgentHistoryData }) {
    const { kpis, deltas, rank, streak_days } = history;
    const stats: Array<{ label: string; value: string; delta: number | null; unit: "%" | "pts" }> = [
        { label: "Activities", value: String(kpis.activities), delta: deltas.activities, unit: "%" },
        { label: "Claimed", value: String(kpis.claimed), delta: deltas.claimed, unit: "%" },
        { label: "Won", value: String(kpis.won), delta: deltas.won, unit: "%" },
        {
            label: "Conversion rate",
            value: formatRate(kpis.conv_rate),
            delta: deltas.conv_rate,
            unit: "pts",
        },
    ];
    // Vertical rules: 2×2 on mobile (cells 2 and 4), full row dividers at lg.
    const cellRule = [
        "",
        "border-l border-border pl-4",
        "lg:border-l lg:border-border lg:pl-4",
        "border-l border-border pl-4",
    ];
    return (
        <Card className="bg-muted/60">
            <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="min-w-0 shrink-0 lg:w-52">
                    <p className="text-xs font-medium text-muted-foreground">Team rank</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                        #{rank.position}{" "}
                        <span className="text-lg font-semibold text-muted-foreground">
                            of {rank.of}
                        </span>
                    </p>
                    <StreakBadge days={streak_days} />
                </div>
                <dl
                    className="grid flex-1 grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4"
                    aria-label="Agent KPIs"
                >
                    {stats.map((stat, index) => (
                        <div key={stat.label} className={cn("min-w-0", cellRule[index])}>
                            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                            <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
                            <dd className="mt-1">
                                <DeltaLine delta={stat.delta} unit={stat.unit} />
                            </dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
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
    const summary = MIX_ORDER.map(({ key, label }) => `${label} ${history.breakdown[key]}`).join(
        ", ",
    );
    const fracs = MIX_ORDER.map(({ key }) => (total > 0 ? history.breakdown[key] / total : 0));
    const segments = MIX_ORDER.map(({ key }, index) => {
        const count = history.breakdown[key];
        const frac = fracs[index] ?? 0;
        const len = Math.max(0, frac * DONUT_C - DONUT_GAP);
        const offset = -fracs.slice(0, index).reduce((sum, f) => sum + f * DONUT_C, 0);
        return { key, count, len, offset };
    });
    return (
        <section aria-label="Work mix" className="min-w-0">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Work mix</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{total} total</span>
            </div>
            {total === 0 ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Activity className="size-4 shrink-0" aria-hidden />
                    No activity in this period.
                </p>
            ) : (
                <div className="mt-4 grid min-w-0 gap-4">
                    <div className="relative mx-auto w-fit">
                        <svg
                            viewBox="0 0 120 120"
                            className="size-40"
                            role="img"
                            aria-label={summary}
                        >
                            <circle
                                cx="60"
                                cy="60"
                                r={DONUT_R}
                                fill="none"
                                stroke="var(--color-muted)"
                                strokeWidth={DONUT_STROKE}
                            />
                            {segments.map((seg) =>
                                seg.count > 0 ? (
                                    <circle
                                        key={seg.key}
                                        cx="60"
                                        cy="60"
                                        r={DONUT_R}
                                        fill="none"
                                        stroke={KIND_STROKE[seg.key]}
                                        strokeWidth={DONUT_STROKE}
                                        strokeLinecap="round"
                                        strokeDasharray={`${seg.len} ${DONUT_C - seg.len}`}
                                        strokeDashoffset={seg.offset}
                                        transform="rotate(-90 60 60)"
                                    />
                                ) : null,
                            )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold tabular-nums">{total}</span>
                            <span className="text-xs text-muted-foreground">total touches</span>
                        </div>
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
                <h3 className="text-sm font-semibold">Versus team</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {team.agents} agents
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
        </section>
    );
}

function MixAndVersusCard({ history }: { history: AgentHistoryData }) {
    return (
        <Card className="min-w-0">
            <CardContent className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-6">
                <WorkMixHalf history={history} />
                <VersusTeamHalf history={history} />
            </CardContent>
        </Card>
    );
}

function HistorySkeleton() {
    return (
        <div className="grid min-w-0 gap-6" aria-label="Loading agent history">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div className="grid gap-2">
                    <Skeleton className="h-4 w-28" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-56" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="size-9" />
                </div>
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid items-start gap-6 lg:grid-cols-2">
                <Skeleton className="h-52 w-full rounded-xl" />
                <Skeleton className="h-52 w-full rounded-xl" />
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
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

/** One agent's KPIs, activity timeline and claimed leads for a period. */
export function AgentHistory({ agentId }: { agentId: number }) {
    const { history, period, setPeriod, isLoading, error, refresh } = useAgentHistory(agentId);
    const router = useRouter();

    // Period changes refetch with the previous response still cached — keep it
    // on screen (aria-busy) instead of blanking back to the skeleton.
    if (isLoading && !history) return <HistorySkeleton />;

    if (error && !history) {
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

    const { agent } = history;
    const dayGroups = groupByDay(history.activities);

    return (
        <div className="grid min-w-0 gap-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div className="grid min-w-0 gap-2">
                    <Link
                        href="/customer-activation/telemarketing/telemarketing-agent-report"
                        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                        aria-label="Back to agent report"
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Agent report
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
                <div className="flex items-center gap-2">
                    <div
                        role="group"
                        aria-label="History period"
                        className="inline-flex items-center gap-0.5 rounded-md border bg-muted/60 p-1"
                    >
                        {PERIOD_SEGMENTS.map((segment) => (
                            <button
                                key={segment.value}
                                type="button"
                                onClick={() => setPeriod(segment.value)}
                                aria-pressed={period === segment.value}
                                className={cn(
                                    "rounded px-2.5 py-1 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2",
                                    period === segment.value
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {segment.label}
                            </button>
                        ))}
                    </div>
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

            {/* Period refetch keeps prior data on screen — no full-page flash. */}
            <div
                aria-busy={isLoading}
                className={cn("grid min-w-0 gap-6", isLoading && "opacity-70")}
            >
                <SummaryBand history={history} />

                <MixAndVersusCard history={history} />

                {/* Scroll panes: each pane scrolls independently at lg (per-pane
                max height, so the taller dashboard above never forces the
                shell main to scroll); below lg the panes stack and the page
                scrolls — no internal scroll, no horizontal overflow. */}
                <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[2fr_1fr]">
                    <section
                        aria-label="Activity timeline"
                        className="min-h-0 min-w-0 lg:max-h-[62dvh] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                    >
                        <div className="flex items-center gap-2 lg:sticky lg:top-0 lg:z-20 lg:bg-background lg:py-2">
                            <Activity className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <h2 className="text-sm font-semibold">Activity</h2>
                            <span className="text-xs tabular-nums text-muted-foreground">
                                Showing {history.activities.length} entries ·{" "}
                                {history.kpis.activities} stage moves
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
                    </section>

                    <section
                        aria-label="Claimed leads"
                        className="min-h-0 min-w-0 lg:max-h-[62dvh] lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
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
                                        tabIndex={0}
                                        role="link"
                                        aria-label={`Open lead ${lead.lead_code}, ${lead.company_name}`}
                                        onClick={(event) => {
                                            if (isRowClickIgnored(event.target)) return;
                                            router.push(
                                                `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`,
                                            );
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ")
                                                return;
                                            if (isRowClickIgnored(event.target)) return;
                                            event.preventDefault();
                                            router.push(
                                                `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`,
                                            );
                                        }}
                                        className="flex cursor-pointer items-center gap-3 rounded-md py-2 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2"
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
                    </section>
                </div>
            </div>
        </div>
    );
}
