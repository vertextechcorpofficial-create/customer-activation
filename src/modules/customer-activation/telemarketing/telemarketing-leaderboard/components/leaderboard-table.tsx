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
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
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

function rankTone(rank: number): StatusTone {
  if (rank === 1) return "success";
  if (rank === 2) return "info";
  if (rank === 3) return "warning";
  return "neutral";
}

function RankBadge({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Trophy : rank <= 3 ? Medal : null;
  return (
    <StatusBadge tone={rankTone(rank)}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}# {rank}
    </StatusBadge>
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
    <Table>
      <TableCaption>Score = conversions × 3 + qualified × 2 + activities × 1 · month-to-date (Asia/Manila)</TableCaption>
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
  );
}
