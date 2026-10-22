"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Users } from "lucide-react";
import { cn, formatDateTime as formatSharedDateTime } from "@/lib/utils";
import type { LeaderboardRow } from "../types/leaderboard.schema";

const CHANNELS = [
  { key: "call", label: "Calls", Icon: Phone, bar: "bg-primary" },
  { key: "email", label: "Emails", Icon: Mail, bar: "bg-info" },
  { key: "visit", label: "Visits", Icon: MapPin, bar: "bg-success" },
  { key: "meeting", label: "Meetings", Icon: Users, bar: "bg-warning" },
] as const;

/**
 * The stored value is Philippine wall-clock ("YYYY-MM-DD HH:mm:ss"), so it is
 * read as +08:00 before formatting via the shared formatter — one human
 * format everywhere, never raw ISO.
 */
function formatLastActivity(value: string | null): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const date = new Date(hasZone ? iso : `${iso}+08:00`);
  return Number.isNaN(date.getTime()) ? "—" : formatSharedDateTime(date);
}

/**
 * Shared inline detail panel — used by podium cards and ranked-list rows
 * alike. Breakdown bars are proportional to the agent's own activity total
 * (channel mix), stats are the three score inputs, and the only navigation
 * affordance is the "View history" link (rows themselves never navigate).
 */
export function AgentDetail({ row, id }: { row: LeaderboardRow; id: string }) {
  const total = Math.max(row.activities, 1);
  return (
    <div id={id} className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-1.5">
        {CHANNELS.map(({ key, label, Icon, bar }) => {
          const value = row.breakdown[key];
          const pct = Math.round((value / total) * 100);
          return (
            <div key={key} className="flex min-w-0 items-center gap-2">
              <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
              </span>
              <span
                className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${label}: ${value} of ${row.activities} activities`}
              >
                <motion.span
                  className={cn("block h-full rounded-full", bar)}
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">
                {value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Conversions", value: row.conversions },
          { label: "Qualified", value: row.qualified },
          { label: "Activities", value: row.activities },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="min-w-0 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center"
          >
            <p className="text-base font-semibold tabular-nums">{value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          Last active{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatLastActivity(row.last_activity_at)}
          </span>
        </p>
        <Link
          href={`/customer-activation/telemarketing/telemarketing-agent-report/${row.agent_id}`}
          aria-label={`View history for ${row.display_name}`}
          className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View history →
        </Link>
      </div>
    </div>
  );
}
