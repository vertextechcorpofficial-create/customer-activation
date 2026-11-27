"use client";

import { Fragment } from "react";
import type { Activity } from "../types/pipeline.schema";
import { StatusPill, type Tone } from "./status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import {
  Mail,
  MapPin,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

const KIND_ICON: Record<Activity["kind"], LucideIcon> = {
  call: Phone,
  email: Mail,
  visit: MapPin,
  meeting: Users,
  note: StickyNote,
};

const OUTCOME_TONE: Record<string, Tone> = {
  connected: "success",
  interested: "success",
  callback: "info",
  no_answer: "warning",
  wrong_number: "destructive",
  not_interested: "neutral",
};

/**
 * The stored value is Philippine wall-clock ("YYYY-MM-DD HH:mm:ss"), so it is
 * read as +08:00 before formatting — a browser in another zone then shows the
 * same instant in its own time instead of a shifted one.
 */
function occurredAtLabel(value: string): string {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const date = new Date(hasZone ? iso : `${iso}+08:00`);
  return Number.isNaN(date.getTime()) ? value : formatDateTime(date);
}

export function ActivityTimeline({
  activities,
  isLoading,
}: {
  activities: Activity[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!activities.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  const days = new Map<string, Activity[]>();
  for (const activity of activities) {
    const key = activity.occurred_at.length >= 10 ? activity.occurred_at.slice(0, 10) : activity.occurred_at;
    const list = days.get(key);
    if (list) list.push(activity);
    else days.set(key, [activity]);
  }

  return (
    <ol
      aria-label="Activity timeline"
      className="space-y-4 border-l border-border pl-8 lg:max-h-[62dvh] lg:overflow-y-auto lg:pr-2"
    >
      {[...days].map(([day, items]) => (
        <Fragment key={day}>
          <li className="sticky top-0 z-10 -ml-8 list-none bg-card/95 py-1 backdrop-blur">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{day}</span>
          </li>
          {items.map((activity) => {
        const Icon = KIND_ICON[activity.kind];
        const tone = OUTCOME_TONE[activity.outcome ?? ""] ?? "neutral";
        return (
          <li key={activity.activity_id} className="relative">
            <span
              className={cn(
                "absolute -left-12 top-0 flex size-8 items-center justify-center rounded-full border bg-muted text-muted-foreground",
                activity.outcome ? "border-border" : "border-dashed border-border",
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium capitalize">{activity.kind}</span>
              {activity.outcome ? (
                <StatusPill tone={tone} className="capitalize">
                  {activity.outcome.replace(/_/g, " ")}
                </StatusPill>
              ) : null}
            </div>

            {activity.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{activity.notes}</p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {activity.duration_minutes != null ? (
                <span className="tabular-nums">{activity.duration_minutes} min</span>
              ) : null}
              <span>{occurredAtLabel(activity.occurred_at)}</span>
            </div>
          </li>
        );
        })}
        </Fragment>
      ))}
    </ol>
  );
}
