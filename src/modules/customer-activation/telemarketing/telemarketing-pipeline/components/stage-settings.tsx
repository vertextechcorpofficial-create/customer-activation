"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Pencil,
  Plus,
  PowerOff,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Stage } from "../types/pipeline.schema";
import { useStages } from "../hooks/use-stages";

const PAGE_SIZE = 10;

const flagOn = (v: Stage["is_won"]) => Number(v) === 1;

function StageStatus({ stage }: { stage: Stage }) {
  // A closed stage is terminal, so an enabled/disabled badge on it says nothing
  // useful and reads as a contradiction next to "Won"/"Lost".
  const terminal = flagOn(stage.is_won) || flagOn(stage.is_lost);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {flagOn(stage.is_won) && <StatusPill tone="success">Won</StatusPill>}
      {flagOn(stage.is_lost) && <StatusPill tone="destructive">Lost</StatusPill>}
      {terminal ? null : flagOn(stage.is_active) ? (
        <StatusPill tone="success">Active</StatusPill>
      ) : (
        <StatusPill tone="neutral">Inactive</StatusPill>
      )}
    </div>
  );
}

interface FormState {
  stage_code: string;
  stage_name: string;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  stage_code: "",
  stage_name: "",
  is_won: false,
  is_lost: false,
  is_active: true,
};

function formFrom(stage: Stage): FormState {
  return {
    stage_code: stage.stage_code,
    stage_name: stage.stage_name,
    is_won: flagOn(stage.is_won),
    is_lost: flagOn(stage.is_lost),
    is_active: flagOn(stage.is_active),
  };
}

function FlagRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function StageActions({
  stage,
  index,
  total,
  busy,
  size = "icon-sm",
  onMove,
  onEdit,
  onDeactivate,
}: {
  stage: Stage;
  index: number;
  total: number;
  busy: boolean;
  size?: "icon-sm" | "icon";
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (stage: Stage) => void;
  onDeactivate: (stage: Stage) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size={size}
        aria-label={`Move ${stage.stage_name} up`}
        title="Move up"
        disabled={busy || index === 0}
        onClick={() => onMove(index, -1)}
        className="focus-visible:ring-ring"
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size={size}
        aria-label={`Move ${stage.stage_name} down`}
        title="Move down"
        disabled={busy || index === total - 1}
        onClick={() => onMove(index, 1)}
        className="focus-visible:ring-ring"
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size={size}
        aria-label={`Edit ${stage.stage_name}`}
        title="Edit stage"
        onClick={() => onEdit(stage)}
        className="focus-visible:ring-ring"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size={size}
        aria-label={`Deactivate ${stage.stage_name}`}
        title="Deactivate stage"
        disabled={busy || !flagOn(stage.is_active)}
        onClick={() => onDeactivate(stage)}
        className="focus-visible:ring-ring"
      >
        <PowerOff className="size-4" />
      </Button>
    </div>
  );
}

export function StageSettings() {
  const { stages, isLoading, error, refresh, createStage, updateStage, reorderStages, deactivateStage } =
    useStages();
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; stage: Stage } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Stage | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(stages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visible = stages.slice(offset, offset + PAGE_SIZE);
  const nextOrder = stages.reduce((max, stage) => Math.max(max, stage.stage_order), 0) + 1;

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setDialog({ mode: "create" });
  };

  const openEdit = (stage: Stage) => {
    setForm(formFrom(stage));
    setErrors({});
    setDialog({ mode: "edit", stage });
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.stage_code.trim()) next.stage_code = "Enter a stage code.";
    if (!form.stage_name.trim()) next.stage_name = "Enter a stage name.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog || submitting || !validate()) return;
    setSubmitting(true);
    const payload = {
      stage_code: form.stage_code.trim(),
      stage_name: form.stage_name.trim(),
      is_won: form.is_won,
      is_lost: form.is_lost,
      is_active: form.is_active,
    };
    const ok =
      dialog.mode === "create"
        ? await createStage({ ...payload, stage_order: nextOrder })
        : await updateStage(dialog.stage.stage_id, payload);
    setSubmitting(false);
    if (ok) setDialog(null);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setReordering(true);
    await reorderStages(next.map((s) => s.stage_id));
    setReordering(false);
  };

  const handleDeactivate = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!confirmDeactivate || deactivating) return;
    setDeactivating(true);
    const ok = await deactivateStage(confirmDeactivate.stage_id);
    setDeactivating(false);
    if (ok) setConfirmDeactivate(null);
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Stage settings</h1>
          <p className="text-sm text-muted-foreground">
            Order sets the pipeline sequence. Won and lost stages close a lead.
          </p>
        </div>
        <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
          <Plus className="size-4" />
          New stage
        </Button>
      </header>

      <Card className="gap-0 overflow-hidden rounded-2xl border-border/50 py-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Could not load stages</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <Button variant="outline" size="sm" onClick={() => void refresh()}>
                    <RefreshCw className="size-4" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : stages.length === 0 ? (
            <div className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers />
                  </EmptyMedia>
                  <EmptyTitle>No stages yet</EmptyTitle>
                  <EmptyDescription>Create the first pipeline stage to start tracking leads.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreate} className="min-h-11 md:min-h-0">
                    <Plus className="size-4" />
                    New stage
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border md:hidden">
                {visible.map((stage, i) => (
                  <li key={stage.stage_id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{stage.stage_name}</p>
                        <p className="font-mono text-xs text-muted-foreground break-words">{stage.stage_code}</p>
                      </div>
                      <StageStatus stage={stage} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">Order {stage.stage_order}</span>
                      <StageActions
                        stage={stage}
                        index={offset + i}
                        total={stages.length}
                        busy={reordering}
                        size="icon"
                        onMove={(idx, dir) => void move(idx, dir)}
                        onEdit={openEdit}
                        onDeactivate={setConfirmDeactivate}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
                <Table className="min-w-2xl">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-16">Order</TableHead>
                      <TableHead className="w-40">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-44">Status</TableHead>
                      <TableHead className="w-44 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((stage, i) => (
                      <TableRow key={stage.stage_id}>
                        <TableCell className="font-medium tabular-nums">{stage.stage_order}</TableCell>
                        <TableCell className="max-w-40 truncate font-mono text-xs" title={stage.stage_code}>
                          {stage.stage_code}
                        </TableCell>
                        <TableCell className="max-w-64 truncate" title={stage.stage_name}>
                          {stage.stage_name}
                        </TableCell>
                        <TableCell>
                          <StageStatus stage={stage} />
                        </TableCell>
                        <TableCell>
                          <StageActions
                            stage={stage}
                            index={offset + i}
                            total={stages.length}
                            busy={reordering}
                            onMove={(idx, dir) => void move(idx, dir)}
                            onEdit={openEdit}
                            onDeactivate={setConfirmDeactivate}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {totalPages <= 1
                    ? `${stages.length} ${stages.length === 1 ? "stage" : "stages"}`
                    : `Showing ${offset + 1}-${offset + visible.length} of ${stages.length}`}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-0"
                      aria-label="Previous page"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-0"
                      aria-label="Next page"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="line-clamp-1">{dialog?.mode === "edit" ? "Edit stage" : "New stage"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? "Rename the stage or change what it means. Position is set with the arrows in the table."
                : "Add a step to the telemarketing pipeline. It is appended to the end of the order."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="stage-code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stage-code"
                  value={form.stage_code}
                  onChange={(e) => setField("stage_code", e.target.value)}
                  placeholder="e.g. qualification"
                  maxLength={64}
                  aria-required="true"
                  aria-invalid={Boolean(errors.stage_code)}
                  aria-describedby={errors.stage_code ? "stage-code-error" : undefined}
                />
                {errors.stage_code && (
                  <p id="stage-code-error" className="text-xs text-destructive">
                    {errors.stage_code}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stage-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stage-name"
                  value={form.stage_name}
                  onChange={(e) => setField("stage_name", e.target.value)}
                  placeholder="e.g. Qualification"
                  maxLength={191}
                  aria-required="true"
                  aria-invalid={Boolean(errors.stage_name)}
                  aria-describedby={errors.stage_name ? "stage-name-error" : undefined}
                />
                {errors.stage_name && (
                  <p id="stage-name-error" className="text-xs text-destructive">
                    {errors.stage_name}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FlagRow
                  id="stage-won"
                  label="Closed won"
                  description="Leads here count as won."
                  checked={form.is_won}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_won: checked, is_lost: checked ? false : prev.is_lost }))
                  }
                />
                <FlagRow
                  id="stage-lost"
                  label="Closed lost"
                  description="Leads here count as lost."
                  checked={form.is_lost}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_lost: checked, is_won: checked ? false : prev.is_won }))
                  }
                />
              </div>
              <FlagRow
                id="stage-active"
                label="Active"
                description="Inactive stages stay on past leads but cannot be picked."
                checked={form.is_active}
                onCheckedChange={(checked) => setField("is_active", checked)}
              />
            </div>
            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {dialog?.mode === "edit" ? "Save changes" : "Create stage"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeactivate !== null} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent size="sm" className="w-[95vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate stage?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeactivate ? `"${confirmDeactivate.stage_name}" leaves the pipeline. Leads already in it stay put.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deactivating} onClick={(e) => void handleDeactivate(e)}>
              {deactivating ? <Loader2 className="size-4 animate-spin" /> : <PowerOff className="size-4" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
