"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/** One lead: contact snapshot, source, tags, stage control, activity and claims. */
export function LeadDetailView({ leadId }: { leadId: number }) {
  const { lead, tags, isLoading, error, refresh } = useLeadRecord(leadId);
  const { stages, isLoading: stagesLoading } = useStages();
  const { activities, isLoading: activitiesLoading, isCreating, log } = useActivities(leadId);
  const [pendingLost, setPendingLost] = useState<Stage | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  const currentStage = useMemo(
    () => stages.find((stage) => stage.stage_id === lead?.stage_id),
    [stages, lead?.stage_id],
  );

  if (isLoading) {
    return (
      <div className="space-y-4" aria-live="polite">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArrowLeft />
          </EmptyMedia>
          <EmptyTitle>Lead not available</EmptyTitle>
          <EmptyDescription>
            {error ?? "This lead no longer exists, or the id is not a lead id."}
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

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-0 -ml-2"
            >
              <Link href="/customer-activation/telemarketing/telemarketing-pipeline/leads">
                <ArrowLeft className="size-4" aria-hidden />
                All leads
              </Link>
            </Button>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight">
              {lead.company_name}
            </h1>
            <p className="text-sm capitalize text-muted-foreground">
              {lead.lead_code} · {lead.source.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Lead tags">
            {tags.map((tag) => (
              <li key={tag.tag_id}>
                <StatusPill tone="neutral">
                  {tag.color ? (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden
                    />
                  ) : null}
                  {tag.tag_name}
                </StatusPill>
              </li>
            ))}
          </ul>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Stage</CardTitle>
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
                Now in{" "}
                {currentStage ? (
                  <StatusPill tone={stageTone(currentStage)}>{currentStage.stage_name}</StatusPill>
                ) : (
                  "an unknown stage"
                )}
                .
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

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              Calls, emails and visits logged against this lead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log activity</CardTitle>
            <CardDescription>Every entry is stamped with your agent and time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityForm onSubmit={log} isPending={isCreating} />
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        <ClaimPanel leadId={lead.lead_id} />
      </div>
    </div>
  );
}
