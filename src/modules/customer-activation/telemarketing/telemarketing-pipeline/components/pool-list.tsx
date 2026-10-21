"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePool } from "../hooks/use-pool";
import { useStages } from "../hooks/use-stages";
import type { Stage } from "../types/pipeline.schema";

const PAGE_SIZE = 10;

function stageTone(stage: Stage | undefined): StatusTone {
  if (!stage) return "neutral";
  if (Number(stage.is_won) === 1) return "success";
  if (Number(stage.is_lost) === 1) return "destructive";
  return "info";
}

/** Unclaimed, non-terminal leads — claim one to start working it. */
export function PoolList() {
  const [page, setPage] = useState(1);
  const { stages } = useStages();
  const { items, meta, isLoading, error, refresh, claim, release } = usePool(page, PAGE_SIZE);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.stage_id, stage])), [stages]);

  const pageCount = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const from = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, meta.total);

  const handleToggle = async (leadId: number, claimed: boolean) => {
    setPendingId(leadId);
    try {
      await (claimed ? release(leadId) : claim(leadId));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Lead pool</h1>
        <p className="text-sm text-muted-foreground">
          {meta.total} {meta.total === 1 ? "lead" : "leads"} waiting to be worked.
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden />
            Retry
          </Button>
        </div>
      ) : isLoading && items.length === 0 ? (
        <div className="space-y-2" aria-live="polite">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No leads in the pool</EmptyTitle>
            <EmptyDescription>
              Every lead here is in a non-terminal stage. A lead leaves the pool only when it reaches a
              terminal (won or lost) stage.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="max-w-56">Company</TableHead>
                <TableHead className="max-w-48">Contact</TableHead>
                <TableHead className="w-36">Stage</TableHead>
                <TableHead className="w-32">Claimants</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => {
                const stage = stageById.get(lead.stage_id);
                const pending = pendingId === lead.lead_id;
                return (
                  <TableRow key={lead.lead_id}>
                    <TableCell className="font-mono text-xs tabular-nums">{lead.lead_code}</TableCell>
                    <TableCell className="max-w-56">
                      <Link
                        href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
                        className="block truncate font-medium hover:underline"
                        title={lead.company_name}
                      >
                        {lead.company_name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48">
                      <span className="block truncate" title={lead.contact_name ?? undefined}>
                        {lead.contact_name || "—"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {lead.mobile || lead.email || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={stageTone(stage)}>{stage?.stage_name ?? "Unknown stage"}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{lead.claimant_count}</span>
                      {lead.claimed_by_me && (
                        <StatusBadge tone="info" className="ml-2">
                          you
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={lead.claimed_by_me ? "outline" : "default"}
                        size="sm"
                        className="min-h-11 md:min-h-0"
                        disabled={pending || isLoading}
                        onClick={() => void handleToggle(lead.lead_id, lead.claimed_by_me)}
                      >
                        {pending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : lead.claimed_by_me ? (
                          <UserMinus className="size-4" aria-hidden />
                        ) : (
                          <UserPlus className="size-4" aria-hidden />
                        )}
                        {lead.claimed_by_me ? "Release" : "Claim"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {from}–{to} of {meta.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-0"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-0"
                disabled={page >= pageCount || isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
