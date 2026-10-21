"use client";

import { useState } from "react";
import { Activity, CircleAlert, Percent, RefreshCw, Trophy, UserX, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePipelineHealth } from "../hooks/use-pipeline-health";
import { STUCK_DAY_OPTIONS } from "../types/report.schema";

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

export function HealthDashboard() {
  const [stuckDays, setStuckDays] = useState<number>(7);
  const { data, isLoading, error, refresh } = usePipelineHealth(stuckDays);

  if (isLoading && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
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

  const chartData = data.stages.map((s) => ({ name: s.stage_name, leads: s.leadCount }));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Pipeline health</h1>
          <p className="text-sm text-muted-foreground">
            {data.totals.total} {data.totals.total === 1 ? "lead" : "leads"} across {data.stages.length}{" "}
            {data.stages.length === 1 ? "stage" : "stages"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="stuck-days" className="text-xs text-muted-foreground">
            Stuck threshold
          </label>
          <Select
            value={String(stuckDays)}
            onValueChange={(v) => setStuckDays(Number(v))}
          >
            <SelectTrigger id="stuck-days" className="w-28">
              <SelectValue placeholder="Days" />
            </SelectTrigger>
            <SelectContent>
              {STUCK_DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} days
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
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Users className="size-4" aria-hidden />}
          label="Active leads"
          value={String(data.totals.active)}
          hint="Leads in non-terminal stages"
        />
        <KpiCard
          icon={<Trophy className="size-4" aria-hidden />}
          label="Won"
          value={String(data.totals.won)}
          hint="Leads in won stages"
        />
        <KpiCard
          icon={<UserX className="size-4" aria-hidden />}
          label="Lost"
          value={String(data.totals.lost)}
          hint="Leads in lost stages"
        />
        <KpiCard
          icon={<Percent className="size-4" aria-hidden />}
          label="Conversion"
          value={`${data.totals.conversionRate}%`}
          hint="Won ÷ (won + lost)"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads per stage</CardTitle>
          <CardDescription>Active stages in pipeline order.</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active stages.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stage ageing</CardTitle>
          <CardDescription>Average days in stage uses now − updated_at; oldest is the max.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Share %</TableHead>
                <TableHead className="text-right">Avg days</TableHead>
                <TableHead className="text-right">Oldest days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stages.map((s) => (
                <TableRow key={s.stage_id}>
                  <TableCell className="max-w-48">
                    <span className="block truncate font-medium" title={s.stage_name}>
                      {s.stage_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.leadCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.share}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.avgDaysInStage}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.oldestAgeDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stuck leads</CardTitle>
          <CardDescription>
            No activity in last_activity_at (fallback created_at) for over {data.stuckDays} days. Top{" "}
            {data.stuck.length} shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.stuck.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing stuck beyond {data.stuckDays} days.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.stuck.map((lead) => (
                <li key={lead.lead_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={lead.company_name}>
                      {lead.company_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{lead.lead_code}</span>
                      {" · "}
                      <span className="truncate" title={lead.stage_name}>
                        {lead.stage_name}
                      </span>
                    </p>
                  </div>
                  <StatusBadge tone="destructive" className="shrink-0 tabular-nums">
                    <CircleAlert className="size-3" aria-hidden />
                    {lead.daysStuck}d stuck
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
