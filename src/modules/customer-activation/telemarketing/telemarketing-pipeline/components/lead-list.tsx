"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";
import { ChevronLeft, ChevronRight, Check, ChevronsUpDown, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { stageTone } from "../lib/stage-tone";
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
import { LEAD_SOURCES, type Stage } from "../types/pipeline.schema";

const PAGE_SIZE = 10;
const ALL = "all";

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
  const selected =
    value === ALL ? null : stages.find((stage) => String(stage.stage_id) === value);
  const label = value === ALL ? "All stages" : (selected?.stage_name ?? "All stages");

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
              <CommandItem
                value={ALL}
                title="All stages"
                onSelect={() => {
                  onValueChange(ALL);
                  setOpen(false);
                }}
              >
                <Check
                  className={
                    value === ALL
                      ? "size-4 shrink-0 opacity-100"
                      : "size-4 shrink-0 opacity-0"
                  }
                />
                <span className="min-w-0 flex-1 truncate">All stages</span>
              </CommandItem>
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
          <StageCombobox
            value={stageFilter}
            stages={stages}
            disabled={stagesLoading}
            onValueChange={(value) => {
              setStageFilter(value);
              setPage(1);
            }}
          />
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
            <SelectTrigger id="lead-source" className="h-11 w-full truncate md:h-9">
              <SelectValue placeholder="All sources" className="truncate" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
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
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="max-w-56">Company</TableHead>
                <TableHead className="max-w-48">Contact</TableHead>
                <TableHead className="w-32">Source</TableHead>
                <TableHead className="w-36">Stage</TableHead>
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
                    <TableCell className="max-w-32">
                      <span
                        className="block truncate capitalize"
                        title={lead.source.replace(/_/g, " ")}
                      >
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-36">
                      <span
                        className="block truncate"
                        title={stage?.stage_name ?? "Unknown stage"}
                      >
                        <StatusPill tone={stage ? stageTone(stage) : "neutral"}>
                          {stage?.stage_name ?? "Unknown stage"}
                        </StatusPill>
                      </span>
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
          </div>

          {pageCount > 1 ? (
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
          ) : null}
        </>
      )}
    </div>
  );
}
