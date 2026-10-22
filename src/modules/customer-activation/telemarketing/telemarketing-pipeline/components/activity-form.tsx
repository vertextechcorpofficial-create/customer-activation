"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_KINDS, ACTIVITY_OUTCOMES, type ActivityCreate } from "../types/pipeline.schema";
import type { ActivityDraft } from "../hooks/use-activities";

/** `datetime-local` value for "right now" in Philippine time. */
function phNowInput(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
    .replace(" ", "T")
    .slice(0, 16);
}

/** `datetime-local` value → the module's `YYYY-MM-DD HH:mm:ss` Philippine stamp. */
function phTimestamp(local: string): string {
  return new Date(`${local}:00+08:00`).toLocaleString("sv-SE", {
    timeZone: "Asia/Manila",
  });
}

export function ActivityForm({
  onSubmit,
  isPending = false,
}: {
  onSubmit: (draft: ActivityDraft) => Promise<boolean>;
  isPending?: boolean;
}) {
  const [kind, setKind] = useState<ActivityCreate["kind"]>("call");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [occurredAt, setOccurredAt] = useState(phNowInput);

  const needsOutcome = kind !== "note" && !outcome;

  function handleKindChange(value: string) {
    setKind(value as ActivityCreate["kind"]);
    if (value === "note") setOutcome("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsOutcome) return;

    const ok = await onSubmit({
      kind,
      outcome: kind === "note" ? null : (outcome as ActivityCreate["outcome"]),
      notes: notes.trim() || null,
      duration_minutes: duration ? Number(duration) : null,
      occurred_at: occurredAt ? phTimestamp(occurredAt) : undefined,
    });

    if (ok) {
      setNotes("");
      setDuration("");
      setOccurredAt(phNowInput());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={kind === "note" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
          <Label htmlFor="activity-kind">
            Type <span className="text-destructive">*</span>
          </Label>
          <Select value={kind} onValueChange={handleKindChange}>
            <SelectTrigger id="activity-kind" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {ACTIVITY_KINDS.map((option) => (
                <SelectItem key={option} value={option} className="capitalize">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind !== "note" ? (
          <div className="space-y-2">
            <Label htmlFor="activity-outcome">
              Outcome <span className="text-destructive">*</span>
            </Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="activity-outcome" className="w-full">
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {ACTIVITY_OUTCOMES.map((option) => (
                  <SelectItem key={option} value={option} className="capitalize">
                    {option.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Required for every type except note.</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-notes">Notes</Label>
        <Textarea
          id="activity-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened?"
          className="resize-none min-h-[100px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="activity-duration">Duration (minutes)</Label>
          <Input
            id="activity-duration"
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-occurred-at">Occurred at</Label>
          <Input
            id="activity-occurred-at"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending || needsOutcome}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isPending ? "Logging..." : "Log activity"}
      </Button>
    </form>
  );
}
