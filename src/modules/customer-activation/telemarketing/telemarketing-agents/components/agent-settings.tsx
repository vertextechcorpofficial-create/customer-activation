"use client";

import { useState, type FormEvent } from "react";
import {
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Loader2,
    Pencil,
    Plus,
    PowerOff,
    RefreshCw,
    Search,
    UserPlus,
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
    Command,
    CommandEmpty,
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
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContentInDialog, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { UserOption } from "../types/agent.schema";
import type { AgentView } from "../services/agent-service";
import { useAgents } from "../hooks/use-agents";
import { useUserOptions } from "../hooks/use-user-options";

const PAGE_SIZE = 10;

const flagOn = (v: AgentView["is_active"]) => Number(v) === 1;

function AgentStatus({ agent }: { agent: AgentView }) {
    return flagOn(agent.is_active) ? (
        <StatusBadge tone="info">Active</StatusBadge>
    ) : (
        <StatusBadge tone="neutral">Inactive</StatusBadge>
    );
}

function AgentActions({
    agent,
    onEdit,
    onDeactivate,
}: {
    agent: AgentView;
    onEdit: (agent: AgentView) => void;
    onDeactivate: (agent: AgentView) => void;
}) {
    return (
        <div className="flex items-center justify-center gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${agent.display_name}`}
                title="Edit agent"
                onClick={() => onEdit(agent)}
            >
                <Pencil className="size-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Deactivate ${agent.display_name}`}
                title="Deactivate agent"
                disabled={!flagOn(agent.is_active)}
                onClick={() => onDeactivate(agent)}
            >
                <PowerOff className="size-4" />
            </Button>
        </div>
    );
}

interface FormState {
    display_name: string;
    daily_call_target: string;
}

type FormErrors = Partial<Record<"user_id" | keyof FormState, string>>;

const EMPTY_FORM: FormState = { display_name: "", daily_call_target: "" };

function UserCombobox({
    value,
    onPick,
    error,
}: {
    value: UserOption | null;
    onPick: (user: UserOption) => void;
    error?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const { options, isSearching } = useUserOptions(search, open);

    return (
        <div className="grid gap-2">
            <Label>
                User <span className="text-destructive">*</span>
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
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
                <PopoverContentInDialog className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Type a name or email…"
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList className="max-h-64">
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((user) => {
                                    const label = user.email ? `${user.name} — ${user.email}` : user.name;
                                    return (
                                        <CommandItem
                                            key={user.user_id}
                                            value={String(user.user_id)}
                                            title={label}
                                            onSelect={() => {
                                                onPick(user);
                                                setOpen(false);
                                            }}
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
                        </CommandList>
                    </Command>
                </PopoverContentInDialog>
            </Popover>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
                Registration links an existing user — it never creates one.
            </p>
        </div>
    );
}

export function AgentSettings() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const { agents, total, isLoading, error, refresh, registerAgent, updateAgent, deactivateAgent } =
        useAgents({ page, limit: PAGE_SIZE, search });
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; agent: AgentView } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState<AgentView | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);

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
        });
        setErrors({});
        setDialog({ mode: "edit", agent });
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

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Agents</h1>
                    <p className="text-sm text-muted-foreground">
                        Register existing users as telemarketing agents. Users themselves are never created here.
                    </p>
                </div>
                <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
                    <Plus className="size-4" />
                    Register agent
                </Button>
            </header>

            <div className="relative w-full sm:max-w-xs">
                <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                />
                <Input
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder="Search agents..."
                    aria-label="Search agents"
                    className="pl-8"
                />
            </div>

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
                                <AlertTitle>Could not load agents</AlertTitle>
                                <AlertDescription>
                                    <p>{error}</p>
                                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                                        <RefreshCw className="size-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="p-6">
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
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-border md:hidden">
                                {agents.map((agent) => (
                                    <li key={agent.agent_id} className="flex flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
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
                                            </div>
                                            <AgentStatus agent={agent} />
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                Target {agent.daily_call_target ?? "—"}
                                            </span>
                                            <AgentActions
                                                agent={agent}
                                                onEdit={openEdit}
                                                onDeactivate={setConfirmDeactivate}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="hidden overflow-x-auto md:block [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
                                <Table className="min-w-[720px]">
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-40">Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="w-56">User email</TableHead>
                                            <TableHead className="w-28 text-right">Daily target</TableHead>
                                            <TableHead className="w-28">Status</TableHead>
                                            <TableHead className="w-[120px] text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agents.map((agent) => (
                                            <TableRow key={agent.agent_id}>
                                                <TableCell
                                                    className="max-w-40 truncate font-mono text-xs"
                                                    title={agent.agent_code}
                                                >
                                                    {agent.agent_code}
                                                </TableCell>
                                                <TableCell
                                                    className="max-w-64 truncate"
                                                    title={agent.display_name}
                                                >
                                                    {agent.display_name}
                                                </TableCell>
                                                <TableCell
                                                    className="max-w-56 truncate text-muted-foreground"
                                                    title={agent.user_email ?? undefined}
                                                >
                                                    {agent.user_email ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {agent.daily_call_target ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <AgentStatus agent={agent} />
                                                </TableCell>
                                                <TableCell>
                                                    <AgentActions
                                                        agent={agent}
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
                                    {total === 0
                                        ? "0 agents"
                                        : `Showing ${from}–${to} of ${total}`}
                                </p>
                                {pageCount > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 md:min-h-0"
                                            aria-label="Previous page"
                                            disabled={page <= 1 || isLoading}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            Page {page} of {pageCount}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 md:min-h-0"
                                            aria-label="Next page"
                                            disabled={page >= pageCount || isLoading}
                                            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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
                <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="line-clamp-1">
                            {dialog?.mode === "edit" ? "Edit agent" : "Register agent"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "edit"
                                ? "Change the display name or daily call target."
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
                                    <p id="agent-name-error" className="text-xs text-destructive">
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
                                    <p id="agent-target-error" className="text-xs text-destructive">
                                        {errors.daily_call_target}
                                    </p>
                                )}
                            </div>
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
                                ? `"${confirmDeactivate.display_name}" stops receiving new work. Past leads and activities stay linked.`
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
