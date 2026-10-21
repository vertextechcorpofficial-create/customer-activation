"use client";

import { useState } from "react";
import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const { agentId, claimants, isLoading, error, claim, release } = useClaims(leadId);
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Claimants
            <StatusBadge tone="info">{claimants.length}</StatusBadge>
          </CardTitle>
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
          <p className="py-6 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : claimants.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No one has claimed this lead</EmptyTitle>
              <EmptyDescription>Claim it to start working it. Other agents can join you later.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={handleToggle} disabled={isSubmitting} className="min-h-11 md:min-h-0">
                <UserPlus className="size-4" aria-hidden />
                Claim this lead
              </Button>
            </EmptyContent>
          </Empty>
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
                  {isYou && <StatusBadge tone="info">you</StatusBadge>}
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
