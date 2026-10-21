"use client";

import { Medal, RefreshCw, Trophy } from "lucide-react";
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
import { useLeaderboard } from "../hooks/use-leaderboard";

function RankBadge({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Trophy : rank <= 3 ? Medal : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon ? (
        <Icon
          className={rank === 1 ? "size-4 text-foreground" : "size-4 text-muted-foreground"}
          aria-hidden
        />
      ) : null}
      <span
        className={
          rank === 1
            ? "text-sm font-semibold tabular-nums"
            : "text-sm tabular-nums text-muted-foreground"
        }
      >
        {rank}
      </span>
    </span>
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
      <div className="space-y-2" aria-live="polite">
        {Array.from({ length: 6 }).map((_, index) => (
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

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableCaption className="px-3 pb-3 text-left">
          Score = conversions × 3 + qualified × 2 + activities × 1 · month-to-date (Asia/Manila)
        </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Rank</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead className="w-28 text-right">Score</TableHead>
          <TableHead className="w-32 text-right">Conversions</TableHead>
          <TableHead className="w-28 text-right">Qualified</TableHead>
          <TableHead className="w-28 text-right">Activities</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.agent_id}>
            <TableCell>
              <RankBadge rank={row.rank} />
            </TableCell>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right text-base font-semibold tabular-nums">
              {row.score}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.conversions}</TableCell>
            <TableCell className="text-right tabular-nums">{row.qualified}</TableCell>
            <TableCell className="text-right tabular-nums">{row.activities}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}
