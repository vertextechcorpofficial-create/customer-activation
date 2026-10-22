"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Plus, Search, Users } from "lucide-react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
    LeadCreateSchema,
    SOURCE_PAGE_SIZE,
    type ClientOption,
    type SourceRow,
} from "../types/lead.schema";
import { useClients, useClientSource, type ClientSourceKind as SourceKind } from "../hooks/use-sources";
import { createLead } from "../providers/lead-provider";
import { CreateLeadDialog, warnProvenanceOnce, type LeadPrefill } from "./create-lead-dialog";
import { StatusPill } from "./status-pill";

const PAGE_SIZES = [10, 25, 50];

function toPrefill(row: SourceRow, dealerId: number): LeadPrefill {
    return {
        company_name: row.name,
        mobile: row.contact,
        email: row.email,
        address: [row.city, row.province].filter(Boolean).join(", ") || null,
        source: row.source,
        party_kind: row.party_kind,
        party_id: row.party_id,
        dealer_id: dealerId,
    };
}

function locationOf(row: SourceRow): string {
    return [row.city, row.province].filter(Boolean).join(", ") || "—";
}

function rowKey(row: SourceRow): string {
    return `${row.source}-${row.id}`;
}

/**
 * Top-level client selector. Unconnected rows stay visible but disabled —
 * picking them is impossible, hiding them would hide a provisioning problem.
 */
function ClientCombobox({
    clients,
    value,
    onChange,
    isLoading,
    error,
    onRetry,
}: {
    clients: ClientOption[];
    value: number | null;
    onChange: (dealerId: number) => void;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const filtered = q
        ? clients.filter(
              (c) =>
                  c.dealer_name.toLowerCase().includes(q) ||
                  (c.dealer_code ?? "").toLowerCase().includes(q),
          )
        : clients;
    const selected = clients.find((c) => c.dealer_id === value) ?? null;
    const label = selected
        ? selected.dealer_code
            ? `${selected.dealer_name} (${selected.dealer_code})`
            : selected.dealer_name
        : "Select client…";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select client database"
                    disabled={isLoading}
                    className="w-full justify-between font-normal sm:max-w-xs"
                >
                    <span className="min-w-0 flex-1 truncate text-left" title={label}>
                        {isLoading ? "Loading clients…" : label}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search clients…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList className="max-h-64">
                        <CommandEmpty>
                            {isLoading ? (
                                "Loading clients…"
                            ) : error ? (
                                <span className="grid justify-items-center gap-2 py-2">
                                    <span>{error}</span>
                                    <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                                        Retry
                                    </Button>
                                </span>
                            ) : (
                                "No clients found."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {filtered.map((client) => {
                                const unconnected = !client.has_connection;
                                const isSelected = client.dealer_id === value;
                                return (
                                    <CommandItem
                                        key={client.dealer_id}
                                        value={String(client.dealer_id)}
                                        keywords={[client.dealer_name, client.dealer_code ?? ""]}
                                        title={
                                            unconnected
                                                ? `${client.dealer_name} — no database configured`
                                                : client.dealer_name
                                        }
                                        disabled={unconnected}
                                        aria-disabled={unconnected}
                                        onSelect={() => {
                                            if (unconnected) return;
                                            onChange(client.dealer_id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                isSelected ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {client.dealer_name}
                                            {client.dealer_code ? (
                                                <span className="text-muted-foreground">
                                                    {" "}
                                                    · {client.dealer_code}
                                                </span>
                                            ) : null}
                                        </span>
                                        {client.is_default ? (
                                            <StatusPill tone="neutral">Default</StatusPill>
                                        ) : null}
                                        {unconnected ? (
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                no database configured
                                            </span>
                                        ) : null}
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

/**
 * Database browser for one `ok` result: checkbox selection (page-scoped
 * select-all), sequential bulk create with a partial-failure summary, and
 * server pagination over the live `filter_count` total.
 */
function SourceTable({
    kind,
    rows,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    isLoading,
    dealerId,
    onCreate,
}: {
    kind: SourceKind;
    rows: SourceRow[];
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    isLoading: boolean;
    dealerId: number;
    onCreate: (row: SourceRow) => void;
}) {
    const [selected, setSelected] = useState<Map<string, SourceRow>>(new Map());
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkDone, setBulkDone] = useState(0);
    const [bulkTotal, setBulkTotal] = useState(0);
    const [lastSummary, setLastSummary] = useState<string | null>(null);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);

    const selectedCount = selected.size;
    const allSelected = rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));
    const someSelected = rows.some((row) => selected.has(rowKey(row)));

    function toggleOne(key: string, row: SourceRow, checked: boolean) {
        setSelected((prev) => {
            const next = new Map(prev);
            if (checked) next.set(key, row);
            else next.delete(key);
            return next;
        });
    }

    function toggleAll(checked: boolean) {
        setSelected((prev) => {
            const next = new Map(prev);
            for (const row of rows) {
                if (checked) next.set(rowKey(row), row);
                else next.delete(rowKey(row));
            }
            return next;
        });
    }

    // Sequential so one duplicate never aborts the rest; the summary — not
    // the first failure — is the outcome.
    async function runBulk() {
        const targets = [...selected.values()];
        if (targets.length === 0 || bulkRunning) return;
        setBulkRunning(true);
        setBulkDone(0);
        setBulkTotal(targets.length);
        setLastSummary(null);
        let created = 0;
        let duplicates = 0;
        let failed = 0;
        for (const row of targets) {
            const parsed = LeadCreateSchema.safeParse({
                source: row.source,
                party_kind: row.party_kind,
                party_id: row.party_id,
                company_name: row.name,
                contact_name: null,
                mobile: row.contact,
                email: row.email,
                address: [row.city, row.province].filter(Boolean).join(", ") || null,
                dealer_id: dealerId,
            });
            if (!parsed.success) {
                failed += 1;
            } else {
                try {
                    const outcome = await createLead(parsed.data);
                    if (outcome.duplicate) duplicates += 1;
                    else {
                        created += 1;
                        if (!outcome.provenance_recorded) warnProvenanceOnce();
                    }
                } catch {
                    failed += 1;
                }
            }
            setBulkDone((d) => d + 1);
        }
        setBulkRunning(false);
        const summary = `${created} created · ${duplicates} skipped as duplicate · ${failed} failed`;
        setLastSummary(summary);
        if (failed > 0) toast.error("Bulk create finished with failures", { description: summary });
        else toast.success("Bulk create finished", { description: summary });
        setSelected(new Map());
    }

    return (
        <div className="grid gap-2">
            {selectedCount > 0 ? (
                <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    aria-live="polite"
                >
                    <p className="text-sm text-muted-foreground">
                        {selectedCount} selected
                        {bulkRunning ? ` · creating ${bulkDone} of ${bulkTotal}…` : ""}
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
                            onClick={() => void runBulk()}
                            disabled={bulkRunning}
                            aria-label={`Create leads for ${selectedCount} selected row${selectedCount === 1 ? "" : "s"}`}
                        >
                            {bulkRunning
                                ? `Creating ${bulkDone} of ${bulkTotal}…`
                                : `Create ${selectedCount} lead${selectedCount === 1 ? "" : "s"}`}
                        </Button>
                    </div>
                </div>
            ) : null}
            {lastSummary ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    Last bulk run: {lastSummary}
                </p>
            ) : null}

            {/* Cards below sm — the table would clip columns at 390px. */}
            <ul className="grid gap-2 sm:hidden">
                {rows.map((row) => {
                    const key = rowKey(row);
                    const checked = selected.has(key);
                    return (
                        <li key={key} className="grid gap-1 rounded-md border p-3">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleOne(key, row, v === true)}
                                    aria-label={`Select ${row.name}`}
                                    className="mt-1"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium" title={row.name}>
                                        {row.name}
                                    </p>
                                    {row.code ? (
                                        <p
                                            className="truncate font-mono text-xs text-muted-foreground"
                                            title={row.code}
                                        >
                                            {row.code}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <p
                                className="truncate text-sm text-muted-foreground"
                                title={row.contact ?? row.email ?? "—"}
                            >
                                {row.contact ?? row.email ?? "—"}
                            </p>
                            <p
                                className="truncate text-xs text-muted-foreground"
                                title={locationOf(row)}
                            >
                                {locationOf(row)}
                            </p>
                            <div className="mt-1 flex justify-end">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="min-h-11"
                                    aria-label={`Create lead for ${row.name}`}
                                    onClick={() => onCreate(row)}
                                >
                                    <Plus className="size-4" aria-hidden />
                                    Create lead
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="hidden overflow-x-auto rounded-md border sm:block">
                    <table className="w-full caption-bottom text-sm min-w-[760px]">
                        <TableHeader className="bg-muted">
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                        onCheckedChange={(v) => toggleAll(v === true || v === "indeterminate")}
                                        aria-label="Select all rows on this page"
                                    />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const key = rowKey(row);
                                const checked = selected.has(key);
                                return (
                                    <TableRow key={key} data-state={checked ? "selected" : undefined}>
                                        <TableCell>
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(v) => toggleOne(key, row, v === true)}
                                                aria-label={`Select ${row.name}`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-44 truncate font-medium"
                                                title={row.name}
                                            >
                                                {row.name}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-32 truncate font-mono text-muted-foreground"
                                                title={row.code ?? "—"}
                                            >
                                                {row.code ?? "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-36 truncate text-muted-foreground"
                                                title={row.contact ?? "—"}
                                            >
                                                {row.contact ?? "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-44 truncate text-muted-foreground"
                                                title={row.email ?? "—"}
                                            >
                                                {row.email ?? "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-36 truncate text-muted-foreground"
                                                title={locationOf(row)}
                                            >
                                                {locationOf(row)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                aria-label={`Create lead for ${row.name}`}
                                                onClick={() => onCreate(row)}
                                            >
                                                <Plus className="size-4" aria-hidden />
                                                Create lead
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
                    {from}–{to} of {total}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label
                        htmlFor={`page-size-${kind}`}
                        className="text-sm text-muted-foreground"
                    >
                        Rows per page
                    </label>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) => onPageSizeChange(Number(v))}
                        disabled={isLoading || bulkRunning}
                    >
                        <SelectTrigger
                            id={`page-size-${kind}`}
                            size="sm"
                            className="w-20"
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
                    {pageCount > 1 ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-h-11 md:min-h-0"
                                disabled={safePage <= 1 || isLoading}
                                onClick={() => onPageChange(safePage - 1)}
                            >
                                <ChevronLeft className="size-4" aria-hidden />
                                Previous
                            </Button>
                            <span className="text-sm tabular-nums text-muted-foreground">
                                Page {safePage} of {pageCount}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-h-11 md:min-h-0"
                                disabled={safePage >= pageCount || isLoading}
                                onClick={() => onPageChange(safePage + 1)}
                            >
                                Next
                                <ChevronRight className="size-4" aria-hidden />
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function PanelSkeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div className="grid gap-2" aria-live="polite" aria-busy="true">
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
            ))}
        </div>
    );
}

function UnavailablePanel({
    title,
    detail,
    onRetry,
}: {
    title: string;
    detail: string;
    onRetry?: () => void;
}) {
    return (
        <div className="grid gap-2 rounded-md border p-4" role="alert">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
            {onRetry ? (
                <div>
                    <Button size="sm" variant="outline" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

/**
 * One client-scoped tab. Branches explicitly on the discriminated result —
 * `empty` and `unavailable` are never rendered as "no rows".
 */
function SourcePanel({
    kind,
    dealerId,
    search,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    onCreate,
}: {
    kind: SourceKind;
    dealerId: number;
    search: string;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onCreate: (row: SourceRow) => void;
}) {
    const { result, isLoading, error, refresh } = useClientSource(
        kind,
        dealerId,
        search,
        page,
        pageSize,
    );
    const nouns = kind === "customer" ? "customers" : "prospects";
    const emptyTitle =
        kind === "customer"
            ? "No customers yet in this database"
            : "No prospects yet in this database";

    // A narrowed search can strand the tab past its last page — clamp back.
    const total = result?.status === "ok" ? result.total : 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    useEffect(() => {
        if (page > pageCount) onPageChange(pageCount);
    }, [page, pageCount, onPageChange]);

    if (result?.status === "ok") {
        // Stale-while-revalidate: the hook keeps the previous result during a
        // refetch, so the table never blanks. An out-of-range page briefly
        // yields zero rows for a live total — wait for the clamp above.
        if (result.rows.length === 0 && result.total > 0) return <PanelSkeleton rows={pageSize} />;
        return (
            <SourceTable
                key={`${kind}-${dealerId}-${search}-${pageSize}`}
                kind={kind}
                rows={result.rows}
                total={result.total}
                page={page}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                isLoading={isLoading}
                dealerId={dealerId}
                onCreate={onCreate}
            />
        );
    }
    if (result?.status === "empty") {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Users className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>{emptyTitle}</EmptyTitle>
                    <EmptyDescription>
                        This database is connected — it just holds no {nouns} for this
                        search yet.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }
    if (result?.status === "unavailable") {
        if (result.reason === "forbidden") {
            return (
                <UnavailablePanel
                    title={`This database does not grant access to its ${nouns} table.`}
                    detail={result.detail}
                />
            );
        }
        if (result.reason === "not_found") {
            return (
                <UnavailablePanel
                    title={`This database has not been provisioned for ${nouns} yet.`}
                    detail={result.detail}
                />
            );
        }
        return (
            <UnavailablePanel
                title="This database could not be reached"
                detail={result.detail}
                onRetry={() => void refresh()}
            />
        );
    }
    // Transport failure with nothing cached — the only error-as-alert case.
    if (error) {
        return (
            <Alert variant="destructive" className="flex items-center justify-between gap-3">
                <AlertDescription>{error}</AlertDescription>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                    Retry
                </Button>
            </Alert>
        );
    }
    return <PanelSkeleton rows={pageSize} />;
}

export function LeadGenerationTabs() {
    const router = useRouter();
    const pathname = usePathname();
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 300);
    const [pageSize, setPageSize] = useState<number>(SOURCE_PAGE_SIZE);
    const [customerPage, setCustomerPage] = useState(1);
    const [prospectingPage, setProspectingPage] = useState(1);
    // Read once on mount so a reload keeps the picked database.
    const [dealerId, setDealerId] = useState<number | null>(() => {
        if (typeof window === "undefined") return null;
        const n = Number(new URLSearchParams(window.location.search).get("client"));
        return Number.isInteger(n) && n > 0 ? n : null;
    });
    const [prefill, setPrefill] = useState<LeadPrefill | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const { clients, isLoading: clientsLoading, error: clientsError, refresh: refreshClients } =
        useClients();

    const writeClientParam = useCallback(
        (id: number | null) => {
            const params = new URLSearchParams(window.location.search);
            if (id === null) params.delete("client");
            else params.set("client", String(id));
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router],
    );

    // Resolved selection: the picked client while it stays connected, else the
    // default client, else the first connected one. An invalid, stale, or
    // unconnected pick (including the mount-time URL value) falls back here —
    // render-time adjustment, the sanctioned reset-on-key-change shape.
    const selectable = clientsLoading ? null : clients.filter((c) => c.has_connection);
    const resolved =
        selectable === null
            ? undefined
            : selectable.some((c) => c.dealer_id === dealerId)
              ? dealerId
              : ((selectable.find((c) => c.is_default) ?? selectable[0])?.dealer_id ?? null);
    if (resolved !== undefined && resolved !== dealerId) {
        setDealerId(resolved);
        setCustomerPage(1);
        setProspectingPage(1);
    }

    // Keep `?client=` reflecting the resolved selection. External sync only
    // (URL write) — no setState, so no cascading render.
    useEffect(() => {
        if (resolved === undefined) return;
        const params = new URLSearchParams(window.location.search);
        const current = params.get("client");
        const want = resolved === null ? null : String(resolved);
        if (current === want) return;
        writeClientParam(resolved);
    }, [resolved, writeClientParam]);

    // A new settled search starts both tabs back on the first page (render-time
    // adjustment, not an effect — the sanctioned reset-on-key-change shape).
    const [lastSearch, setLastSearch] = useState(debouncedSearch);
    if (debouncedSearch !== lastSearch) {
        setLastSearch(debouncedSearch);
        setCustomerPage(1);
        setProspectingPage(1);
    }

    function pickClient(id: number) {
        setDealerId(id);
        setCustomerPage(1);
        setProspectingPage(1);
        writeClientParam(id);
    }

    function changePageSize(size: number) {
        setPageSize(size);
        setCustomerPage(1);
        setProspectingPage(1);
    }

    function openFor(row: SourceRow) {
        if (dealerId === null) return;
        setPrefill(toPrefill(row, dealerId));
        setDialogOpen(true);
    }

    function openBlank(source: LeadPrefill["source"]) {
        if (dealerId === null) return;
        setPrefill({ company_name: "", source, party_kind: "none", party_id: null, dealer_id: dealerId });
        setDialogOpen(true);
    }

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, code, contact…"
                        aria-label="Search sources"
                        className="pl-8"
                    />
                </div>
                <ClientCombobox
                    clients={clients}
                    value={resolved ?? null}
                    onChange={pickClient}
                    isLoading={clientsLoading}
                    error={clientsError}
                    onRetry={() => void refreshClients()}
                />
            </div>

            {clientsLoading ? (
                <PanelSkeleton rows={pageSize} />
            ) : clientsError && clients.length === 0 ? (
                <Alert variant="destructive" className="flex items-center justify-between gap-3">
                    <AlertDescription>{clientsError}</AlertDescription>
                    <Button size="sm" variant="outline" onClick={() => void refreshClients()}>
                        Retry
                    </Button>
                </Alert>
            ) : resolved == null ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Users className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle>No client databases are configured</EmptyTitle>
                        <EmptyDescription>
                            Connect a client database before browsing customer or prospect
                            records.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <Tabs defaultValue="customer">
                    <TabsList>
                        <TabsTrigger value="customer" className="min-h-11 md:min-h-0">
                            Customer
                        </TabsTrigger>
                        <TabsTrigger value="prospecting" className="min-h-11 md:min-h-0">
                            Prospecting
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="customer" className="grid gap-2">
                        <SourcePanel
                            kind="customer"
                            dealerId={resolved}
                            search={debouncedSearch}
                            page={customerPage}
                            pageSize={pageSize}
                            onPageChange={setCustomerPage}
                            onPageSizeChange={changePageSize}
                            onCreate={openFor}
                        />
                    </TabsContent>
                    <TabsContent value="prospecting" className="grid gap-2">
                        <div className="flex justify-end">
                            <Button size="sm" onClick={() => openBlank("prospecting")}>
                                <Plus className="size-4" aria-hidden />
                                Add prospect
                            </Button>
                        </div>
                        <SourcePanel
                            kind="prospecting"
                            dealerId={resolved}
                            search={debouncedSearch}
                            page={prospectingPage}
                            pageSize={pageSize}
                            onPageChange={setProspectingPage}
                            onPageSizeChange={changePageSize}
                            onCreate={openFor}
                        />
                    </TabsContent>
                </Tabs>
            )}

            <CreateLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} prefill={prefill} />
        </div>
    );
}
