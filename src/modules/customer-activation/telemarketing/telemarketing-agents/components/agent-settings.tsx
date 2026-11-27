"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
    AlertTriangle,
    Check,
    ChevronsUpDown,
    Loader2,
    MoreHorizontal,
    Plus,
    PowerOff,
    Search,
    SearchX,
    UserPlus,
} from "lucide-react";
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
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentsListShell } from "./agents-list-shell";
import { StatusPill } from "./status-pill";
import { Switch } from "@/components/ui/switch";
import type { UserOption } from "../types/agent.schema";
import type { AgentView } from "../services/agent-service";
import type { AgentStatusFilter } from "../providers/agent-provider";
import { useAgents } from "../hooks/use-agents";
import { useUserOptions } from "../hooks/use-user-options";

const DEFAULT_PAGE_SIZE = 10;

const flagOn = (v: AgentView["is_active"]) => Number(v) === 1;

/** Row clicks must ignore interactive elements and portalled menus. */
function isRowClickIgnored(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.closest(
            "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
        ) !== null
    );
}

function AgentStatus({ agent }: { agent: AgentView }) {
    return flagOn(agent.is_active) ? (
        <StatusPill tone="success">Active</StatusPill>
    ) : (
        <StatusPill tone="neutral">Inactive</StatusPill>
    );
}

function AgentRowMenu({
    agent,
    onEdit,
    onDeactivate,
}: {
    agent: AgentView;
    onEdit: (agent: AgentView) => void;
    onDeactivate: (agent: AgentView) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    data-no-row-click
                    aria-label={`Actions for ${agent.display_name}`}
                >
                    <MoreHorizontal className="size-4" aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(agent)}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!flagOn(agent.is_active)}
                    onClick={() => onDeactivate(agent)}
                >
                    Deactivate
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface FormState {
    display_name: string;
    daily_call_target: string;
    is_active: boolean;
}

type FormErrors = Partial<Record<"user_id" | keyof FormState, string>>;

const EMPTY_FORM: FormState = { display_name: "", daily_call_target: "", is_active: true };

/**
 * Single-user picker. The option list is a portalled `PopoverContent`, so
 * opening it adds zero layout height to the dialog it sits in. Because it
 * lands outside the dialog's DOM, `DialogContent` ignores pointer-down events
 * that originate inside `[data-user-picker]`; without that the dialog would
 * treat every pick as an outside click and close.
 */
function UserCombobox({
    value,
    onPick,
    error,
}: {
    value: UserOption | null;
    onPick: (user: UserOption) => void;
    error?: string;
}) {
    const panelId = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlighted, setHighlighted] = useState("");
    const { options, isSearching, isLoadingMore, loadMore } = useUserOptions(search, open);

    // Derived, not stored: the highlight always points at a row that exists,
    // so plain Enter selects what the list actually shows (the first match
    // when the previous highlight is gone).
    const activeUserId =
        highlighted && options.some((user) => String(user.user_id) === highlighted)
            ? highlighted
            : options[0]
              ? String(options[0].user_id)
              : "";

    const pick = (userId: string) => {
        const user = options.find((option) => String(option.user_id) === userId) ?? options[0];
        if (!user) return;
        onPick(user);
        setOpen(false);
    };

    return (
        <div className="grid gap-2">
            <Label>
                User <span className="text-destructive">*</span>
            </Label>
            <Popover open={open} onOpenChange={setOpen} modal>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={open ? panelId : undefined}
                        className="w-full justify-between font-normal"
                    >
                        <span className="min-w-0 flex-1 truncate text-left" title={value ? `${value.name} — ${value.email}` : undefined}>
                            {value ? value.name : "Search users…"}
                        </span>
                        {isSearching ? (
                            <Loader2 className="size-4 shrink-0 animate-spin opacity-50" />
                        ) : (
                            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={4}
                    data-user-picker
                    className="pointer-events-auto w-[var(--radix-popover-trigger-width)] p-0"
                >
                    <Command
                        id={panelId}
                        shouldFilter={false}
                        value={activeUserId}
                        onValueChange={setHighlighted}
                    >
                        <CommandInput
                            placeholder="Type a name or email…"
                            value={search}
                            onValueChange={setSearch}
                            autoFocus
                            onKeyDown={(event) => {
                                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                                // cmdk only selects on Enter once an item is
                                // highlighted; plain Enter must select too.
                                event.preventDefault();
                                event.stopPropagation();
                                pick(activeUserId);
                            }}
                        />
                        <CommandList
                            className="max-h-56"
                            aria-busy={isSearching || isLoadingMore}
                            onScroll={(event) => {
                                const list = event.currentTarget;
                                if (list.scrollHeight - list.scrollTop - list.clientHeight < 48) loadMore();
                            }}
                        >
                            {options.length === 0 ? (
                                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                    {isSearching ? "Searching users…" : "No users found."}
                                </div>
                            ) : (
                                <CommandGroup>
                                    {options.map((user) => {
                                        const label = user.email ? `${user.name} — ${user.email}` : user.name;
                                        return (
                                            <CommandItem
                                                key={user.user_id}
                                                value={String(user.user_id)}
                                                title={label}
                                                onSelect={() => pick(String(user.user_id))}
                                            >
                                                <Check
                                                    className={
                                                        value?.user_id === user.user_id
                                                            ? "size-4 shrink-0 opacity-100"
                                                            : "size-4 shrink-0 opacity-0"
                                                    }
                                                />
                                                <span className="min-w-0 flex-1 truncate">{label}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            )}
                            {isLoadingMore ? (
                                <p className="px-3 py-2 text-center text-xs text-muted-foreground" role="status">
                                    Loading more…
                                </p>
                            ) : null}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {error && (
                <p className="flex items-start gap-1 text-xs text-foreground">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                    {error}
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                Registration links an existing user — it never creates one.
            </p>
        </div>
    );
}

export function AgentSettings() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<AgentStatusFilter>("all");
    const { agents, total, isLoading, error, refresh, registerAgent, updateAgent, deactivateAgent } =
        useAgents({ page, limit: pageSize, search, status });
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; agent: AgentView } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState<AgentView | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    // The header talks about the collection, not the filter, so a no-match
    // search reads "0 of 4 agents" instead of claiming the list is empty.
    const [collectionTotal, setCollectionTotal] = useState(0);
    const isFiltered = search.trim() !== "" || status !== "all";
    const countLabel = error
        ? "—"
        : isFiltered
          ? `${total} of ${collectionTotal} ${collectionTotal === 1 ? "agent" : "agents"}`
          : `${total} ${total === 1 ? "agent" : "agents"}`;

    const openCreate = () => {
        setForm({ ...EMPTY_FORM });
        setErrors({});
        setSelectedUser(null);
        setDialog({ mode: "create" });
    };

    const openEdit = (agent: AgentView) => {
        setForm({
            display_name: agent.display_name,
            daily_call_target: agent.daily_call_target == null ? "" : String(agent.daily_call_target),
            is_active: flagOn(agent.is_active),
        });
        setErrors({});
        setDialog({ mode: "edit", agent });
    };

    const columns: ColumnDef<AgentView, unknown>[] = [
        {
            accessorKey: "agent_code",
            header: "Code",
            cell: ({ row }) => (
                <span className="block max-w-40 truncate font-mono text-xs tabular-nums" title={row.original.agent_code}>
                    {row.original.agent_code}
                </span>
            ),
        },
        {
            accessorKey: "display_name",
            header: "Name",
            cell: ({ row }) => (
                <span className="block max-w-64 truncate font-medium" title={row.original.display_name}>
                    {row.original.display_name}
                </span>
            ),
        },
        {
            accessorKey: "user_email",
            header: "User email",
            cell: ({ row }) => (
                <span
                    className="block max-w-56 truncate text-muted-foreground"
                    title={row.original.user_email ?? undefined}
                >
                    {row.original.user_email ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "daily_call_target",
            header: () => <span className="block text-right">Daily target</span>,
            cell: ({ row }) => (
                <span className="block text-right tabular-nums">
                    {row.original.daily_call_target ?? "—"}
                </span>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) => <AgentStatus agent={row.original} />,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <AgentRowMenu
                    agent={row.original}
                    onEdit={openEdit}
                    onDeactivate={setConfirmDeactivate}
                />
            ),
        },
    ];

    // The shared table owns its rows, so whole-row edit affordance is enhanced
    // in place: rows are matched back to agents by their unique agent code.
    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const matchAgent = (row: Element): AgentView | undefined => {
            const code = row.querySelector("td")?.textContent?.trim() ?? "";
            if (!code) return undefined;
            return agents.find((agent) => agent.agent_code === code);
        };
        const enhanceRows = () => {
            root.querySelectorAll("tbody tr").forEach((tr) => {
                const rowEl = tr as HTMLElement;
                // Skip the empty-state row: it spans every column.
                if (tr.querySelector("td[colspan], td[colSpan]")) return;
                const agent = matchAgent(tr);
                if (!agent) return;
                if (rowEl.getAttribute("tabindex") !== "0") rowEl.setAttribute("tabindex", "0");
                if (rowEl.getAttribute("role") !== "button") rowEl.setAttribute("role", "button");
                const label = `Edit ${agent.display_name}`;
                if (rowEl.getAttribute("aria-label") !== label) rowEl.setAttribute("aria-label", label);
                if (!rowEl.classList.contains("cursor-pointer")) {
                    rowEl.classList.add(
                        "cursor-pointer",
                        "focus-visible:ring-2",
                        "focus-visible:ring-ring/50",
                    );
                }
            });
        };
        enhanceRows();
        const observer = new MutationObserver(enhanceRows);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [agents]);

    const handleRowClick = (event: React.MouseEvent) => {
        if (isRowClickIgnored(event.target)) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row || row.querySelector("td[colspan], td[colSpan]")) return;
        const code = row.querySelector("td")?.textContent?.trim() ?? "";
        const agent = agents.find((a) => a.agent_code === code);
        if (agent) openEdit(agent);
    };

    const handleRowKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (isRowClickIgnored(event.target)) return;
        const row = (event.target as HTMLElement).closest("tbody tr");
        if (!row || event.target !== row) return;
        if (event.key === " ") event.preventDefault();
        const code = row.querySelector("td")?.textContent?.trim() ?? "";
        const agent = agents.find((a) => a.agent_code === code);
        if (agent) openEdit(agent);
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

    const validate = (): boolean => {
        const next: FormErrors = {};
        if (dialog?.mode === "create" && !selectedUser) next.user_id = "Pick a user to register.";
        if (!form.display_name.trim()) next.display_name = "Enter a display name.";
        if (form.daily_call_target.trim()) {
            const n = Number(form.daily_call_target);
            if (!Number.isInteger(n) || n < 0) next.daily_call_target = "Enter a whole number, 0 or more.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!dialog || submitting || !validate()) return;
        setSubmitting(true);
        const target = form.daily_call_target.trim();
        const ok =
            dialog.mode === "create"
                ? await registerAgent({
                    user_id: selectedUser!.user_id,
                    display_name: form.display_name.trim(),
                    daily_call_target: target === "" ? null : Number(target),
                })
                : await updateAgent(dialog.agent.agent_id, {
                    display_name: form.display_name.trim(),
                    daily_call_target: target === "" ? null : Number(target),
                    is_active: form.is_active,
                });
        setSubmitting(false);
        if (ok) setDialog(null);
    };

    const handleDeactivate = async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        if (!confirmDeactivate || deactivating) return;
        setDeactivating(true);
        const ok = await deactivateAgent(confirmDeactivate.agent_id);
        setDeactivating(false);
        if (ok) setConfirmDeactivate(null);
    };

    const showEmpty = !isLoading && !error && agents.length === 0;

    const handleStatusChange = (next: AgentStatusFilter) => {
        // Remember the unfiltered total as the filter first hides the list,
        // so the header can say "0 of 4 agents" instead of "0 agents".
        if (status === "all" && next !== "all" && search.trim() === "") setCollectionTotal(total);
        setStatus(next);
        setPage(1);
    };

    const searchControl = (
        <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
            <Input
                value={search}
                onChange={(event) => {
                    const value = event.target.value;
                    // Remember the unfiltered total as the filter first hides the list,
                    // so the header can say "0 of 4 agents" instead of "0 agents".
                    if (search.trim() === "" && value.trim() !== "") setCollectionTotal(total);
                    setSearch(value);
                    setPage(1);
                }}
                placeholder="Search agents..."
                aria-label="Search agents"
                className="w-full min-w-0 pl-8"
            />
        </div>
    );

    const statusControl = (
        <Select value={status} onValueChange={(value) => handleStatusChange(value as AgentStatusFilter)}>
            <SelectTrigger className="w-[120px] shrink-0 sm:w-[130px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
        </Select>
    );

    const filterControls = (
        <>
            {searchControl}
            {statusControl}
        </>
    );

    const registerAction = (
        <Button onClick={openCreate} className="min-h-11 shrink-0 sm:min-h-0">
            <Plus className="size-4" aria-hidden />
            Register agent
        </Button>
    );

    const mobileCards =
        isLoading ? (
            <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        ) : agents.length === 0 ? null : (
            <ul className="divide-y divide-border">
                {agents.map((agent) => (
                    <li
                        key={agent.agent_id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit ${agent.display_name}`}
                        onClick={(event) => {
                            if (isRowClickIgnored(event.target)) return;
                            openEdit(agent);
                        }}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ")
                                return;
                            if (isRowClickIgnored(event.target)) return;
                            event.preventDefault();
                            openEdit(agent);
                        }}
                        className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <div className="min-w-0">
                            <p className="truncate font-medium" title={agent.display_name}>
                                {agent.display_name}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground" title={agent.agent_code}>
                                {agent.agent_code}
                            </p>
                            {agent.user_email && (
                                <p className="truncate text-xs text-muted-foreground" title={agent.user_email}>
                                    {agent.user_email}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground tabular-nums">
                                Target {agent.daily_call_target ?? "—"}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <AgentStatus agent={agent} />
                            <AgentRowMenu
                                agent={agent}
                                onEdit={openEdit}
                                onDeactivate={setConfirmDeactivate}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        );

    return (
        <div className="mx-auto w-full max-w-screen-2xl space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agents</h1>
                        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                            {countLabel}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Telesales agents who can be assigned leads.
                    </p>
                </div>
                {registerAction}
            </header>
            <div ref={listRef} onClick={handleRowClick} onKeyDown={handleRowKeyDown}>
                {showEmpty ? (
                    <Card className="gap-0 overflow-hidden rounded-2xl border-border/50 py-0 shadow-sm">
                        <CardContent className="p-6">
                            {search.trim() !== "" ? (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <SearchX />
                                        </EmptyMedia>
                                        <EmptyTitle>No agents match “{search.trim()}”</EmptyTitle>
                                        <EmptyDescription>
                                            Check the spelling, or clear the search to see every agent.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSearch("");
                                                setPage(1);
                                            }}
                                        >
                                            Clear search
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            ) : status !== "all" ? (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <SearchX />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            No {status === "active" ? "active" : "inactive"} agents
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            Nothing in this status. Clear the filter to see every agent.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setStatus("all");
                                                setPage(1);
                                            }}
                                        >
                                            Clear filter
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            ) : (
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <UserPlus />
                                        </EmptyMedia>
                                        <EmptyTitle>No agents yet</EmptyTitle>
                                        <EmptyDescription>
                                            Register an existing user to start assigning telemarketing work.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Button onClick={openCreate} className="min-h-11 md:min-h-0">
                                            <Plus className="size-4" />
                                            Register agent
                                        </Button>
                                    </EmptyContent>
                                </Empty>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <AgentsListShell
                        columns={columns}
                        data={agents}
                        isLoading={isLoading}
                        error={error}
                        onRefresh={() => void refresh()}
                        filters={filterControls}
                        cards={mobileCards}
                        emptyTitle="No agents yet"
                        emptyDescription="Register an existing user to start assigning telemarketing work."
                        pageCount={pageCount}
                        pagination={{ pageIndex: page - 1, pageSize }}
                        onPaginationChange={({ pageIndex, pageSize: nextSize }) => {
                            if (nextSize !== pageSize) {
                                setPageSize(nextSize);
                                setPage(1);
                            } else {
                                setPage(pageIndex + 1);
                            }
                        }}
                    />
                )}
            </div>

            <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent
                    className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg"
                    onPointerDownOutside={(event) => {
                        // The user picker floats in a portal outside this
                        // content; its clicks are not dismissals.
                        const target = event.target;
                        if (target instanceof Element && target.closest("[data-user-picker]")) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="line-clamp-1">
                            {dialog?.mode === "edit" ? "Edit agent" : "Register agent"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "edit"
                                ? "Change the display name, daily call target or whether the agent is active."
                                : "Link an existing user as a telemarketing agent."}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit}
                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
                            {dialog?.mode === "create" && (
                                <UserCombobox
                                    value={selectedUser}
                                    error={errors.user_id}
                                    onPick={(user) => {
                                        setSelectedUser(user);
                                        setErrors((prev) => ({ ...prev, user_id: undefined }));
                                        setForm((prev) =>
                                            prev.display_name.trim() ? prev : { ...prev, display_name: user.name },
                                        );
                                    }}
                                />
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="agent-name">
                                    Display name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="agent-name"
                                    value={form.display_name}
                                    onChange={(e) => setField("display_name", e.target.value)}
                                    placeholder="e.g. Maria Santos"
                                    maxLength={191}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.display_name)}
                                    aria-describedby={errors.display_name ? "agent-name-error" : undefined}
                                />
                                {errors.display_name && (
                                    <p
                                        id="agent-name-error"
                                        className="flex items-start gap-1 text-xs text-foreground"
                                    >
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                                        {errors.display_name}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="agent-target">Daily call target</Label>
                                <Input
                                    id="agent-target"
                                    value={form.daily_call_target}
                                    onChange={(e) => setField("daily_call_target", e.target.value)}
                                    placeholder="e.g. 40"
                                    inputMode="numeric"
                                    aria-invalid={Boolean(errors.daily_call_target)}
                                    aria-describedby={errors.daily_call_target ? "agent-target-error" : undefined}
                                />
                                {errors.daily_call_target && (
                                    <p
                                        id="agent-target-error"
                                        className="flex items-start gap-1 text-xs text-foreground"
                                    >
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                                        {errors.daily_call_target}
                                    </p>
                                )}
                            </div>
                            {dialog?.mode === "edit" && (
                                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                    <div className="grid gap-0.5">
                                        <Label htmlFor="agent-active">Active</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Inactive agents stop receiving new work. Past leads and
                                            activities stay linked.
                                        </p>
                                    </div>
                                    <Switch
                                        id="agent-active"
                                        checked={form.is_active}
                                        onCheckedChange={(checked) => setField("is_active", checked)}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={submitting}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="size-4 animate-spin" />}
                                {dialog?.mode === "edit" ? "Save changes" : "Register agent"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={confirmDeactivate !== null}
                onOpenChange={(open) => !open && setConfirmDeactivate(null)}
            >
                <AlertDialogContent size="sm" className="w-[95vw] rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate agent?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDeactivate
                                ? `"${confirmDeactivate.display_name}" stops receiving new work. Past leads and activities stay linked. You can turn the agent back on from Edit.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deactivating}
                            onClick={(e) => void handleDeactivate(e)}
                        >
                            {deactivating ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <PowerOff className="size-4" />
                            )}
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
