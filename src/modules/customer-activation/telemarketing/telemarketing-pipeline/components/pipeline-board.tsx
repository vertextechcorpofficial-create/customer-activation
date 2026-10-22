"use client";

import { useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  CalendarClock,
  Clock,
  GripVertical,
  Inbox,
  Layers,
  Loader2,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import { StatusPill } from "./status-pill";
import { stageAccentClass, stageTone } from "../lib/stage-tone";
import { Textarea } from "@/components/ui/textarea";
import { moveLeadStage } from "../providers/stage-provider";
import { useBoard } from "../hooks/use-board";
import type { LeadView, Stage } from "../types/pipeline.schema";
import type { BoardLead } from "../services/board-service";

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

/**
 * Multi-container collision chain: pointer containment is the honest answer
 * when it exists (a drop in a visual gap still belongs to the column under
 * the pointer); rect intersection covers keyboard/no-pointer cases; and
 * closestCorners runs only when neither resolves. Bare closestCorners lets a
 * drop near a column edge resolve to the neighbour column's card — column
 * rects fully contain their cards' rects — moving the lead to the wrong stage.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCorners(args);
};

type MoveConversion = { error: string } | { customerId?: unknown } | null | unknown;

/** Success toast unless the won-stage conversion failed — then warn, keep the move, say how to retry. */
function notifyMoveResult(conversion: MoveConversion): void {
  if (conversion && typeof conversion === "object" && "error" in conversion) {
    const detail =
      typeof (conversion as { error: unknown }).error === "string" &&
      (conversion as { error: string }).error
        ? `(${(conversion as { error: string }).error}) `
        : "";
    toast.warning("Lead moved, but the customer was not created", {
      description: `The stage move succeeded ${detail}but customer creation failed. Move the lead out of the won stage and back in to retry.`,
    });
    return;
  }
  toast.success("Stage updated");
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
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="min-h-11 md:min-h-0 h-8 shrink-0 px-2 text-xs"
        >
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

/** Pure card visual — shared by the sortable card and the DragOverlay preview. */
function CardVisual({
  lead,
  stage,
  dragHandle,
  moveControl,
  className,
  navigable = true,
}: {
  lead: BoardLead;
  stage: Stage;
  dragHandle?: ReactNode;
  moveControl?: ReactNode;
  className?: string;
  navigable?: boolean;
}) {
  const contactLine = `${lead.contact_name || "No contact"} · ${lead.mobile || lead.email || "No number"}`;
  const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
  return (
    <article
      className={`group relative min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-md${className ? ` ${className}` : ""}`}
    >
      {navigable ? (
        <Link
          href={leadHref}
          aria-label={`Open lead ${lead.lead_code} ${lead.company_name}`}
          className="absolute inset-0 z-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ) : null}
      <div className="flex min-w-0 items-start gap-2">
        {dragHandle ? <span className="relative z-10 shrink-0">{dragHandle}</span> : null}
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug group-hover:underline">
          <span className="block truncate" title={lead.company_name}>
            {lead.company_name}
          </span>
        </span>
        <span
          className="max-w-24 shrink-0 truncate font-mono text-xs tabular-nums text-muted-foreground"
          title={lead.lead_code}
        >
          {lead.lead_code}
        </span>
      </div>

      <p className="mt-1 truncate text-xs text-muted-foreground" title={contactLine}>
        {contactLine}
      </p>

      <dl className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <StatusPill tone={stageTone(stage)} className="max-w-28 truncate" title={stage.stage_name}>
            {stage.stage_name}
          </StatusPill>
          {lead.product_interest ? (
            <span
              className="max-w-28 truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              title={lead.product_interest}
            >
              {lead.product_interest}
            </span>
          ) : null}
        </div>
        {moveControl ? <span className="relative z-10 shrink-0">{moveControl}</span> : null}
      </div>
    </article>
  );
}

function SortableCard({
  lead,
  stages,
  stage,
  locked,
  onMoved,
}: {
  lead: BoardLead;
  stages: Stage[];
  stage: Stage;
  locked: boolean;
  onMoved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [lostTarget, setLostTarget] = useState<Stage | null>(null);
  const [reason, setReason] = useState("");
  const disabled = pending || locked;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.lead_id,
    data: { stageId: stage.stage_id },
    disabled,
  });
  const style: HTMLAttributes<HTMLElement>["style"] = isDragging
    ? undefined
    : {
        transform: CSS.Transform.toString(transform) ?? undefined,
        transition: transition ?? undefined,
      };

  const requestMove = (target: Stage) => {
    if (target.stage_id === lead.stage_id) return;
    if (Number(target.is_lost) === 1) {
      setLostTarget(target);
      setReason("");
      return;
    }
    setPending(true);
    moveLeadStage(lead.lead_id, target.stage_id)
      .then((result) => {
        notifyMoveResult(result?.conversion);
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
      .then((result) => {
        notifyMoveResult(result?.conversion);
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
    <li ref={setNodeRef} style={style} className="min-w-0">
      <CardVisual
        lead={lead}
        stage={stage}
        className={isDragging ? "opacity-40" : undefined}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={`Drag ${lead.company_name} to another stage`}
            title="Drag to move to another stage"
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
        moveControl={<MoveMenu lead={lead} stages={stages} disabled={disabled} onSelect={requestMove} />}
      />

      <Dialog
        open={lostTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLostTarget(null);
        }}
      >
        <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to {lostTarget?.stage_name}</DialogTitle>
            <DialogDescription>A lost stage closes the lead. Record why it was lost.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`lost-reason-${lead.lead_id}`}>
              Lost reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`lost-reason-${lead.lead_id}`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Wrong number"
              className="resize-none"
            />
          </div>
          <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setLostTarget(null)}>
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={!reason.trim() || pending} onClick={confirmLost}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Move lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function StageColumn({
  stage,
  stages,
  leads,
  total,
  lockedIds,
  isOver,
  dropHint,
  onMoved,
}: {
  stage: Stage;
  stages: Stage[];
  leads: BoardLead[];
  total: number;
  lockedIds: number[];
  isOver: boolean;
  dropHint: boolean;
  onMoved: () => void;
}) {
  const tone = stageTone(stage);
  const { setNodeRef } = useDroppable({ id: `column-${stage.stage_id}`, data: { stageId: stage.stage_id } });

  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[calc(100vh-14rem)] min-h-96 w-64 shrink-0 snap-start flex-col gap-3 rounded-lg border border-border border-t-2 bg-muted/30 p-3${isOver ? " ring-2 ring-primary" : ""} ${stageAccentClass(tone)}`}
    >
      <header className="flex min-w-0 shrink-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold" title={stage.stage_name}>
          {stage.stage_name}
        </h2>
        <StatusPill tone={tone} className="shrink-0 rounded-full tabular-nums">
          {leads.length < total ? `${leads.length} of ${total}` : total}
        </StatusPill>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {total === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No leads in this stage.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : null}

        <ul className="min-w-0 space-y-2">
          <SortableContext
            items={leads.map((lead) => lead.lead_id)}
            strategy={verticalListSortingStrategy}
          >
            {leads.map((lead) => (
              <SortableCard
                key={lead.lead_id}
                lead={lead}
                stages={stages}
                stage={stage}
                locked={lockedIds.includes(lead.lead_id)}
                onMoved={onMoved}
              />
            ))}
          </SortableContext>
          {dropHint ? (
            <li aria-hidden="true">
              <div className="rounded-lg border border-dashed border-primary p-3 text-center text-xs text-muted-foreground">
                Drop to move here
              </div>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}

export function PipelineBoard() {
  const { columns, isLoading, error, refresh } = useBoard();
  const stages = columns.map((column) => column.stage);
  const [optimistic, setOptimistic] = useState<Record<number, number>>({});
  const [inFlight, setInFlight] = useState<number[]>([]);
  const [activeDrag, setActiveDrag] = useState<{ leadId: number; fromStageId: number } | null>(null);
  const [overStageId, setOverStageId] = useState<number | null>(null);
  const [lostDnd, setLostDnd] = useState<{ lead: BoardLead; target: Stage } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const viewColumns = useMemo(
    () =>
      columns.map((column) => {
        const staying = column.leads.filter(
          (lead) => optimistic[lead.lead_id] === undefined || optimistic[lead.lead_id] === column.stage.stage_id,
        );
        const incoming = columns
          .flatMap((other) => other.leads)
          .filter(
            (lead) =>
              optimistic[lead.lead_id] === column.stage.stage_id &&
              !column.leads.some((existing) => existing.lead_id === lead.lead_id),
          );
        return {
          stage: column.stage,
          leads: [...staying, ...incoming],
          total: column.total - (column.leads.length - staying.length) + incoming.length,
        };
      }),
    [columns, optimistic],
  );

  const clearOptimistic = (leadId: number) => {
    setOptimistic((prev) => {
      if (!(leadId in prev)) return prev;
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
  };

  const commitDropMove = (lead: BoardLead, target: Stage, reason?: string) => {
    if (inFlight.includes(lead.lead_id)) return;
    setOptimistic((prev) => ({ ...prev, [lead.lead_id]: target.stage_id }));
    setInFlight((prev) => [...prev, lead.lead_id]);
    moveLeadStage(lead.lead_id, target.stage_id, reason)
      .then((result) => {
        notifyMoveResult(result?.conversion);
        // Keep the optimistic entry until the server state lands — clearing
        // it synchronously here snaps the card back to its source column
        // for a frame before refresh() resolves.
        void refresh().finally(() => clearOptimistic(lead.lead_id));
      })
      .catch((err: unknown) => {
        clearOptimistic(lead.lead_id);
        toast.error("Failed to move the lead", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      })
      .finally(() => {
        setInFlight((prev) => prev.filter((id) => id !== lead.lead_id));
      });
  };

  const readStageId = (data: unknown): number | null => {
    if (!data || typeof data !== "object") return null;
    const stageId = (data as { stageId?: unknown }).stageId;
    return typeof stageId === "number" ? stageId : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag({ leadId: Number(event.active.id), fromStageId: readStageId(event.active.data.current) ?? -1 });
    setOverStageId(readStageId(event.active.data.current));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverStageId(readStageId(event.over?.data.current));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const targetStageId = readStageId(event.over?.data.current);
    const lead = columns.flatMap((column) => column.leads).find((item) => item.lead_id === Number(event.active.id));
    setActiveDrag(null);
    setOverStageId(null);
    if (!lead || targetStageId === null) return;
    const target = stages.find((stage) => stage.stage_id === targetStageId);
    // ponytail: the drop position inside a column is intentionally ignored — card order is
    // server-driven (updated_at); only the target column matters, so there is no intra-column reorder.
    if (!target || target.stage_id === lead.stage_id) return;
    if (Number(target.is_lost) === 1) {
      setLostDnd({ lead, target });
      setLostReason("");
      return;
    }
    commitDropMove(lead, target);
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    setOverStageId(null);
  };

  const confirmLostDnd = () => {
    const reason = lostReason.trim();
    if (!lostDnd || !reason) return;
    commitDropMove(lostDnd.lead, lostDnd.target, reason);
    setLostDnd(null);
    setLostReason("");
  };

  const activeLead = activeDrag
    ? columns.flatMap((column) => column.leads).find((lead) => lead.lead_id === activeDrag.leadId)
    : undefined;
  const activeStage = activeLead ? stages.find((stage) => stage.stage_id === activeLead.stage_id) : undefined;

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2" aria-live="polite">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="w-64 shrink-0 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
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

      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-3">
          {viewColumns.map((column) => (
            <StageColumn
              key={column.stage.stage_id}
              stage={column.stage}
              stages={stages}
              leads={column.leads}
              total={column.total}
              lockedIds={inFlight}
              isOver={activeDrag !== null && overStageId === column.stage.stage_id}
              dropHint={
                activeDrag !== null &&
                overStageId === column.stage.stage_id &&
                activeDrag.fromStageId !== column.stage.stage_id
              }
              onMoved={() => void refresh()}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && activeStage ? (
            <div className="w-64 scale-105 opacity-95 shadow-xl">
              <CardVisual lead={activeLead} stage={activeStage} navigable={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={lostDnd !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLostDnd(null);
            setLostReason("");
          }
        }}
      >
        <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move to {lostDnd?.target.stage_name}</DialogTitle>
            <DialogDescription>A lost stage closes the lead. Record why it was lost.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lost-reason-dnd">
              Lost reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="lost-reason-dnd"
              rows={3}
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              placeholder="e.g. Wrong number"
              className="resize-none"
            />
          </div>
          <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setLostDnd(null);
                  setLostReason("");
                }}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={!lostReason.trim() || (lostDnd ? inFlight.includes(lostDnd.lead.lead_id) : false)}
              onClick={confirmLostDnd}
            >
              {lostDnd && inFlight.includes(lostDnd.lead.lead_id) ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Move lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
