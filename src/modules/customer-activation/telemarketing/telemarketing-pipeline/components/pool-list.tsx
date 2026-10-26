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
  Loader2,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePool } from "../hooks/use-pool";
import type { UsePoolParams } from "../hooks/use-pool";
import { useStages } from "../hooks/use-stages";
import { claimLead, getPool } from "../providers/claim-provider";
import { isTerminalStage } from "../types/pipeline.schema";
import type { Stage } from "../types/pipeline.schema";
import type { PoolLead, PoolSort } from "../services/claim-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL = "all";
const PAGE_SIZES = [10, 25, 50];
const PRODUCTS_URL = "/api/customer-activation/telemarketing/telemarketing-products";

interface TelemarketingProduct {
  product_id: number;
  product_code: string;
  name: string;
  is_active: number | boolean;
  sort_order: number | null;
}

/**
 * Active products for the filter. Never throws: a missing catalog resolves
 * to an empty list and the filter stays on "All products" without breaking layout.
 */
function useProducts() {
  const [products, setProducts] = useState<TelemarketingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as {
          success: boolean;
          data?: TelemarketingProduct[];
        } | null;
        if (!res.ok || !body?.success) throw new Error("Could not load products");
        if (!cancelled) setProducts((body.data ?? []).filter((p) => Number(p.is_active) === 1));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, isLoading };
}

type SortKey = "code" | "company" | "claimants";
type SortDir = "asc" | "desc";

/** First click on a column lands on its useful direction: text A→Z, most-claimed first. */
const SORT_INITIAL_DIR: Record<SortKey, SortDir> = {
  code: "asc",
  company: "asc",
  claimants: "desc",
};

/** The URL and the API share one sort vocabulary: `<key>` ascending, `-<key>` descending. */
function parseSort(raw: string | null): { key: SortKey | null; dir: SortDir } {
  if (!raw) return { key: null, dir: "asc" };
  const key = raw.startsWith("-") ? raw.slice(1) : raw;
  if (!(key in SORT_INITIAL_DIR)) return { key: null, dir: "asc" };
  return { key: key as SortKey, dir: raw.startsWith("-") ? "desc" : "asc" };
}

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
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
    </button>
  );
}

/** Searchable single-select stage filter — same Popover + Command pattern as the lead-generation client picker. */
function StageCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Stage[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((stage) => stage.stage_name.toLowerCase().includes(q))
    : options;
  const selected = options.find((stage) => String(stage.stage_id) === value) ?? null;
  const label = selected ? selected.stage_name : "All stages";
  const showAll = q === "" || "all stages".includes(q);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
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
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false} label="Search stages">
          <CommandInput placeholder="Search stages…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-60">
            <CommandEmpty>No stages found.</CommandEmpty>
            <CommandGroup>
              {showAll ? (
              <CommandItem
                value="all-stages"
                keywords={["All stages"]}
                onSelect={() => {
                  onChange(ALL);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check
                  className={cn("size-4 shrink-0", value === ALL ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">All stages</span>
              </CommandItem>
              ) : null}
              {filtered.map((stage) => {
                const stageValue = String(stage.stage_id);
                const isSelected = stageValue === value;
                return (
                  <CommandItem
                    key={stage.stage_id}
                    value={`${stage.stage_name} ${stageValue}`}
                    keywords={[stage.stage_name]}
                    title={stage.stage_name}
                    onSelect={() => {
                      onChange(stageValue);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{stage.stage_name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable single-select product filter — same Popover + Command pattern as the stage filter. */
function ProductCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: TelemarketingProduct[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (product) =>
          product.name.toLowerCase().includes(q) || product.product_code.toLowerCase().includes(q),
      )
    : options;
  const selected = options.find((product) => String(product.product_id) === value) ?? null;
  const label = selected ? selected.name : "All products";
  const showAll = q === "" || "all products".includes(q);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter by product"
          disabled={disabled}
          className="h-9 w-full justify-between font-normal sm:w-44"
        >
          <span className="min-w-0 flex-1 truncate text-left" title={label}>
            {label}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false} label="Search products">
          <CommandInput placeholder="Search products…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-60">
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {showAll ? (
              <CommandItem
                value="all-products"
                keywords={["All products"]}
                onSelect={() => {
                  onChange(ALL);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check
                  className={cn("size-4 shrink-0", value === ALL ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">All products</span>
              </CommandItem>
              ) : null}
              {filtered.map((product) => {
                const productValue = String(product.product_id);
                const isSelected = productValue === value;
                return (
                  <CommandItem
                    key={product.product_id}
                    value={`${product.name} ${productValue}`}
                    keywords={[product.name]}
                    title={product.name}
                    onSelect={() => {
                      onChange(productValue);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Open leads — claim one to start working it. "Show closed" adds read-only terminal rows. */
export function PoolList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Listing state lives in the URL too, so a filtered pool can be shared,
  // bookmarked and reloaded. The keys match the API's own parameter names.
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch] = useDebounce(search, 300);
  const [stageFilter, setStageFilter] = useState<string>(() => searchParams.get("stageId") ?? ALL);
  const [productFilter, setProductFilter] = useState<string>(() => searchParams.get("productId") ?? ALL);
  const [includeClosed, setIncludeClosed] = useState(() => searchParams.get("includeClosed") === "1");
  const [sortKey, setSortKey] = useState<SortKey | null>(() => parseSort(searchParams.get("sort")).key);
  const [sortDir, setSortDir] = useState<SortDir>(() => parseSort(searchParams.get("sort")).dir);
  const [page, setPage] = useState(() => {
    const requested = Number(searchParams.get("page"));
    return Number.isInteger(requested) && requested > 0 ? requested : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const requested = Number(searchParams.get("limit"));
    return PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0];
  });
  const [selected, setSelected] = useState<Map<number, PoolLead>>(new Map());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const { stages, isLoading: stagesLoading, error: stagesError } = useStages();
  const { products, isLoading: productsLoading } = useProducts();

  const stageOptions = useMemo(
    () => stages.filter((stage) => Number(stage.is_active) === 1 && (includeClosed || !isTerminalStage(stage))),
    [stages, includeClosed],
  );
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.stage_id, stage])), [stages]);
  const isClosedLead = (lead: PoolLead) => {
    const stage = stageById.get(lead.stage_id);
    return stage ? isTerminalStage(stage) : false;
  };

  const sort: PoolSort | undefined =
    sortKey === null ? undefined : ((sortDir === "desc" ? `-${sortKey}` : sortKey) as PoolSort);

  const { items, meta, isLoading, error, refresh, claim, release } = usePool({
    search: debouncedSearch.trim() || undefined,
    stageId: stageFilter === ALL ? undefined : Number(stageFilter),
    // Forwarded to the pool endpoint once use-pool carries it — until then the
    // URL still mirrors the filter below.
    productId: productFilter === ALL ? undefined : Number(productFilter),
    sort,
    page,
    limit: pageSize,
    includeClosed,
  } as UsePoolParams);

  const pageCount = Math.max(1, Math.ceil(meta.total / pageSize));
  const from = meta.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, meta.total);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Page-scoped selection never survives a listing change.
  useEffect(() => {
    setSelected(new Map());
  }, [debouncedSearch, stageFilter, productFilter, includeClosed, sort, page, pageSize]);

  // Mirror the listing into the address bar. replaceState keeps the back
  // button meaning "leave the page" rather than "undo one keystroke".
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (stageFilter !== ALL) params.set("stageId", stageFilter);
    if (productFilter !== ALL) params.set("productId", productFilter);
    if (includeClosed) params.set("includeClosed", "1");
    if (sort) params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== PAGE_SIZES[0]) params.set("limit", String(pageSize));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [debouncedSearch, stageFilter, productFilter, includeClosed, sort, page, pageSize, pathname]);

  const isActive = search.trim() !== "" || stageFilter !== ALL || productFilter !== ALL || sortKey !== null || includeClosed;
  const isFiltered = search.trim() !== "" || stageFilter !== ALL || productFilter !== ALL;

  // The header talks about the pool, not the filter, so a no-match search
  // reads "0 of 12 open leads" instead of claiming the pool is empty.
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [totalFailed, setTotalFailed] = useState(false);
  const requestedTotal = useRef(false);
  const rememberTotal = () => {
    if (!isFiltered) setCollectionTotal(meta.total);
  };
  // Never print a count that is not known yet: "—" while the first response
  // (or the deep-link total) is in flight, and a plain count if the extra
  // request fails — a bare "0 open leads" reads as an empty pool.
  const totalUnknown = (isLoading && meta.total === 0) || (isFiltered && collectionTotal === 0 && !totalFailed);
  const noun = meta.total === 1 ? (includeClosed ? "lead" : "open lead") : includeClosed ? "leads" : "open leads";
  const countLabel = error || totalUnknown
    ? "—"
    : isFiltered && collectionTotal > 0
      ? `${meta.total} of ${collectionTotal} ${collectionTotal === 1 ? (includeClosed ? "lead" : "open lead") : includeClosed ? "leads" : "open leads"}`
      : `${meta.total} ${noun}`;

  // A deep link can arrive already filtered, so no unfiltered response was ever
  // seen — ask the API for the pool total once rather than showing a bare "0".
  useEffect(() => {
    if (requestedTotal.current || collectionTotal > 0 || !isFiltered) return;
    requestedTotal.current = true;
    let cancelled = false;
    void getPool({ page: 1, limit: 1, includeClosed: includeClosed || undefined })
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
  }, [collectionTotal, isFiltered, includeClosed]);

  const selectedCount = selected.size;
  // Closed rows are read-only: never selectable, so bulk claim cannot touch them.
  const claimableItems = items.filter((lead) => !isClosedLead(lead));
  const allSelected = claimableItems.length > 0 && claimableItems.every((lead) => selected.has(lead.lead_id));
  const someSelected = claimableItems.some((lead) => selected.has(lead.lead_id));

  function toggleSort(column: SortKey) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(SORT_INITIAL_DIR[column]);
      return;
    }
    const initial = SORT_INITIAL_DIR[column];
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
    setProductFilter(ALL);
    setIncludeClosed(false);
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
        // Closed rows stay unselected — there is nothing to claim on them.
        if (checked && isClosedLead(lead)) continue;
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
    const targets = items.filter((lead) => selected.has(lead.lead_id) && !isClosedLead(lead));
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
                value={search}
                onChange={(event) => {
                  rememberTotal();
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search leads…"
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
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <StageCombobox
              options={stageOptions}
              value={stageFilter}
              onChange={(selectedValue) => {
                rememberTotal();
                setStageFilter(selectedValue);
                setPage(1);
              }}
              disabled={stagesLoading}
            />
            <ProductCombobox
              options={products}
              value={productFilter}
              onChange={(selectedValue) => {
                rememberTotal();
                setProductFilter(selectedValue);
                setPage(1);
              }}
              disabled={productsLoading}
            />
            <label
              htmlFor="pool-show-closed"
              className="flex h-9 cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-muted-foreground"
            >
              <Checkbox
                id="pool-show-closed"
                checked={includeClosed}
                onCheckedChange={(value) => {
                  rememberTotal();
                  setIncludeClosed(value === true);
                  setPage(1);
                }}
                className="focus-visible:ring-ring"
              />
              Show closed
            </label>
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
                <EmptyDescription>
                  {isActive
                    ? "No lead matches these filters. Clear the search or widen the stage or product filter."
                    : includeClosed
                      ? "Leads appear here as soon as they reach an active stage."
                      : "Open leads appear here as soon as they reach a non-terminal stage."}
                </EmptyDescription>
              </EmptyHeader>
              {isActive ? (
                <EmptyContent>
                  <Button type="button" variant="outline" size="sm" onClick={resetControls}>
                    Reset
                  </Button>
                </EmptyContent>
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
                  const closed = stage ? isTerminalStage(stage) : false;
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
                            disabled={closed}
                            className="mt-1 focus-visible:ring-ring"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span
                            className="block truncate font-medium"
                            title={lead.company_name}
                          >
                            {lead.company_name}
                          </span>{" "}
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
                        </StatusPill>{" "}
                        <StatusPill tone="neutral" className="rounded-full tabular-nums">
                          {lead.claimant_count}
                        </StatusPill>{" "}
                        {lead.claimed_by_me ? <StatusPill tone="info">you</StatusPill> : null}
                      </div>
                      <div className="mt-1 flex justify-end">
                        {closed ? (
                          <span className="text-xs text-muted-foreground">Closed</span>
                        ) : (
                          <Button
                            variant={lead.claimed_by_me ? "outline" : "default"}
                            size="sm"
                            data-no-row-click
                            className="relative z-10 min-h-11 w-full focus-visible:ring-ring"
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
                        )}
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
                          className="focus-visible:ring-ring"
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
                      <TableHead
                        aria-sort={
                          sortKey === "company"
                            ? sortDir === "desc"
                              ? "descending"
                              : "ascending"
                            : "none"
                        }
                      >
                        <SortHeaderButton
                          label="Company"
                          column="company"
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggle={toggleSort}
                        />
                      </TableHead>
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
                      const closed = stage ? isTerminalStage(stage) : false;
                      const pending = pendingId === lead.lead_id;
                      const checked = selected.has(lead.lead_id);
                      const leadHref = `/customer-activation/telemarketing/telemarketing-pipeline/leads/${lead.lead_id}`;
                      return (
                        <TableRow
                          key={lead.lead_id}
                          data-state={checked ? "selected" : undefined}
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
                          <TableCell data-no-row-click>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleOne(lead.lead_id, lead, value === true)}
                              aria-label={`Select ${lead.company_name}`}
                              disabled={closed}
                              className="focus-visible:ring-ring"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">{lead.lead_code}</TableCell>
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
                            <span className="block truncate" title={lead.contact_name ?? undefined}>
                              {lead.contact_name || "—"}
                            </span>{" "}
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
                              {lead.claimant_count}{" "}
                            </StatusPill>
                            {lead.claimed_by_me ? (
                              <StatusPill tone="info" className="ml-2">
                                you
                              </StatusPill>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right" data-no-row-click>
                            {closed ? (
                              <span className="text-xs text-muted-foreground">Closed</span>
                            ) : (
                              <Button
                                variant={lead.claimed_by_me ? "outline" : "default"}
                                size="sm"
                                data-no-row-click
                                className="min-h-11 md:min-h-0 focus-visible:ring-ring"
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
                            )}
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
