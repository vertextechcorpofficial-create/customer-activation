"use client";

import type { KeyboardEvent, ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "../types/leaderboard.schema";

interface BreakdownLine {
  label: string;
  count: number;
  weight: number;
}

/**
 * Explainable score: the trigger renders the bare score number unchanged
 * (same size/weight/colour, plus a dotted underline affordance) and the
 * popover shows the per-agent arithmetic. The total must equal `row.score`
 * because the service computes `conversions × 3 + qualified × 2 +
 * activities × 1`.
 */
export function ScoreExplainer({
  row,
  triggerClassName,
  children,
  nested = false,
}: {
  row: LeaderboardRow;
  triggerClassName?: string;
  children: ReactNode;
  /**
   * True when the trigger lives inside another button (the mobile cards
   * render each row as one large button). A real <button> cannot nest
   * there, so the trigger is a focusable span with the same keyboard
   * behaviour instead.
   */
  nested?: boolean;
}) {
  const lines: BreakdownLine[] = [
    { label: "Conversions", count: row.conversions, weight: 3 },
    { label: "Qualified", count: row.qualified, weight: 2 },
    { label: "Activities", count: row.activities, weight: 1 },
  ];
  const label = `Score ${row.score} for ${row.display_name}: show breakdown`;

  function stopBubble(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  function onSpanKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    // Keep the outer card button from toggling details; the follow-up
    // click (handled by the Radix trigger) opens the popover instead.
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.click();
  }

  return (
    <Popover>
      <PopoverTrigger
        asChild
        aria-label={label}
        onClick={nested ? stopBubble : undefined}
      >
        {nested ? (
          <span
            role="button"
            tabIndex={0}
            data-no-row-click
            onKeyDown={onSpanKeyDown}
            className={cn(
              "cursor-pointer underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2",
              triggerClassName,
            )}
          >
            {children}
          </span>
        ) : (
          <button
            type="button"
            data-no-row-click
            onClick={stopBubble}
            className={cn(
              "cursor-pointer underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2",
              triggerClassName,
            )}
          >
            {children}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-2rem)] tabular-nums"
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          How {row.display_name}&rsquo;s score is built
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 text-sm">
          {lines.map(({ label: lineLabel, count, weight }) => (
            <span key={lineLabel} className="contents">
              <span className="min-w-0">
                {lineLabel}{" "}
                <span className="text-muted-foreground">
                  {count} × {weight}
                </span>
              </span>
              <span className="text-right font-medium">
                {count * weight}
              </span>
            </span>
          ))}
          <span className="contents border-t border-border">
            <span className="border-t border-border pt-1.5 font-semibold">
              Total
            </span>
            <span className="border-t border-border pt-1.5 text-right font-semibold">
              {row.score}
            </span>
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Activities count calls, emails, visits and meetings. Notes are not
          counted.
        </p>
      </PopoverContent>
    </Popover>
  );
}
