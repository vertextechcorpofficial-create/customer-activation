"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeadQuery } from "../hooks/use-lead-query";
import { useStages } from "../hooks/use-stages";
import { LEAD_SOURCES, type Stage } from "../types/pipeline.schema";

const PAGE_SIZES = [10, 25, 50];
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
          aria-label="Filter by stage"
          disabled={disabled}
          className="h-9 w-full justify-between font-normal sm:w-44"
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
  const router = useRouter();
  const { stages, isLoading: stagesLoading, error: stagesError } = useStages();
  const [stageFilter, setStageFilter] = useState<string>(
    initialStageId ? String(initialStageId) : ALL,
  );
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
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
    limit: pageSize,
  });

  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  // The hook clamps out-of-range pages server-side, so `meta.page` is the
  // confirmed page — display it rather than the requested one.
  const from = meta.total === 0 ? 0 : (meta.page - 1) * pageSize + 1;
  const to = Math.min(meta.page * pageSize, meta.total);

  const isActive =
    search.trim() !== "" || stageFilter !== ALL || sourceFilter !== ALL;

  const resetFilters = () => {
    setStageFilter(ALL);
    setSourceFilter(ALL);
    setSearch("");
    setPage(1);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {error ? "—" : `${meta.total} ${meta.total === 1 ? "lead" : "leads"}`}
        </p>
      </div>

      <Card>
        <CardContent className="grid min-w-0 gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-56">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
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
                aria-label="Search by company, contact, code, email or mobile"
                className="h-9 pr-8 pl-8"
              />
              {search !== "" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <StageCombobox
              value={stageFilter}
              stages={stages}
              disabled={stagesLoading}
              onValueChange={(value) => {
                setStageFilter(value);
                setPage(1);
              }}
            />
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setSourceFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                id="lead-source"
                aria-label="Filter by source"
                className="h-9 w-full sm:w-44"
              >
                <SelectValue placeholder="All sources" />
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
            {isActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 w-full sm:ml-auto sm:w-auto"
              >
                Reset
              </Button>
            ) : null}
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
            <div className="grid gap-2" aria-label="Loading leads" aria-busy="true">
              {Array.from({ length: pageSize }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {isActive ? <SearchX /> : <Inbox />}
                </EmptyMedia>
                <EmptyTitle>
                  {isActive
                    ? "No leads match this filter"
                    : "No leads in the pipeline yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {isActive
                    ? "No lead matches these filters. Widen the stage, source or search term."
                    : "No lead has entered the telemarketing pipeline yet."}
                </EmptyDescription>
              </EmptyHeader>
              {isActive ? (
                <EmptyContent>
                  <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                    Reset
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <>
              {/* Cards below sm — the table would overflow at 390px. */}
              <ul className="grid gap-2 sm:hidden">
                {items.map((lead) => {
                  const stage = stageById.get(lead.stage_id);
                  const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                  return (
                    <li
                      key={lead.lead_id}
                      className="relative grid min-h-11 gap-1 rounded-md border p-3 transition-shadow hover:shadow-sm"
                    >
                      <Link
                        href={leadHref}
                        aria-label={`Open lead ${lead.lead_code} ${lead.company_name}`}
                        className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={lead.company_name}
                        >
                          {lead.company_name}
                        </span>
                        <span
                          className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
                          title={lead.lead_code}
                        >
                          {lead.lead_code}
                        </span>
                      </div>
                      <p
                        className="truncate text-sm text-muted-foreground"
                        title={`${lead.contact_name ?? "—"} · ${lead.mobile ?? lead.email ?? "—"}`}
                      >
                        {lead.contact_name || "—"} · {lead.mobile || lead.email || "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={stage ? stageTone(stage) : "neutral"}>
                          {stage?.stage_name ?? "Unknown stage"}
                        </StatusPill>
                      </div>
                      <p
                        className="truncate text-xs text-muted-foreground tabular-nums"
                        title={`Next follow-up: ${lead.next_follow_up_at ?? "—"} · Last activity: ${lead.last_activity_at ?? "—"}`}
                      >
                        Next {formatDateTime(lead.next_follow_up_at)} · Updated{" "}
                        {formatDateTime(lead.last_activity_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-md border sm:block">
                <table className="w-full caption-bottom text-sm min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Code</TableHead>
                      <TableHead className="max-w-56">Company</TableHead>
                      <TableHead className="max-w-48">Contact</TableHead>
                      <TableHead className="w-32">Source</TableHead>
                      <TableHead className="w-36">Stage</TableHead>
                      <TableHead className="w-40 text-right tabular-nums">
                        Next follow-up
                      </TableHead>
                      <TableHead className="w-40 text-right tabular-nums">
                        Last activity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((lead) => {
                      const stage = stageById.get(lead.stage_id);
                      const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                      return (
                        <TableRow
                          key={lead.lead_id}
                          tabIndex={0}
                          role="link"
                          aria-label={`Open lead ${lead.lead_code} ${lead.company_name}`}
                          className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                          onClick={(event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
                              )
                            )
                              return;
                            router.push(leadHref);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            if (
                              (event.target as HTMLElement).closest(
                                "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
                              )
                            )
                              return;
                            event.preventDefault();
                            router.push(leadHref);
                          }}
                        >
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
                            <span
                              className="block truncate text-xs text-muted-foreground"
                              title={lead.mobile ?? lead.email ?? undefined}
                            >
                              {lead.mobile || lead.email || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-32">
                            <span
                              className="block truncate text-xs capitalize text-muted-foreground"
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
                          <TableCell
                            className="text-right tabular-nums"
                            title={lead.next_follow_up_at ?? "No follow-up scheduled"}
                          >
                            {formatDateTime(lead.next_follow_up_at)}
                          </TableCell>
                          <TableCell
                            className="text-right tabular-nums"
                            title={lead.last_activity_at ?? "No activity yet"}
                          >
                            {formatDateTime(lead.last_activity_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>

              {pageCount > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {from}–{to} of {meta.total}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="lead-page-size"
                      className="text-sm whitespace-nowrap text-muted-foreground"
                    >
                      Rows per page
                    </label>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger
                        id="lead-page-size"
                        size="sm"
                        className="h-9 w-20"
                        aria-label="Rows per page"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-0"
                      disabled={meta.page <= 1 || isLoading}
                      onClick={() => setPage(Math.max(1, meta.page - 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                      Previous
                    </Button>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Page {meta.page} of {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 md:min-h-0"
                      disabled={meta.page >= pageCount || isLoading}
                      onClick={() => setPage(meta.page + 1)}
                    >
                      Next
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
