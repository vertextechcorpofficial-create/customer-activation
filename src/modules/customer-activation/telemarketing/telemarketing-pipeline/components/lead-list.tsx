"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";
import { ChevronLeft, ChevronRight, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeadQuery } from "../hooks/use-lead-query";
import { useStages } from "../hooks/use-stages";
import { LEAD_SOURCES, type LeadRecord, type Stage } from "../types/pipeline.schema";

const PAGE_SIZE = 20;
const ALL = "all";

const VALIDATION_TONE: Record<LeadRecord["validation_status"], StatusTone> = {
  new: "neutral",
  for_validation: "info",
  validated: "success",
  duplicate: "warning",
  invalid: "destructive",
  rejected: "destructive",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[+-]\d{2}:\d{2}$|Z$/.test(iso) ? iso : `${iso}+08:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stageTone(stage: Stage | undefined): StatusTone {
  if (!stage) return "neutral";
  if (Number(stage.is_won) === 1) return "success";
  if (Number(stage.is_lost) === 1) return "destructive";
  return "info";
}

/** Every lead in the pipeline, filterable by stage, source or search term. */
export function LeadList({ initialStageId }: { initialStageId?: number }) {
  const { stages, isLoading: stagesLoading, error: stagesError } = useStages();
  const [stageFilter, setStageFilter] = useState<string>(
    initialStageId ? String(initialStageId) : ALL,
  );
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 300);

  const stageById = useMemo(
    () => new Map(stages.map((stage) => [stage.stage_id, stage])),
    [stages],
  );

  const { items, meta, isLoading, error, refresh } = useLeadQuery({
    stageId: stageFilter === ALL ? undefined : Number(stageFilter),
    source: sourceFilter === ALL ? undefined : sourceFilter,
    search: debouncedSearch.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const filtered = stageFilter !== ALL || sourceFilter !== ALL || debouncedSearch.trim() !== "";
  const pageCount = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const from = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, meta.total);

  const resetFilters = () => {
    setStageFilter(ALL);
    setSourceFilter(ALL);
    setSearch("");
    setPage(1);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {meta.total} {meta.total === 1 ? "lead" : "leads"} in the telemarketing pipeline.
          </p>
        </div>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 md:min-h-0"
            onClick={resetFilters}
          >
            <X className="size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[13rem_13rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="lead-stage">Stage</Label>
          <Select
            value={stageFilter}
            disabled={stagesLoading}
            onValueChange={(value) => {
              setStageFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="lead-stage" className="h-11 w-full md:h-9">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage.stage_id} value={String(stage.stage_id)}>
                  {stage.stage_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-source">Source</Label>
          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              setSourceFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="lead-source" className="h-11 w-full md:h-9">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {LEAD_SOURCES.map((source) => (
                <SelectItem key={source} value={source} className="capitalize">
                  {source.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="lead-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Company, contact, code, email or mobile"
              className="h-11 pl-8 md:h-9"
            />
          </div>
        </div>
      </div>

      {stagesError ? (
        <p className="text-sm text-destructive" role="alert">
          {stagesError}
        </p>
      ) : null}

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
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No leads to show</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "No lead matches these filters. Widen the stage, source or search term."
                : "No lead has entered the telemarketing pipeline yet."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered ? (
            <EmptyContent>
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="max-w-56">Company</TableHead>
                <TableHead className="max-w-48">Contact</TableHead>
                <TableHead className="w-32">Source</TableHead>
                <TableHead className="w-36">Stage</TableHead>
                <TableHead className="w-36">Validation</TableHead>
                <TableHead className="w-40">Next follow-up</TableHead>
                <TableHead className="w-40">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => {
                const stage = stageById.get(lead.stage_id);
                return (
                  <TableRow key={lead.lead_id}>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {lead.lead_code}
                    </TableCell>
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
                      <span
                        className="block truncate"
                        title={lead.contact_name ?? undefined}
                      >
                        {lead.contact_name || "—"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {lead.mobile || lead.email || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      {lead.source.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={stageTone(stage)}>
                        {stage?.stage_name ?? "Unknown stage"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={VALIDATION_TONE[lead.validation_status]}
                        className="capitalize"
                      >
                        {lead.validation_status.replace(/_/g, " ")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDateTime(lead.next_follow_up_at)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDateTime(lead.last_activity_at)}
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
