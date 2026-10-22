"use client";

import { RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useLeaderboard } from "../hooks/use-leaderboard";
import type { LeaderboardRow } from "../types/leaderboard.schema";

// ponytail: no period/filter control — the service is fixed month-to-date
// (Asia/Manila) and inventing a period param would need a backend change, so
// the board shows what exists (MTD window in the header above).

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        rank <= 3 ? "text-base font-semibold" : "text-sm text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

function PodiumCard({
  row,
  place,
  featured,
}: {
  row: LeaderboardRow;
  place: 1 | 2 | 3;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-lg border border-border bg-card px-4 py-4 text-center",
        featured && "border-primary/40 bg-primary/5 py-6",
        place === 1 && "order-first sm:order-2",
        place === 2 && "sm:order-1",
        place === 3 && "sm:order-3",
      )}
    >
      <p className="text-xs text-muted-foreground">Rank {row.rank}</p>
      <p
        className={cn(
          "w-full truncate font-semibold",
          featured ? "text-lg" : "text-sm",
        )}
        title={row.name}
      >
        {row.name}
      </p>
      <p
        className={cn(
          "tabular-nums",
          featured
            ? "text-3xl font-bold"
            : "text-xl font-semibold text-muted-foreground",
        )}
      >
        {row.score}
      </p>
    </div>
  );
}

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const top = rows.slice(0, 3);
  const first = top.find((r) => r.rank === 1);
  const second = top.find((r) => r.rank === 2);
  const third = top.find((r) => r.rank === 3);
  return (
    <section aria-label="Top performers" className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-3 sm:items-stretch">
      {second ? <PodiumCard row={second} place={2} /> : null}
      {first ? <PodiumCard row={first} place={1} featured /> : null}
      {third ? <PodiumCard row={third} place={3} /> : null}
    </section>
  );
}

export function LeaderboardTable() {
  const { rows, isLoading, error, refresh } = useLeaderboard();

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="grid gap-3" aria-live="polite" aria-label="Loading leaderboard">
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Trophy />
          </EmptyMedia>
          <EmptyTitle>No leaderboard yet</EmptyTitle>
          <EmptyDescription>
            No agent activity has been recorded for this month.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const maxScore = Math.max(...rows.map((row) => row.score), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="min-w-0 p-4">
        <Podium rows={rows} />
      </div>
      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableCaption className="px-4 pb-3 text-left">
            Score = conversions × 3 + qualified × 2 + activities × 1. Conversion rate is shown on Agent Report.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20 text-right">Rank</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="w-40 text-right">Score</TableHead>
              <TableHead className="w-28 text-right">Conversions</TableHead>
              <TableHead className="w-28 text-right">Qualified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.agent_id}>
                <TableCell className="text-right tabular-nums">
                  <RankBadge rank={row.rank} />
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="block truncate font-medium" title={row.name}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="block text-base font-semibold tabular-nums">
                    {row.score}
                  </span>
                  <span
                    className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`Score ${row.score} of top ${maxScore}`}
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((row.score / maxScore) * 100)}%` }}
                    />
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.conversions}</TableCell>
                <TableCell className="text-right tabular-nums">{row.qualified}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
