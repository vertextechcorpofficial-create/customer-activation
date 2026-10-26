"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { stageTone } from "../lib/stage-tone";
import { Textarea } from "@/components/ui/textarea";
import { ActivityForm } from "./activity-form";
import { ActivityTimeline } from "./activity-timeline";
import { ClaimPanel } from "./claim-panel";
import { useActivities } from "../hooks/use-activities";
import { useClaims } from "../hooks/use-claims";
import { useLeadRecord } from "../hooks/use-lead-record";
import { useStages } from "../hooks/use-stages";
import { moveLeadStage } from "../providers/stage-provider";
import type { Stage } from "../types/pipeline.schema";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  );
}

/** Searchable stage picker backed by the `telemarketing_stage` table. */
function StageCombobox({
  value,
  onValueChange,
  stages,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  stages: Stage[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = query
    ? stages.filter(
        (stage) =>
          stage.stage_name.toLowerCase().includes(query) ||
          stage.stage_code.toLowerCase().includes(query),
      )
    : stages;
  const selected = stages.find((stage) => String(stage.stage_id) === value);
  const label = selected?.stage_name ?? "Select a stage";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="lead-stage"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 w-full justify-between font-normal md:h-9"
        >
          <span className="min-w-0 flex-1 truncate text-left" title={label}>
            {label}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search stages…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-60">
            <CommandEmpty>No stages found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((stage) => (
                <CommandItem
                  key={stage.stage_id}
                  value={String(stage.stage_id)}
                  title={stage.stage_name}
                  onSelect={() => {
                    onValueChange(String(stage.stage_id));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={
                      value === String(stage.stage_id)
                        ? "size-4 shrink-0 opacity-100"
                        : "size-4 shrink-0 opacity-0"
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{stage.stage_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** One lead: hero, metric band, activity, claim, stage and contact. */
export function LeadDetailView({ leadId }: { leadId: number }) {
  const { lead, tags, isLoading, error, refresh } = useLeadRecord(leadId);
  const { stages, isLoading: stagesLoading } = useStages();
  const {
    activities,
    isLoading: activitiesLoading,
    isCreating,
    error: activitiesError,
    refresh: refreshActivities,
    log,
  } = useActivities(leadId);
  const { agentId, claimants } = useClaims(leadId);
  const [pendingLost, setPendingLost] = useState<Stage | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  const currentStage = useMemo(
    () => stages.find((stage) => stage.stage_id === lead?.stage_id),
    [stages, lead?.stage_id],
  );

  // The route metadata is the generic "Lead"; name the record once it loads.
  useEffect(() => {
    if (lead) document.title = `${lead.company_name} (${lead.lead_code})`;
  }, [lead]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-4" aria-label="Loading lead">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-72 w-full lg:col-span-2" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Could not load the lead.</p>
          <p className="text-sm text-muted-foreground" role="alert">
            {error}
          </p>
          <div>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              <RefreshCw className="size-4" aria-hidden />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArrowLeft />
          </EmptyMedia>
          <EmptyTitle>Lead not available</EmptyTitle>
          <EmptyDescription>
            This lead no longer exists, or the id is not a lead id.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const move = async (stageId: number, lost_reason?: string) => {
    setIsMoving(true);
    try {
      await moveLeadStage(lead.lead_id, stageId, lost_reason);
      toast.success("Stage updated");
      await refresh();
    } catch (err) {
      toast.error("Failed to move the lead", {
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleStageChange = (value: string) => {
    const target = stages.find((stage) => stage.stage_id === Number(value));
    if (!target || target.stage_id === lead.stage_id) return;
    if (Number(target.is_lost) === 1) {
      setPendingLost(target);
      setLostReason("");
      return;
    }
    void move(target.stage_id);
  };

  const confirmLost = async () => {
    if (!pendingLost || !lostReason.trim()) return;
    await move(pendingLost.stage_id, lostReason.trim());
    setPendingLost(null);
    setLostReason("");
  };

  const activeClaimants = claimants.length;
  const claimedByMe =
    agentId !== null && claimants.some((claimant) => claimant.agent_id === agentId);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-11 md:min-h-0">
        <Link href="/customer-activation/telemarketing/telemarketing-pipeline/pool">
          <ArrowLeft className="size-4" aria-hidden />
          Back to pool
        </Link>
      </Button>

      <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Lead record (read-only)
        </p>
        <h1
          className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight break-words sm:text-2xl"
          title={lead.company_name}
        >
          {lead.company_name}
        </h1>
        <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
          {lead.lead_code} · {lead.source.replace(/_/g, " ")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {claimedByMe ? (
            <StatusPill tone="info">Claimed by you</StatusPill>
          ) : activeClaimants > 0 ? (
            <StatusPill tone="neutral">
              {activeClaimants} active claimant{activeClaimants === 1 ? "" : "s"}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">Unclaimed</StatusPill>
          )}
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag.tag_id}
              role="img"
              aria-label={tag.tag_name}
              title={tag.tag_name}
              className="size-2.5 rounded-full border border-border"
              style={{ backgroundColor: tag.color ?? "transparent" }}
            />
          ))}
          {tags.length > 3 ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              +{tags.length - 3}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="border-border/70 bg-card shadow-none">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Activities logged
            </p>
            <p className="text-2xl font-semibold tabular-nums">{activities.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card shadow-none">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Active claimants
            </p>
            <p className="text-2xl font-semibold tabular-nums">{activeClaimants}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-border/70 bg-card shadow-none sm:col-span-1">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Current stage
            </p>
            <p>
              {currentStage ? (
                <StatusPill tone={stageTone(currentStage)}>
                  {currentStage.stage_name}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">Unknown stage</StatusPill>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Card className="border-border/70 bg-card shadow-none lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold leading-none">Current activity</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {activitiesError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive" role="alert">
                  {activitiesError}
                </p>
                <Button size="sm" variant="outline" onClick={() => void refreshActivities()}>
                  <RefreshCw className="size-4" aria-hidden />
                  Retry
                </Button>
              </div>
            ) : (
              <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
            )}
            <div className="border-t border-border pt-4">
              <ActivityForm onSubmit={log} isPending={isCreating} />
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3">
          <ClaimPanel leadId={lead.lead_id} />

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader>
              <h2 className="font-semibold leading-none">Stage</h2>
              <CardDescription>
                A won or lost stage closes the lead and takes it out of the pool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-stage">Current stage</Label>
                <StageCombobox
                  value={String(lead.stage_id)}
                  stages={stages}
                  disabled={stagesLoading || isMoving}
                  onValueChange={handleStageChange}
                />
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Now in </span>
                  {currentStage ? (
                    <StatusPill tone={stageTone(currentStage)}>
                      {currentStage.stage_name}
                    </StatusPill>
                  ) : (
                    "an unknown stage"
                  )}
                </p>
              </div>

              {pendingLost ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label htmlFor="lead-lost-reason">Lost reason</Label>
                  <Textarea
                    id="lead-lost-reason"
                    rows={3}
                    value={lostReason}
                    onChange={(event) => setLostReason(event.target.value)}
                    placeholder="Why was this lead lost?"
                    className="resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="min-h-11 md:min-h-0"
                      disabled={!lostReason.trim() || isMoving}
                      onClick={() => void confirmLost()}
                    >
                      Move to {pendingLost.stage_name}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 md:min-h-0"
                      onClick={() => setPendingLost(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {lead.lost_reason ? (
                <p className="text-sm text-muted-foreground">
                  Lost reason: {lead.lost_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card shadow-none">
            <CardHeader>
              <h2 className="font-semibold leading-none">Contact</h2>
              <CardDescription>The details captured when the lead was created.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Company" value={lead.company_name} />
                <Field label="Contact" value={lead.contact_name} />
                <Field label="Position" value={lead.contact_position} />
                <Field label="Mobile" value={lead.mobile} />
                <Field label="Email" value={lead.email} />
                <Field label="Address" value={lead.address} />
                <Field label="Industry" value={lead.industry} />
                <Field label="Product interest" value={lead.product_interest} />
                <Field label="Need" value={lead.need} />
                <Field label="Referral code" value={lead.referral_code} />
                <Field label="Campaign code" value={lead.campaign_code} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
