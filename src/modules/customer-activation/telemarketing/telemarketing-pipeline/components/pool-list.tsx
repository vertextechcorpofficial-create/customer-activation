"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePool } from "../hooks/use-pool";
import { useStages } from "../hooks/use-stages";
import { claimLead } from "../providers/claim-provider";
import { isTerminalStage } from "../types/pipeline.schema";
import type { PoolLead, PoolSort } from "../services/claim-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL = "all";
const PAGE_SIZES = [10, 25, 50];

type SortKey = "code" | "claimants";
type SortDir = "asc" | "desc";

function SortHeaderButton({
  label,
  column,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggle: (column: SortKey) => void;
}) {
  const active = sortKey === column;
  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-label={`Sort by ${label}${active ? (sortDir === "desc" ? " (descending)" : " (ascending)") : ""}`}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
    </button>
  );
}

/** Unclaimed, non-terminal leads — claim one to start working it. */
export function PoolList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [selected, setSelected] = useState<Map<number, PoolLead>>(new Map());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const { stages, isLoading: stagesLoading, error: stagesError } = useStages();

  const activeStages = useMemo(
    () => stages.filter((stage) => Number(stage.is_active) === 1 && !isTerminalStage(stage)),
    [stages],
  );
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.stage_id, stage])), [stages]);

  const sort: PoolSort | undefined =
    sortKey === null
      ? undefined
      : sortKey === "code"
        ? sortDir === "asc"
          ? "code"
          : "-code"
        : sortDir === "asc"
          ? "claimants"
          : "-claimants";

  const { items, meta, isLoading, error, refresh, claim, release } = usePool({
    search: debouncedSearch.trim() || undefined,
    stageId: stageFilter === ALL ? undefined : Number(stageFilter),
    sort,
    page,
    limit: pageSize,
  });

  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  const from = meta.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, meta.total);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Page-scoped selection never survives a listing change.
  useEffect(() => {
    setSelected(new Map());
  }, [debouncedSearch, stageFilter, sort, page, pageSize]);

  const isActive = search.trim() !== "" || stageFilter !== ALL || sortKey !== null;

  const selectedCount = selected.size;
  const allSelected = items.length > 0 && items.every((lead) => selected.has(lead.lead_id));
  const someSelected = items.some((lead) => selected.has(lead.lead_id));

  function toggleSort(column: SortKey) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(column === "code" ? "asc" : "desc");
      return;
    }
    const initial: SortDir = column === "code" ? "asc" : "desc";
    if (sortDir === initial) {
      setSortDir(initial === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(null);
    setSortDir("asc");
  }

  function resetControls() {
    setSearch("");
    setStageFilter(ALL);
    setSortKey(null);
    setSortDir("asc");
    setPage(1);
  }

  function toggleOne(leadId: number, lead: PoolLead, checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(leadId, lead);
      else next.delete(leadId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const lead of items) {
        if (checked) next.set(lead.lead_id, lead);
        else next.delete(lead.lead_id);
      }
      return next;
    });
  }

  // Sequential so one failure never aborts the rest; the summary — not the
  // first error — is the outcome. Claiming is idempotent server-side, so rows
  // already held are skipped without a write.
  async function runBulkClaim() {
    const targets = items.filter((lead) => selected.has(lead.lead_id));
    if (targets.length === 0 || bulkRunning) return;
    setBulkRunning(true);
    setBulkDone(0);
    setBulkTotal(targets.length);
    setLastSummary(null);
    let claimed = 0;
    let skipped = 0;
    let failed = 0;
    for (const lead of targets) {
      if (lead.claimed_by_me) {
        skipped += 1;
      } else {
        try {
          await claimLead(lead.lead_id);
          claimed += 1;
        } catch {
          failed += 1;
        }
      }
      setBulkDone((done) => done + 1);
    }
    setBulkRunning(false);
    const summary = `${claimed} claimed · ${skipped} skipped · ${failed} failed`;
    setLastSummary(summary);
    if (failed > 0) toast.error("Bulk claim finished with failures", { description: summary });
    else toast.success("Bulk claim finished", { description: summary });
    setSelected(new Map());
    await refresh();
  }

  const handleToggle = async (leadId: number, claimed: boolean) => {
    setPendingId(leadId);
    try {
      await (claimed ? release(leadId) : claim(leadId));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Lead pool</h1>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {error ? "—" : `${meta.total} ${meta.total === 1 ? "open lead" : "open leads"}`}
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
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search company, code, contact…"
                aria-label="Search by company, code, contact name or mobile"
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
            <Select
              value={stageFilter}
              onValueChange={(value) => {
                setStageFilter(value);
                setPage(1);
              }}
              disabled={stagesLoading}
            >
              <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by stage">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All stages</SelectItem>
                {activeStages.map((stage) => (
                  <SelectItem key={stage.stage_id} value={String(stage.stage_id)}>
                    {stage.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetControls}
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
            <div className="grid gap-2" aria-label="Loading lead pool" aria-busy="true">
              {Array.from({ length: pageSize }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>
                  {isActive ? "No leads match this filter" : "No leads are waiting to be claimed"}
                </EmptyTitle>
              </EmptyHeader>
              {isActive ? (
                <Button type="button" variant="outline" size="sm" onClick={resetControls}>
                  Reset
                </Button>
              ) : null}
            </Empty>
          ) : (
            <>
              {selectedCount > 0 ? (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                  aria-live="polite"
                >
                  <p className="text-sm text-muted-foreground">
                    {selectedCount} selected
                    {bulkRunning ? ` · claiming ${bulkDone} of ${bulkTotal}…` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelected(new Map())}
                      disabled={bulkRunning}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void runBulkClaim()}
                      disabled={bulkRunning}
                      aria-label={`Claim ${selectedCount} selected lead${selectedCount === 1 ? "" : "s"}`}
                    >
                      {bulkRunning ? `Claiming ${bulkDone} of ${bulkTotal}…` : `Claim ${selectedCount} selected`}
                    </Button>
                  </div>
                </div>
              ) : null}
              {lastSummary ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Last bulk run: {lastSummary}
                </p>
              ) : null}

              {/* Cards below sm — the table would overflow at 390px. */}
              <ul className="grid gap-2 sm:hidden">
                {items.map((lead) => {
                  const stage = stageById.get(lead.stage_id);
                  const pending = pendingId === lead.lead_id;
                  const checked = selected.has(lead.lead_id);
                  const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                  return (
                    <li
                      key={lead.lead_id}
                      className="relative grid gap-1 rounded-md border p-3 transition-shadow hover:shadow-sm"
                    >
                      <Link
                        href={leadHref}
                        aria-label={`Open lead ${lead.lead_code} ${lead.company_name}`}
                        className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />
                      <div className="flex items-start gap-2">
                        <span className="relative z-10" data-no-row-click>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleOne(lead.lead_id, lead, value === true)}
                            aria-label={`Select ${lead.company_name}`}
                            className="mt-1"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span
                            className="block truncate font-medium"
                            title={lead.company_name}
                          >
                            {lead.company_name}
                          </span>
                          <p className="truncate font-mono text-xs text-muted-foreground" title={lead.lead_code}>
                            {lead.lead_code}
                          </p>
                        </div>
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
                        <StatusPill tone="neutral" className="rounded-full tabular-nums">
                          {lead.claimant_count}
                        </StatusPill>
                        {lead.claimed_by_me ? <StatusPill tone="info">you</StatusPill> : null}
                      </div>
                      <div className="mt-1 flex justify-end">
                        <Button
                          variant={lead.claimed_by_me ? "outline" : "default"}
                          size="sm"
                          data-no-row-click
                          className="relative z-10 min-h-11 w-full"
                          disabled={pending || isLoading || bulkRunning}
                          onClick={() => void handleToggle(lead.lead_id, lead.claimed_by_me)}
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : lead.claimed_by_me ? (
                            <UserMinus className="size-4" aria-hidden />
                          ) : (
                            <UserPlus className="size-4" aria-hidden />
                          )}
                          {lead.claimed_by_me ? "Release" : "Claim"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto rounded-md border sm:block">
                <table className="w-full caption-bottom text-sm min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(value) => toggleAll(value === true || value === "indeterminate")}
                          aria-label="Select all rows on this page"
                        />
                      </TableHead>
                      <TableHead
                        aria-sort={
                          sortKey === "code" ? (sortDir === "desc" ? "descending" : "ascending") : "none"
                        }
                      >
                        <SortHeaderButton
                          label="Code"
                          column="code"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead
                        aria-sort={
                          sortKey === "claimants"
                            ? sortDir === "desc"
                              ? "descending"
                              : "ascending"
                            : "none"
                        }
                        className="text-right tabular-nums"
                      >
                        <span className="ml-auto inline-flex justify-end">
                          <SortHeaderButton
                            label="Claimants"
                            column="claimants"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onToggle={toggleSort}
                          />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((lead) => {
                      const stage = stageById.get(lead.stage_id);
                      const pending = pendingId === lead.lead_id;
                      const checked = selected.has(lead.lead_id);
                      const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                      return (
                        <TableRow
                          key={lead.lead_id}
                          data-state={checked ? "selected" : undefined}
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
                          <TableCell data-no-row-click>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleOne(lead.lead_id, lead, value === true)}
                              aria-label={`Select ${lead.company_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">{lead.lead_code}</TableCell>
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
                            <span className="block truncate" title={lead.contact_name ?? undefined}>
                              {lead.contact_name || "—"}
                            </span>
                            <span
                              className="block truncate text-xs text-muted-foreground"
                              title={lead.mobile ?? lead.email ?? undefined}
                            >
                              {lead.mobile || lead.email || "—"}
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
                          <TableCell className="text-right tabular-nums">
                            <StatusPill tone="neutral" className="rounded-full tabular-nums">
                              {lead.claimant_count}
                            </StatusPill>
                            {lead.claimed_by_me ? (
                              <StatusPill tone="info" className="ml-2">
                                you
                              </StatusPill>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right" data-no-row-click>
                            <Button
                              variant={lead.claimed_by_me ? "outline" : "default"}
                              size="sm"
                              data-no-row-click
                              className="min-h-11 md:min-h-0"
                              disabled={pending || isLoading || bulkRunning}
                              onClick={() => void handleToggle(lead.lead_id, lead.claimed_by_me)}
                            >
                              {pending ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : lead.claimed_by_me ? (
                                <UserMinus className="size-4" aria-hidden />
                              ) : (
                                <UserPlus className="size-4" aria-hidden />
                              )}
                              {lead.claimed_by_me ? "Release" : "Claim"}
                            </Button>
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
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="pool-page-size" className="text-sm whitespace-nowrap text-muted-foreground">
                    Rows per page
                  </label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                    disabled={isLoading || bulkRunning}
                  >
                    <SelectTrigger id="pool-page-size" size="sm" className="h-9 w-20" aria-label="Rows per page">
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
                    disabled={page <= 1 || isLoading || bulkRunning}
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
                    disabled={page >= pageCount || isLoading || bulkRunning}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
