"use client";

import { useState } from "react";
import { Loader2, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { useClaims } from "../hooks/use-claims";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Timestamps are stored as Philippine time — read them back as such. */
function formatClaimedAt(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Who is working this lead — claim or release it for the signed-in agent. */
export function ClaimPanel({ leadId }: { leadId: number }) {
  const { agentId, claimants, isLoading, error, refresh, claim, release } = useClaims(leadId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mine = agentId !== null && claimants.some((c) => c.agent_id === agentId);

  const handleToggle = async () => {
    setIsSubmitting(true);
    try {
      await (mine ? release() : claim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-semibold leading-none">
            Claim
            <StatusPill tone="neutral" className="rounded-full tabular-nums">
              {claimants.length}
            </StatusPill>
          </h2>
          <CardDescription>
            Several agents can work the same lead. Claiming never takes it out of the pool — only a
            terminal stage does.
          </CardDescription>
        </div>
        <Button
          variant={mine ? "outline" : "default"}
          disabled={isLoading || isSubmitting}
          onClick={handleToggle}
          className="min-h-11 md:min-h-0"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : mine ? (
            <UserMinus className="size-4" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          {mine ? "Release" : "Claim"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-live="polite">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="size-4" aria-hidden />
              Retry
            </Button>
          </div>
        ) : claimants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Unclaimed — claim to start work.</p>
        ) : (
          <ul className="divide-y divide-border">
            {claimants.map((claimant) => {
              const isYou = claimant.agent_id === agentId;
              return (
                <li key={claimant.agent_id} className="flex min-w-0 items-center gap-3 py-2">
                  <Avatar size="sm">
                    <AvatarFallback className="text-xs font-semibold">
                      {initials(claimant.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm" title={claimant.display_name}>
                    {claimant.display_name}
                  </span>
                  {isYou && <StatusPill tone="info">you</StatusPill>}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatClaimedAt(claimant.claimed_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
