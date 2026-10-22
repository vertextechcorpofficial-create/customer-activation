"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  Calendar,
  ChevronRight,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

function HeroBand({ data }: { data: PipelineHealth }) {
  const stuckShare = data.totals.open === 0 ? 0 : (data.stuckTotal / data.totals.open) * 100;
  const verdict = deriveVerdict(stuckShare);
  return (
    <Card className="bg-muted/60">
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-60 lg:shrink-0">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className={cn("size-2 shrink-0 rounded-full", VERDICT_DOT[verdict])} aria-hidden />
            Pipeline Status
          </p>
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
            <div className="mt-1">
              <DeltaLine delta={data.deltas.stuck} />
            </div>
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground">Median age in stage</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {data.medianAgeDays}
              <span className="text-sm font-normal text-muted-foreground"> days</span>
            </p>
            <div className="mt-1">
              <DeltaLine delta={data.deltas.medianAge} />
            </div>
          </div>
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground">Stalled stages</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.stalledStages}</p>
            <div className="mt-1">
              {data.stalledStages === 0 ? (
                <p className="text-xs text-muted-foreground">No stalled stages</p>
              ) : (
                <DeltaLine delta={data.deltas.stalledStages} />
              )}
            </div>
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

function funnelValue(stage: StageHealth, mode: "count" | "percentage", openTotal: number): string {
  if (mode === "count") return String(stage.leadCount);
  if (openTotal === 0) return "0.0%";
  return `${((stage.leadCount / openTotal) * 100).toFixed(1)}%`;
}

function StageFunnelCard({ data }: { data: PipelineHealth }) {
  const [mode, setMode] = useState<"count" | "percentage">("count");
  const open = [...data.stages]
    .filter((s) => !s.isTerminal)
    .sort((a, b) => a.stage_order - b.stage_order);
  const openTotal = open.reduce((sum, s) => sum + s.leadCount, 0);
  const max = Math.max(1, ...open.map((s) => s.leadCount));
  const hasTerminalTotals = data.totals.won + data.totals.lost > 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>Stage funnel</CardTitle>
          <CardDescription className="mt-1">Lead distribution across pipeline stages</CardDescription>
          {hasTerminalTotals && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Won {data.totals.won} · Lost {data.totals.lost}
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
                    <p className="text-lg font-bold tabular-nums">{funnelValue(s, mode, openTotal)}</p>
                    <p className="truncate text-xs font-medium" title={s.stage_name}>
                      {s.stage_name}
                    </p>
                    <div
                      className="mt-2 h-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)` }}
                      role="img"
                      aria-label={`${s.stage_name}: ${funnelValue(s, mode, openTotal)}`}
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
                        {funnelValue(s, mode, openTotal)}
                      </p>
                    </div>
                    <div
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${s.stage_name}: ${funnelValue(s, mode, openTotal)}`}
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
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Stage distribution</CardTitle>
        <CardDescription className="mt-1">Number of leads in each stage</CardDescription>
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
                          aria-label={`${s.stage_name}: ${s.leadCount} leads`}
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
  flow: ArrowRightLeft,
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
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-muted-foreground" aria-hidden />
          Key insights
        </CardTitle>
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
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6" aria-live="polite" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-56 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="size-9" />
        </div>
      </div>
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

export function HealthDashboard() {
  const [period, setPeriod] = useState<Period>(7);
  const { data, isLoading, error, refresh } = usePipelineHealth(period);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error && !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-10 text-center">
        <CircleAlert className="size-6 text-destructive" aria-hidden />
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            void refresh();
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  if (!data || (data.totals.total === 0 && data.stages.length === 0)) {
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
          <Select
            value={String(period)}
            onValueChange={(v) => {
              const next = Number(v);
              if ((PERIOD_OPTIONS as readonly number[]).includes(next)) {
                setPeriod(next as Period);
              }
            }}
          >
            <SelectTrigger className="w-40" aria-label="Period">
              <Calendar className="size-4 text-muted-foreground" aria-hidden />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  Last {p} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Period refetch keeps previous data on screen — no full-page flash. */}
      <div aria-busy={isLoading} className={cn("flex min-w-0 flex-col gap-4 sm:gap-6", isLoading && "opacity-70")}>
        <HeroBand data={data} />
        <StageFunnelCard data={data} />
        <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
          <DistributionCard data={data} />
          <InsightsCard data={data} />
        </div>
      </div>
    </div>
  );
}
