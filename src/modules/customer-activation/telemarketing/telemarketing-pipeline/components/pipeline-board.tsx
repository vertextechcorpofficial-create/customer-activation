"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CalendarClock,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { moveLeadStage } from "../providers/stage-provider";
import { useBoard } from "../hooks/use-board";
import type { LeadView, Stage } from "../types/pipeline.schema";
import type { BoardLead } from "../services/board-service";

/** Cards shown per column; the rest are reachable from the leads table. */
const TOP_N = 4;

const VALIDATION_TONE: Record<LeadView["validation_status"], StatusTone> = {
  new: "neutral",
  for_validation: "info",
  validated: "success",
  duplicate: "warning",
  invalid: "destructive",
  rejected: "destructive",
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[+-]\d{2}:\d{2}$|Z$/.test(iso) ? iso : `${iso}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—";
}

function formatRelative(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "Never";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatDay(value);
}

function MoveMenu({
  lead,
  stages,
  disabled,
  onSelect,
}: {
  lead: LeadView;
  stages: Stage[];
  disabled?: boolean;
  onSelect: (stage: Stage) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="min-h-11 md:min-h-0 h-8 px-2 text-xs">
          <ArrowRightLeft className="size-3.5" aria-hidden />
          Move
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuRadioGroup
          value={String(lead.stage_id)}
          onValueChange={(value) => {
            const target = stages.find((s) => s.stage_id === Number(value));
            if (target) onSelect(target);
          }}
        >
          {stages.map((stage) => (
            <DropdownMenuRadioItem
              key={stage.stage_id}
              value={String(stage.stage_id)}
              className="min-h-11 md:min-h-0"
            >
              {stage.stage_name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LeadCard({
  lead,
  stages,
  onMoved,
}: {
  lead: BoardLead;
  stages: Stage[];
  onMoved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [lostTarget, setLostTarget] = useState<Stage | null>(null);
  const [reason, setReason] = useState("");

  const requestMove = (target: Stage) => {
    if (target.stage_id === lead.stage_id) return;
    if (Number(target.is_lost) === 1) {
      setLostTarget(target);
      setReason("");
      return;
    }
    setPending(true);
    moveLeadStage(lead.lead_id, target.stage_id)
      .then(() => {
        toast.success("Stage updated");
        onMoved();
      })
      .catch((err: unknown) => {
        toast.error("Failed to move the lead", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      })
      .finally(() => setPending(false));
  };

  const confirmLost = () => {
    if (!lostTarget || !reason.trim()) return;
    setPending(true);
    moveLeadStage(lead.lead_id, lostTarget.stage_id, reason.trim())
      .then(() => {
        toast.success("Stage updated");
        onMoved();
      })
      .catch((err: unknown) => {
        toast.error("Failed to move the lead", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      })
      .finally(() => {
        setPending(false);
        setLostTarget(null);
      });
  };

  return (
    <article className="rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
          className="min-w-0 text-sm font-medium leading-snug hover:underline"
        >
          <span className="block truncate" title={lead.company_name}>
            {lead.company_name}
          </span>
        </Link>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{lead.lead_code}</span>
      </div>

      <p className="mt-1 truncate text-xs text-muted-foreground">
        {lead.contact_name || "No contact"} · {lead.mobile || lead.email || "No number"}
      </p>

      <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">Claimants</dt>
          <dd className="tabular-nums">{lead.claimant_count}</dd>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">Last activity</dt>
          <dd>{formatRelative(lead.last_activity_at)}</dd>
        </div>
        <div className="flex items-center gap-1">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          <dt className="sr-only">Next follow-up</dt>
          <dd>{lead.next_follow_up_at ? formatDay(lead.next_follow_up_at) : "No follow-up"}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {lead.product_interest ? (
            <span
              className="max-w-28 truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              title={lead.product_interest}
            >
              {lead.product_interest}
            </span>
          ) : null}
          {lead.validation_status !== "new" ? (
            <StatusBadge tone={VALIDATION_TONE[lead.validation_status]} className="capitalize">
              {lead.validation_status.replace(/_/g, " ")}
            </StatusBadge>
          ) : null}
        </div>
        <MoveMenu lead={lead} stages={stages} disabled={pending} onSelect={requestMove} />
      </div>

      <Dialog
        open={lostTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLostTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Move to {lostTarget?.stage_name}</DialogTitle>
            <DialogDescription>A lost stage closes the lead. Record why it was lost.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`lost-reason-${lead.lead_id}`}>Lost reason</Label>
            <Textarea
              id={`lost-reason-${lead.lead_id}`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Wrong number"
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!reason.trim() || pending} onClick={confirmLost}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Move lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function StageColumn({
  stage,
  stages,
  leads,
  total,
  onMoved,
}: {
  stage: Stage;
  stages: Stage[];
  leads: BoardLead[];
  total: number;
  onMoved: () => void;
}) {
  const visible = leads.slice(0, TOP_N);
  const hidden = Math.max(total - visible.length, 0);

  return (
    <section className="flex min-h-[420px] w-64 shrink-0 snap-start flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold" title={stage.stage_name}>
          {stage.stage_name}
        </h2>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {total > visible.length ? `${visible.length} of ${total}` : total}
        </span>
      </header>

      {total === 0 ? (
        <p className="px-1 py-8 text-center text-xs text-muted-foreground">No leads in this stage.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((lead) => (
            <li key={lead.lead_id}>
              <LeadCard lead={lead} stages={stages} onMoved={onMoved} />
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <Button asChild variant="ghost" size="sm" className="min-h-11 md:min-h-0 w-full text-xs">
          <Link href={`/customer-activation/telemarketing/telemarketing-pipeline/leads?stage=${stage.stage_id}`}>
            View all {total} leads
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

export function PipelineBoard() {
  const { columns, isLoading, error, refresh } = useBoard();
  const stages = columns.map((column) => column.stage);

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2" aria-live="polite">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="w-72 shrink-0 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error && columns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            void refresh();
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>No active stages</EmptyTitle>
          <EmptyDescription>The board follows the stage list. Activate a stage to see it as a column.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Pipeline board</h1>
          <p className="text-sm text-muted-foreground">
            {columns.length} active {columns.length === 1 ? "stage" : "stages"}. Move a lead to hand it to the
            next step.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-h-11 md:min-h-0">
            <Link href="/customer-activation/telemarketing/telemarketing-pipeline/pool">
              <Users className="size-4" aria-hidden />
              Pool
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 md:min-h-0">
            <Link href="/customer-activation/telemarketing/telemarketing-pipeline/settings">
              <Settings className="size-4" aria-hidden />
              Settings
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 md:min-h-0">
            <Link href="/customer-activation/telemarketing/telemarketing-pipeline/leads">All leads</Link>
          </Button>
        </div>
      </div>

      <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-3">
        {columns.map((column) => (
          <StageColumn
            key={column.stage.stage_id}
            stage={column.stage}
            stages={stages}
            leads={column.leads}
            total={column.total}
            onMoved={() => void refresh()}
          />
        ))}
      </div>
    </div>
  );
}
