"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronDown, Crown, RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "../types/leaderboard.schema";
import { AgentDetail } from "./agent-detail";
import {
  MomentumBadge,
  RankDeltaBadge,
  StreakBadge,
} from "./leaderboard-badges";

export interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const FORMULA_CAPTION = "Score = conversions × 3 + qualified × 2 + activities × 1.";

type Surface = "podium" | "table" | "card";

/**
 * The table and the card list are both mounted (one is md:hidden), so the
 * panel id is scoped per surface — an unsuffixed id would appear twice.
 */
function panelId(agentId: number, surface: Surface): string {
  return `leaderboard-detail-${agentId}-${surface}`;
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

/** Animated count-up — the number itself is the fact being encoded. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const mv = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(mv, (latest) => String(Math.round(latest)));
  useEffect(() => {
    if (reduceMotion) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [value, reduceMotion, mv]);
  return (
    <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>
  );
}

/** Proportional score bar, animated from 0 on first paint. */
function ScoreBar({
  score,
  maxScore,
  barClass,
  label,
}: {
  score: number;
  maxScore: number;
  barClass: string;
  label: string;
}) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <span
      className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={label}
    >
      <motion.span
        className={cn("block h-full rounded-full", barClass)}
        initial={{ width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </span>
  );
}

function BadgeRow({ row, className }: { row: LeaderboardRow; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <RankDeltaBadge row={row} />
      {/* No previous rank means no previous score, so momentum would only
          repeat the NEW pill. */}
      {row.previous_rank === null ? null : <MomentumBadge row={row} />}
      <StreakBadge days={row.streak_days} />
    </span>
  );
}

function PodiumCard({
  row,
  place,
  featured,
  maxScore,
  expanded,
  onToggle,
}: {
  row: LeaderboardRow;
  place: 1 | 2 | 3;
  featured?: boolean;
  maxScore: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={(event) => {
        if (isRowClickIgnored(event.target)) return;
        onToggle();
      }}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border bg-card px-4 py-4 text-center transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:hover:shadow-none",
        featured
          ? "border-warning/40 bg-warning/5 py-8 ring-1 ring-warning/30"
          : place === 3
            ? "border-warning/25"
            : "border-muted-foreground/30",
        place === 1 && "sm:order-2",
        place === 2 && "sm:order-1",
        place === 3 && "sm:order-3",
      )}
    >
      {featured ? (
        <Crown className="size-5 text-warning" aria-hidden />
      ) : null}
      <p className="text-xs text-muted-foreground tabular-nums">
        Rank {row.rank}
      </p>
      <p
        className={cn(
          "w-full truncate font-semibold",
          featured ? "text-lg" : "text-sm",
        )}
        title={row.display_name}
      >
        {row.display_name}
      </p>
      <p className="text-xs text-muted-foreground">{row.agent_code}</p>
      {featured ? (
        <CountUp
          value={row.score}
          className="text-4xl font-bold text-foreground"
        />
      ) : (
        <span className="text-xl font-semibold text-muted-foreground tabular-nums">
          {row.score}
        </span>
      )}
      <BadgeRow row={row} className="justify-center" />
      <span className="mt-1 w-full">
        <ScoreBar
          score={row.score}
          maxScore={maxScore}
          barClass={featured ? "bg-warning" : "bg-muted-foreground/60"}
          label={`Score ${row.score}, highest on the board is ${maxScore}`}
        />
      </span>
      <button
        type="button"
        data-no-row-click
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-expanded={expanded}
        aria-controls={panelId(row.agent_id, "podium")}
        aria-label={`${expanded ? "Hide" : "Show"} details for ${row.display_name}`}
        className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <span
          data-no-row-click
          className="mt-1 w-full text-left"
          onClick={(event) => event.stopPropagation()}
        >
          <AgentDetail row={row} id={panelId(row.agent_id, "podium")} />
        </span>
      ) : null}
    </div>
  );
}

function Podium({
  rows,
  maxScore,
  expandedIds,
  onToggle,
}: {
  rows: LeaderboardRow[];
  maxScore: number;
  expandedIds: Set<number>;
  onToggle: (agentId: number) => void;
}) {
  const top = rows.slice(0, 3);
  return (
    <section aria-labelledby="leaderboard-podium-heading" className="min-w-0">
      <h2 id="leaderboard-podium-heading" className="sr-only">
        Top performers
      </h2>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:items-stretch">
        {top.map((row, index) => (
          <PodiumCard
            key={row.agent_id}
            row={row}
            place={(index + 1) as 1 | 2 | 3}
            featured={index === 0}
            maxScore={maxScore}
            expanded={expandedIds.has(row.agent_id)}
            onToggle={() => onToggle(row.agent_id)}
          />
        ))}
      </div>
    </section>
  );
}

function RankedTable({
  rows,
  maxScore,
  expandedIds,
  onToggle,
}: {
  rows: LeaderboardRow[];
  maxScore: number;
  expandedIds: Set<number>;
  onToggle: (agentId: number) => void;
}) {
  return (
    <section
      aria-labelledby="leaderboard-ranked-heading"
      className="hidden overflow-x-auto md:block"
    >
      <h2 id="leaderboard-ranked-heading" className="sr-only">
        Ranked agents
      </h2>
      <Table>
        <TableCaption className="px-4 pb-3 text-left">
          {FORMULA_CAPTION}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-right">Rank</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead className="w-44">Score</TableHead>
            <TableHead>Movement</TableHead>
            <TableHead>Momentum</TableHead>
            <TableHead title="Consecutive days with recorded activity">
              Streak
            </TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Details</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const expanded = expandedIds.has(row.agent_id);
            return [
              <motion.tr
                key={row.agent_id}
                layout
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
                onClick={(event) => {
                  if (isRowClickIgnored(event.target)) return;
                  onToggle(row.agent_id);
                }}
                className={cn(
                  "cursor-pointer border-b transition-colors hover:bg-muted/50",
                  expanded && "bg-muted/30",
                )}
              >
                <td className="p-2 text-right align-middle text-sm text-muted-foreground tabular-nums">
                  {row.rank}
                </td>
                <td className="max-w-56 p-2 align-middle">
                  <span
                    className="block truncate font-medium"
                    title={`${row.display_name} (${row.agent_code})`}
                  >
                    {row.display_name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.agent_code}
                  </span>
                </td>
                <td className="min-w-36 p-2 align-middle">
                  <span className="block text-base font-semibold tabular-nums">
                    {row.score}
                  </span>
                  <span className="mt-1 block">
                    <ScoreBar
                      score={row.score}
                      maxScore={maxScore}
                      barClass="bg-primary"
                      label={`Score ${row.score}, highest on the board is ${maxScore}`}
                    />
                  </span>
                </td>
                <td className="p-2 align-middle">
                  <RankDeltaBadge row={row} />
                </td>
                <td className="p-2 align-middle">
                  {row.previous_rank === null ? (
                    <span className="text-xs text-muted-foreground">
                      <span aria-hidden>—</span>
                      <span className="sr-only">no previous period</span>
                    </span>
                  ) : (
                    <MomentumBadge row={row} />
                  )}
                </td>
                <td className="p-2 align-middle">
                  {row.streak_days > 0 ? (
                    <StreakBadge days={row.streak_days} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      <span aria-hidden>—</span>
                      <span className="sr-only">no active streak</span>
                    </span>
                  )}
                </td>
                <td className="p-2 align-middle">
                  <button
                    type="button"
                    data-no-row-click
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(row.agent_id);
                    }}
                    aria-expanded={expanded}
                    aria-controls={panelId(row.agent_id, "table")}
                    aria-label={`${expanded ? "Hide" : "Show"} details for ${row.display_name}`}
                    className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </td>
              </motion.tr>,
              expanded ? (
                <tr key={`${row.agent_id}-detail`} className="border-b">
                  <td colSpan={7} className="bg-muted/30 p-3">
                    <AgentDetail row={row} id={panelId(row.agent_id, "table")} />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </TableBody>
      </Table>
    </section>
  );
}

function RankedCards({
  rows,
  maxScore,
  expandedIds,
  onToggle,
}: {
  rows: LeaderboardRow[];
  maxScore: number;
  expandedIds: Set<number>;
  onToggle: (agentId: number) => void;
}) {
  return (
    <section
      aria-labelledby="leaderboard-ranked-cards-heading"
      className="grid min-w-0 gap-2 md:hidden"
    >
      <h2 id="leaderboard-ranked-cards-heading" className="sr-only">
        Ranked agents
      </h2>
      {rows.map((row) => {
        const expanded = expandedIds.has(row.agent_id);
        return (
          <motion.div
            key={row.agent_id}
            layout
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className={cn(
              "min-w-0 rounded-lg border border-border bg-card",
              expanded && "bg-muted/20",
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(row.agent_id)}
              aria-expanded={expanded}
              aria-controls={panelId(row.agent_id, "card")}
              aria-label={`${row.display_name}, rank ${row.rank}, score ${row.score}. ${expanded ? "Hide" : "Show"} details.`}
              className="grid w-full min-w-0 gap-2 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium"
                    title={`${row.display_name} (${row.agent_code})`}
                  >
                    {row.display_name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.agent_code}
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold tabular-nums">
                  {row.score}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
              <span className="block">
                <ScoreBar
                  score={row.score}
                  maxScore={maxScore}
                  barClass="bg-primary"
                  label={`Score ${row.score}, highest on the board is ${maxScore}`}
                />
              </span>
              <BadgeRow row={row} />
            </button>
            {expanded ? (
              <div className="border-t border-border px-3 py-3">
                <AgentDetail row={row} id={panelId(row.agent_id, "card")} />
              </div>
            ) : null}
          </motion.div>
        );
      })}
      <p className="px-1 text-xs text-muted-foreground">{FORMULA_CAPTION}</p>
    </section>
  );
}

export function LeaderboardTable({
  rows,
  isLoading,
  error,
  onRetry,
}: LeaderboardTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const reduceMotion = useReducedMotion();
  const confettiFiredRef = useRef(false);

  function toggleExpand(agentId: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }

  // Restrained celebration: once per browser session, only on the first
  // successful load whose top score is above zero — never on period change,
  // never under reduced motion (checked before the dynamic import, not after).
  useEffect(() => {
    if (reduceMotion) return;
    if (confettiFiredRef.current) return;
    if (isLoading || rows.length === 0) return;
    if ((rows[0]?.score ?? 0) <= 0) return;
    try {
      if (sessionStorage.getItem("tm-leaderboard-confetti") !== null) {
        confettiFiredRef.current = true;
        return;
      }
    } catch {
      confettiFiredRef.current = true;
      return;
    }
    confettiFiredRef.current = true;
    let cancelled = false;
    void import("canvas-confetti").then((mod) => {
      if (cancelled) return;
      mod.default({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.25 },
        disableForReducedMotion: true,
      });
      try {
        sessionStorage.setItem("tm-leaderboard-confetti", "1");
      } catch {
        // Storage unavailable — the in-memory ref still prevents repeats.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rows, isLoading, reduceMotion]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="grid gap-3" role="status" aria-label="Loading leaderboard">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="order-2 h-36 w-full sm:order-1" />
          <Skeleton className="order-1 h-44 w-full sm:order-2" />
          <Skeleton className="order-3 h-36 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
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
          <EmptyTitle>No agent activity in this period</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const maxScore = Math.max(...rows.map((row) => row.score), 1);
  // Competition ranking (1, 1, 3): equal scores share a rank so the board never
  // implies a difference the data does not contain. Ordering stays the
  // service's; this only collapses equals into one display rank.
  let displayRank = 0;
  const ranked = rows.map((row, index) => {
    if (index === 0 || row.score !== rows[index - 1].score) displayRank = index + 1;
    return {
      ...row,
      rank: displayRank,
      rank_delta:
        row.previous_rank === null ? 0 : row.previous_rank - displayRank,
    };
  });
  // Slice by position, never by rank value: a tie on the podium (1, 1, 3) would
  // otherwise drop the second and third agents from the page entirely.
  const rest = ranked.slice(3);

  return (
    <div className="min-w-0" aria-busy={isLoading}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="min-w-0 p-4">
          <Podium
            rows={ranked}
            maxScore={maxScore}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
          />
        </div>
        {rest.length > 0 ? (
          <div className="min-w-0 border-t border-border p-2 sm:p-3">
            <RankedTable
              rows={rest}
              maxScore={maxScore}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
            <RankedCards
              rows={rest}
              maxScore={maxScore}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
          </div>
        ) : (
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {FORMULA_CAPTION}
          </p>
        )}
      </div>
    </div>
  );
}
