"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Gauge,
  Lightbulb,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PeriodSelect, rollingPeriodOptions } from "../../_shared/period-select";
import { stageColor } from "./stage-tone";
import { usePipelineHealth } from "../hooks/use-pipeline-health";
import {
  PERIOD_OPTIONS,
  type HealthInsight,
  type Period,
  type PipelineHealth,
  type StageHealth,
} from "../types/report.schema";

type Verdict = "healthy" | "at risk" | "critical";

const VERDICT_LABEL: Record<Verdict, string> = {
  healthy: "Healthy",
  "at risk": "At risk",
  critical: "Critical",
};

const VERDICT_DOT: Record<Verdict, string> = {
  healthy: "bg-success",
  "at risk": "bg-warning",
  critical: "bg-destructive",
};

const VERDICT_SENTENCE: Record<Verdict, string> = {
  healthy: "Leads are moving steadily through the pipeline.",
  "at risk": "A few leads need attention to keep things moving.",
  critical: "Several leads are stalled and need follow-up now.",
};

function deriveVerdict(stuckShare: number): Verdict {
  if (stuckShare >= 20) return "critical";
  if (stuckShare >= 10) return "at risk";
  return "healthy";
}

// One instance of each section per page; the ids tie every card's heading to
// the region landmark that wraps it.
const STATUS_TITLE_ID = "pipeline-health-status-title";
const STUCK_TITLE_ID = "pipeline-health-stuck-title";
const FUNNEL_TITLE_ID = "pipeline-health-funnel-title";
const DISTRIBUTION_TITLE_ID = "pipeline-health-distribution-title";
const INSIGHTS_TITLE_ID = "pipeline-health-insights-title";

const PERIOD_SELECT_OPTIONS = rollingPeriodOptions(PERIOD_OPTIONS);

/**
 * Delta line for stuck / median-age / stalled stats. Lower is better, so a
 * decrease renders in the success tone and an increase in destructive.
 * A null/missing delta renders NOTHING — no chip, no placeholder.
 */
function DeltaLine({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          <Minus className="size-3" aria-hidden />
          0.0%
        </span>
        <span className="text-[11px] text-muted-foreground">vs previous period</span>
      </p>
    );
  }
  const down = delta < 0;
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
          down ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
        )}
      >
        <Icon className="size-3" aria-hidden />
        {`${Math.abs(delta).toFixed(1)}%`}
      </span>
      <span className="text-[11px] text-muted-foreground">vs previous period</span>
    </p>
  );
}

/**
 * Renders the delta slot only when a comparison exists, so the four hero
 * columns stay the same height instead of reserving a blank line for a
 * `null` delta (the previous window is unavailable for a fresh dataset).
 */
function DeltaSlot({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) return null;
  return (
    <div className="mt-1">
      <DeltaLine delta={delta} />
    </div>
  );
}

function HeroBand({ data }: { data: PipelineHealth }) {
  const stuckShare = data.totals.open === 0 ? 0 : (data.stuckTotal / data.totals.open) * 100;
  const verdict = deriveVerdict(stuckShare);
  return (
    <Card role="region" aria-labelledby={STATUS_TITLE_ID} className="bg-muted/60">
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-60 lg:shrink-0">
          <h2
            id={STATUS_TITLE_ID}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
          >
            <span className={cn("size-2 shrink-0 rounded-full", VERDICT_DOT[verdict])} aria-hidden />
            Pipeline Status
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight">{VERDICT_LABEL[verdict]}</p>
          <p className="mt-1 text-sm text-muted-foreground">{VERDICT_SENTENCE[verdict]}</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4 lg:gap-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Open leads</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.totals.open}</p>
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground">Stuck</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.stuckTotal}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              No activity for more than {data.stuckDays} days
            </p>
            <DeltaSlot delta={data.deltas.stuck} />
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground">Median age in stage</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.medianAgeDays}
              <span className="text-sm font-normal text-muted-foreground"> days</span>
            </p>
            <DeltaSlot delta={data.deltas.medianAge} />
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground">Stalled stages</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.stalledStages}</p>
            <DeltaSlot delta={data.deltas.stalledStages} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CHEVRON_FIRST = "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)";
const CHEVRON_MID =
  "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
const CHEVRON_LAST = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)";

/**
 * Largest-remainder rounding in tenths of a percent, so the displayed stage
 * shares sum to exactly 100.0 instead of drifting to 99.9.
 *
 * Only `leadCount` / open-stage total is used. The payload's per-stage `share`
 * is deliberately ignored: it divides by `totals.total` (closed stages
 * included), so it answers a different question than this open-lead funnel.
 */
function percentageTenths(counts: number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 1000);
  const tenths = exact.map((value) => Math.floor(value));
  const spare = 1000 - tenths.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - tenths[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < spare && i < byRemainder.length; i += 1) {
    tenths[byRemainder[i].index] += 1;
  }
  return tenths;
}

function StageFunnelCard({ data }: { data: PipelineHealth }) {
  const [mode, setMode] = useState<"count" | "percentage">("count");
  const open = [...data.stages]
    .filter((s) => !s.isTerminal)
    .sort((a, b) => a.stage_order - b.stage_order);
  const openTotal = open.reduce((sum, s) => sum + s.leadCount, 0);
  const max = Math.max(1, ...open.map((s) => s.leadCount));
  const hasTerminalTotals = data.totals.won + data.totals.lost > 0;
  const tenths = percentageTenths(
    open.map((s) => s.leadCount),
    openTotal,
  );
  const tenthsByStage = new Map(open.map((s, i) => [s.stage_id, tenths[i]]));
  const value = (stage: StageHealth): string =>
    mode === "count"
      ? String(stage.leadCount)
      : `${((tenthsByStage.get(stage.stage_id) ?? 0) / 10).toFixed(1)}%`;

  return (
    <Card role="region" aria-labelledby={FUNNEL_TITLE_ID}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id={FUNNEL_TITLE_ID} className="leading-none font-semibold">
            Stage funnel
          </h2>
          {hasTerminalTotals && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Won {data.totals.won} · Lost {data.totals.lost} · {data.totals.conversionRate}% of
              closed leads won
            </p>
          )}
        </div>
        <div className="flex shrink-0 rounded-lg bg-muted p-1" role="group" aria-label="Funnel value mode">
          {(["count", "percentage"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m === "count" ? "Count" : "Percentage"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open stages to show.</p>
        ) : (
          <>
            {/* sm and up: chevron segments, equal flex-1 widths so long funnels never overflow. */}
            <div className="hidden min-w-0 sm:flex" role="list" aria-label="Stage funnel">
              {open.map((s, i) => {
                const color = stageColor(s);
                const last = i === open.length - 1;
                const clipPath =
                  open.length === 1 ? "none" : i === 0 ? CHEVRON_FIRST : last ? CHEVRON_LAST : CHEVRON_MID;
                const widthPct =
                  s.leadCount === 0 ? 0 : Math.max(4, Math.round((s.leadCount / max) * 100));
                return (
                  <div
                    key={s.stage_id}
                    role="listitem"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
                      clipPath,
                      marginLeft: i > 0 ? "-10px" : 0,
                    }}
                    className={cn(
                      "min-w-0 flex-1 py-3",
                      i === 0 ? "pr-6 pl-4" : last ? "pr-4 pl-7" : "px-6",
                    )}
                  >
                    <p className="text-lg font-bold tabular-nums">{value(s)}</p>
                    <p className="truncate text-xs font-medium" title={s.stage_name}>
                      {s.stage_name}
                    </p>
                    <div
                      className="mt-2 h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)` }}
                      role="img"
                      aria-label={`${s.stage_name}: ${value(s)}, average ${s.avgDaysInStage} days in stage`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Below sm: chevrons collapse, so stacked rows (name, bar, count/percent). */}
            <ul className="flex min-w-0 flex-col gap-3 sm:hidden">
              {open.map((s) => {
                const color = stageColor(s);
                const widthPct =
                  s.leadCount === 0 ? 0 : Math.max(4, Math.round((s.leadCount / max) * 100));
                return (
                  <li key={s.stage_id} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium" title={s.stage_name}>
                        {s.stage_name}
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {value(s)}
                      </p>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${s.stage_name}: ${value(s)}, average ${s.avgDaysInStage} days in stage`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionCard({ data }: { data: PipelineHealth }) {
  const open = [...data.stages]
    .filter((s) => !s.isTerminal)
    .sort((a, b) => a.stage_order - b.stage_order);
  const max = Math.max(1, ...open.map((s) => s.leadCount));
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => i * step);

  return (
    <Card role="region" aria-labelledby={DISTRIBUTION_TITLE_ID} className="min-w-0">
      <CardHeader>
        <h2 id={DISTRIBUTION_TITLE_ID} className="leading-none font-semibold">
          Stage distribution
        </h2>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open stages to show.</p>
        ) : (
          <div className="flex min-w-0 gap-2">
            <div className="flex h-48 w-8 shrink-0 flex-col justify-between text-right" aria-hidden>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="text-[11px] leading-none text-muted-foreground tabular-nums"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div
                className="absolute inset-x-0 top-0 flex h-48 flex-col justify-between"
                aria-hidden
              >
                {ticks.map((t) => (
                  <div key={t} className="border-t border-border" />
                ))}
              </div>
              <div className="relative flex h-48 min-w-0 items-stretch gap-2">
                {open.map((s) => {
                  const color = stageColor(s);
                  const heightPct = top === 0 ? 0 : (s.leadCount / top) * 100;
                  return (
                    <div
                      key={s.stage_id}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className="text-xs font-semibold tabular-nums">{s.leadCount}</span>
                      <div className="flex w-full max-w-10 flex-1 items-end">
                        <div
                          className="w-full rounded-t-md"
                          style={{
                            height: `${heightPct}%`,
                            minHeight: s.leadCount > 0 ? 4 : 0,
                            backgroundColor: color,
                          }}
                          role="img"
                          aria-label={`${s.stage_name}: ${s.leadCount} ${s.leadCount === 1 ? "lead" : "leads"}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 border-t border-border pt-2">
                {open.map((s) => (
                  <p
                    key={s.stage_id}
                    title={s.stage_name}
                    className="min-w-0 flex-1 text-center text-[11px] leading-tight text-muted-foreground line-clamp-2"
                  >
                    {s.stage_name}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INSIGHT_ICON = {
  speed: Gauge,
  stalled: TriangleAlert,
} as const;

const INSIGHT_TONE_CIRCLE: Record<HealthInsight["tone"], string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  destructive: "bg-destructive/15 text-destructive",
};

function InsightsCard({ data }: { data: PipelineHealth }) {
  return (
    <Card role="region" aria-labelledby={INSIGHTS_TITLE_ID} className="min-w-0">
      <CardHeader>
        <h2 id={INSIGHTS_TITLE_ID} className="flex items-center gap-2 leading-none font-semibold">
          <Lightbulb className="size-4 text-muted-foreground" aria-hidden />
          Key insights
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insights for this period yet.</p>
        ) : (
          data.insights.map((insight) => {
            const Icon = INSIGHT_ICON[insight.id];
            return (
              <div
                key={insight.id}
                className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-3"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    INSIGHT_TONE_CIRCLE[insight.tone],
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{insight.detail}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The leads behind the "Stuck" figure. The payload's `stuck` array is the top
 * slice (server cap) of exactly the population `stuckTotal` counts, so the
 * rows here and the hero figure only diverge when the cap truncates.
 */
function StuckLeadsCard({ data }: { data: PipelineHealth }) {
  const terminalStageIds = new Set(
    data.stages.filter((stage) => stage.isTerminal).map((stage) => stage.stage_id),
  );
  // The API already scans open stages only; re-checking keeps a closed lead out
  // of the list even if the payload ever widens.
  const rows = data.stuck.filter((lead) => !terminalStageIds.has(lead.stage_id));
  const threshold = data.stuckDays;
  const total = data.stuckTotal;
  const truncated = total > rows.length;

  return (
    <Card role="region" aria-labelledby={STUCK_TITLE_ID} className="min-w-0">
      <CardHeader>
        <h2 id={STUCK_TITLE_ID} className="leading-none font-semibold">
          Stuck leads
        </h2>
        <CardDescription className="mt-1">
          {total === 0
            ? "Nothing to follow up."
            : `${total} ${total === 1 ? "lead has" : "leads have"} had no activity for more than ${threshold} days.`}
        </CardDescription>
        {truncated && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing the {rows.length} oldest of {total} stuck leads.
          </p>
        )}
      </CardHeader>
      {rows.length > 0 && (
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((lead) => (
              <li
                key={lead.lead_id}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
                  aria-label={`Open lead ${lead.lead_code} ${lead.company_name}`}
                  className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {lead.lead_code}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
                <p
                  className="min-w-0 basis-full truncate text-sm font-medium sm:flex-1 sm:basis-auto"
                  title={lead.company_name}
                >
                  {lead.company_name}
                </p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {lead.stage_name}
                </span>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {lead.lastActivityAt == null
                    ? `No activity since creation · ${lead.daysStuck}d`
                    : `Last activity ${lead.daysStuck} ${lead.daysStuck === 1 ? "day" : "days"} ago`}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6" aria-live="polite" aria-busy="true">
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/**
 * In-card failure state. A failed request keeps the dashboard shell — page
 * chrome, title, filters — and offers Retry, so a transient upstream drop
 * never replaces the app with the global error page.
 */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6"
    >
      <h2 className="flex items-center gap-2 font-semibold leading-none">
        <CircleAlert className="size-4 text-destructive" aria-hidden />
        Could not load pipeline health
      </h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden />
        Retry
      </Button>
    </div>
  );
}

function NoPipelineData() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Activity />
        </EmptyMedia>
        <EmptyTitle>No pipeline data</EmptyTitle>
        <EmptyDescription>There are no stages or leads to report on yet.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function HealthDashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const { data, isLoading, error, refresh } = usePipelineHealth(period);

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Pipeline Health</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Overview of your telemarketing leads and their progression through the pipeline.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PeriodSelect
            value={String(period)}
            options={PERIOD_SELECT_OPTIONS}
            onChange={(value) => {
              const next = Number(value);
              if ((PERIOD_OPTIONS as readonly number[]).includes(next)) {
                setPeriod(next as Period);
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void refresh();
            }}
            aria-label="Refresh report"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {isLoading && !data ? (
        <LoadingSkeleton />
      ) : !data ? (
        error ? (
          <LoadError message={error} onRetry={() => void refresh()} />
        ) : (
          <NoPipelineData />
        )
      ) : data.totals.total === 0 && data.stages.length === 0 ? (
        <NoPipelineData />
      ) : (
        // Period refetch keeps previous data on screen — no full-page flash.
        <div
          aria-busy={isLoading}
          className={cn("flex min-w-0 flex-col gap-4 sm:gap-6", isLoading && "opacity-70")}
        >
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
              <p className="min-w-0 text-sm">
                <span className="font-medium">Could not refresh.</span>{" "}
                <span className="text-muted-foreground">
                  Showing the last successful load. {error}
                </span>
              </p>
              <Button size="sm" variant="outline" onClick={() => void refresh()}>
                <RefreshCw className="size-4" aria-hidden />
                Retry
              </Button>
            </div>
          )}
          <HeroBand data={data} />
          <StuckLeadsCard data={data} />
          <StageFunnelCard data={data} />
          <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
            <DistributionCard data={data} />
            <InsightsCard data={data} />
          </div>
        </div>
      )}
    </div>
  );
}
