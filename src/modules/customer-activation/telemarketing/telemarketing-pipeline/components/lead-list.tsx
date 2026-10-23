"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Inbox,
  RefreshCw,
  Search,
  SearchX,
  X,
} from "lucide-react";
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
import { fetchLeadPage } from "../providers/lead-query-provider";
import { useStages } from "../hooks/use-stages";
import { LEAD_SOURCES, type Stage } from "../types/pipeline.schema";
import type { LeadSort } from "../services/lead-query-service";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50];
const ALL = "all";

type SortKey = "code" | "company" | "stage" | "last_activity" | "next_follow_up";
type SortDir = "asc" | "desc";

/** First click on a column lands on its useful direction: text A→Z, latest activity newest first, follow-ups soonest first. */
const SORT_INITIAL_DIR: Record<SortKey, SortDir> = {
  code: "asc",
  company: "asc",
  stage: "asc",
  last_activity: "desc",
  next_follow_up: "asc",
};

/** The URL and the API share one sort vocabulary: `<key>` ascending, `-<key>` descending. */
function parseSort(raw: string | null): { key: SortKey | null; dir: SortDir } {
  if (!raw) return { key: null, dir: "asc" };
  const key = raw.startsWith("-") ? raw.slice(1) : raw;
  if (!(key in SORT_INITIAL_DIR)) return { key: null, dir: "asc" };
  return { key: key as SortKey, dir: raw.startsWith("-") ? "desc" : "asc" };
}

/** A column the API can order by — `aria-sort` carries the active state to screen readers. */
function SortableHead({
  label,
  column,
  sortKey,
  sortDir,
  onToggle,
  className,
  alignRight,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggle: (column: SortKey) => void;
  className?: string;
  alignRight?: boolean;
}) {
  const active = sortKey === column;
  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-label={`Sort by ${label}${active ? (sortDir === "desc" ? " (descending)" : " (ascending)") : ""}`}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          alignRight && "justify-end",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
      </button>
    </TableHead>
  );
}

function parseLeadDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[+-]\d{2}:\d{2}$|Z$/.test(iso) ? iso : `${iso}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Absolute timestamp first, relative age second — the same shape the board uses. */
function formatDateTime(value: string | null | undefined, now: number): string {
  const date = parseLeadDate(value);
  if (!date) return "—";
  const absolute = date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const diff = date.getTime() - now;
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return `${absolute} · ${relativeFormatter.format(Math.round(diff / ms), unit)}`;
  }
  return `${absolute} · just now`;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stages, isLoading: stagesLoading, error: stagesError } = useStages();
  // `stage` is the key the shell already deep-links with; the rest mirror the
  // API's own parameter names so a filtered list can be shared and reloaded.
  const [stageFilter, setStageFilter] = useState<string>(
    initialStageId ? String(initialStageId) : (searchParams.get("stage") ?? ALL),
  );
  const [sourceFilter, setSourceFilter] = useState<string>(() => searchParams.get("source") ?? ALL);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [page, setPage] = useState(() => {
    const requested = Number(searchParams.get("page"));
    return Number.isInteger(requested) && requested > 0 ? requested : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const requested = Number(searchParams.get("limit"));
    return PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0];
  });
  const [sortKey, setSortKey] = useState<SortKey | null>(
    () => parseSort(searchParams.get("sort")).key,
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    () => parseSort(searchParams.get("sort")).dir,
  );
  const [debouncedSearch] = useDebounce(search, 300);
  // No sort means the API's own default (`-created_at`), so it never rides in the URL.
  const sort: LeadSort | undefined =
    sortKey === null ? undefined : ((sortDir === "desc" ? `-${sortKey}` : sortKey) as LeadSort);
  // One clock reading per mount: relative ages follow the same convention as
  // the board card metadata.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (stageFilter !== ALL) params.set("stage", stageFilter);
    if (sourceFilter !== ALL) params.set("source", sourceFilter);
    if (sort) params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== PAGE_SIZES[0]) params.set("limit", String(pageSize));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [debouncedSearch, stageFilter, sourceFilter, sort, page, pageSize, pathname]);

  const stageById = useMemo(
    () => new Map(stages.map((stage) => [stage.stage_id, stage])),
    [stages],
  );

  const { items, meta, isLoading, error, refresh } = useLeadQuery({
    stageId: stageFilter === ALL ? undefined : Number(stageFilter),
    source: sourceFilter === ALL ? undefined : sourceFilter,
    search: debouncedSearch.trim() || undefined,
    sort,
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
  // Sorting never empties the list, so it offers a Reset without changing the
  // empty-state copy.
  const isDirty = isActive || sortKey !== null;

  // The header talks about the collection, not the filter, so a no-match
  // search reads "0 of 16 leads" instead of claiming the list is empty.
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [totalFailed, setTotalFailed] = useState(false);
  const requestedTotal = useRef(false);
  const rememberTotal = () => {
    if (!isActive) setCollectionTotal(meta.total);
  };
  // Never print a count that is not known yet: "—" while the first response
  // (or the deep-link total) is in flight, and a plain count if the extra
  // request fails — a bare "0 leads" reads as an empty pipeline.
  const totalUnknown = (isLoading && meta.total === 0) || (isActive && collectionTotal === 0 && !totalFailed);
  const noun = meta.total === 1 ? "lead" : "leads";
  const countLabel = error || totalUnknown
    ? "—"
    : isActive && collectionTotal > 0
      ? `${meta.total} of ${collectionTotal} ${collectionTotal === 1 ? "lead" : "leads"}`
      : `${meta.total} ${noun}`;

  // A deep link can arrive already filtered, so no unfiltered response was ever
  // seen — ask the API for the collection total once rather than showing a bare "0".
  useEffect(() => {
    if (requestedTotal.current || collectionTotal > 0 || !isActive) return;
    requestedTotal.current = true;
    let cancelled = false;
    void fetchLeadPage({ page: 1, limit: 1 })
      .then((result) => {
        if (!cancelled) setCollectionTotal(result.meta.total);
      })
      .catch(() => {
        requestedTotal.current = false;
        if (!cancelled) setTotalFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionTotal, isActive]);

  // A column that is empty on every row of the page costs width and carries no
  // information, so it only appears when the page actually has follow-ups.
  const showFollowUp = items.some((lead) => Boolean(lead.next_follow_up_at));

  const toggleSort = (column: SortKey) => {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(SORT_INITIAL_DIR[column]);
    } else if (sortDir === SORT_INITIAL_DIR[column]) {
      setSortDir(SORT_INITIAL_DIR[column] === "asc" ? "desc" : "asc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
    setPage(1);
  };

  const resetFilters = () => {
    setStageFilter(ALL);
    setSourceFilter(ALL);
    setSearch("");
    setSortKey(null);
    setSortDir("asc");
    setPage(1);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {countLabel}
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
                  rememberTotal();
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search leads…"
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
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                rememberTotal();
                setStageFilter(value);
                setPage(1);
              }}
            />
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                rememberTotal();
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
            {isDirty ? (
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
                        </span>{" "}
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
                        className="line-clamp-2 text-xs text-muted-foreground tabular-nums"
                        title={`Next follow-up: ${lead.next_follow_up_at ?? "—"} · Last activity: ${lead.last_activity_at ?? "—"}`}
                      >
                        {showFollowUp ? `Next follow-up ${formatDateTime(lead.next_follow_up_at, now)} · ` : null}
                        Last activity {formatDateTime(lead.last_activity_at, now)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-md border sm:block">
                <table className="w-full caption-bottom text-sm min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead
                        label="Code"
                        column="code"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={toggleSort}
                        className="w-28"
                      />
                      <SortableHead
                        label="Company"
                        column="company"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={toggleSort}
                        className="max-w-56"
                      />
                      <TableHead className="max-w-48">Contact</TableHead>
                      <TableHead className="w-32">Source</TableHead>
                      <SortableHead
                        label="Stage"
                        column="stage"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={toggleSort}
                        className="w-36"
                      />
                      {showFollowUp ? (
                        <SortableHead
                          label="Next follow-up"
                          column="next_follow_up"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggle={toggleSort}
                          className="w-40 text-right tabular-nums"
                          alignRight
                        />
                      ) : null}
                      <SortableHead
                        label="Last activity"
                        column="last_activity"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggle={toggleSort}
                        className="w-40 text-right tabular-nums"
                        alignRight
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((lead) => {
                      const stage = stageById.get(lead.stage_id);
                      const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                      return (
                        <TableRow
                          key={lead.lead_id}
                          className="cursor-pointer"
                          onClick={(event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
                              )
                            )
                              return;
                            router.push(leadHref);
                          }}
                        >
                          <TableCell className="font-mono text-xs tabular-nums">
                            {lead.lead_code}
                          </TableCell>
                          <TableCell className="max-w-56">
                            <Link
                              href={`/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`}
                              className="block truncate rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                            </span>{" "}
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
                          {showFollowUp ? (
                            <TableCell
                              className="text-right tabular-nums"
                              title={lead.next_follow_up_at ?? "No follow-up scheduled"}
                            >
                              {formatDateTime(lead.next_follow_up_at, now)}
                            </TableCell>
                          ) : null}
                          <TableCell
                            className="text-right tabular-nums"
                            title={lead.last_activity_at ?? "No activity yet"}
                          >
                            {formatDateTime(lead.last_activity_at, now)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {from}–{to} of {meta.total}
                </p>
                {pageCount > 1 ? (
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
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
