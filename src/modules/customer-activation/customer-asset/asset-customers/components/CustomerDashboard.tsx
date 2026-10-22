"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./StatusPill";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import type { Note } from "../types/asset-customers.schema";

function formatStamp(value: string | null): string {
    if (!value) return "—";
    return value.length >= 16 ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : value;
}

function assignmentLabel(status: string): string {
    const s = status.toLowerCase();
    if (s === "open") return "Open";
    if (s === "partial") return "Partial";
    if (s === "returned") return "Returned";
    return status;
}

function timeAgo(value: string | null): string {
    if (!value) return "—";
    const then = new Date(value.replace(" ", "T")).getTime();
    if (!Number.isFinite(then)) return value;
    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

export function CustomerDashboard({ id }: { id: number }) {
    const { detail, isLoading, error, refresh, addNote, editNote, removeNote } = useCustomerDetail(id);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<Note | null>(null);
    const [editBody, setEditBody] = useState("");
    const [deleting, setDeleting] = useState<Note | null>(null);
    const [busy, setBusy] = useState(false);

    const submitDraft = async () => {
        if (!draft.trim() || saving) return;
        setSaving(true);
        const ok = await addNote(draft.trim());
        setSaving(false);
        if (ok) setDraft("");
    };

    const submitEdit = async () => {
        if (!editing || !editBody.trim() || busy) return;
        setBusy(true);
        const ok = await editNote(editing.id, editBody.trim());
        setBusy(false);
        if (ok) setEditing(null);
    };

    const confirmDelete = async () => {
        if (!deleting || busy) return;
        setBusy(true);
        const ok = await removeNote(deleting.id);
        setBusy(false);
        if (ok) setDeleting(null);
    };

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-[1600px] space-y-4" aria-label="Loading customer">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="mx-auto w-full max-w-[1600px]">
                <Alert variant="destructive">
                    <AlertTitle>Could not load customer</AlertTitle>
                    <AlertDescription>{error ?? "Customer not found."}</AlertDescription>
                </Alert>
                <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
                    Retry
                </Button>
            </div>
        );
    }

    const { customer, holdings, history, notes, assetsHeld, openAssignments } = detail;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid min-w-0 gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                            {customer.customer_name}
                        </h1>
                        <span className="shrink-0">
                            {customer.isActive ? (
                                <StatusPill tone="success">Active</StatusPill>
                            ) : (
                                <StatusPill tone="neutral">Inactive</StatusPill>
                            )}
                        </span>
                    </div>
                    <p className="truncate whitespace-nowrap font-mono text-sm text-muted-foreground tabular-nums">
                        {customer.customer_code}
                    </p>
                </div>
            </header>

            <Card className="shadow-none border-border overflow-hidden">
                <CardHeader>
                    <CardTitle>Identity</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">Customer</dt>
                            <dd className="truncate font-medium" title={customer.customer_name}>
                                {customer.customer_name}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-muted-foreground">Code</dt>
                            <dd className="truncate font-mono text-xs tabular-nums" title={customer.customer_code}>
                                {customer.customer_code}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Assets held</dt>
                            <dd className="font-mono text-xs tabular-nums">{assetsHeld}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Open assignments</dt>
                            <dd className="font-mono text-xs tabular-nums">{openAssignments}</dd>
                        </div>
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Read-only — customer records are owned by another module.
                    </p>
                </CardContent>
            </Card>

            <Card className="shadow-none border-border overflow-hidden">
                <CardHeader>
                    <CardTitle>Current holdings</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {holdings.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">
                            No assets currently held by this customer.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expected return</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {holdings.map((h) => (
                                    <TableRow key={h.taggingId}>
                                        <TableCell className="min-w-0">
                                            <span className="block max-w-56 truncate font-medium" title={h.itemName}>
                                                {h.itemName}
                                            </span>
                                            <span className="block max-w-40 truncate whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                                                {h.itemCode}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs tabular-nums">
                                            {h.held} <span className="text-muted-foreground">of {h.quantity}</span>
                                        </TableCell>
                                        <TableCell>
                                            <StatusPill tone={h.status.toLowerCase() === "open" ? "info" : "warning"} className="shrink-0">
                                                {assignmentLabel(h.status)}
                                            </StatusPill>
                                        </TableCell>
                                        <TableCell className="max-w-40 truncate whitespace-nowrap text-sm tabular-nums">
                                            {formatStamp(h.expectedReturnAt ?? null)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none border-border overflow-hidden">
                <CardHeader>
                    <CardTitle>Assignment history</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {history.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">No assignments on record.</p>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Tagged</TableHead>
                                    <TableHead>Closed</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((h) => (
                                    <TableRow key={h.taggingId}>
                                        <TableCell className="min-w-0">
                                            <span className="block max-w-56 truncate font-medium" title={h.itemName}>
                                                {h.itemName}
                                            </span>
                                            <span className="block max-w-40 truncate whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                                                {h.itemCode}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs tabular-nums">
                                            {h.quantity}
                                            {h.returnedQuantity > 0 ? ` (${h.returnedQuantity} returned)` : ""}
                                        </TableCell>
                                        <TableCell>
                                            <StatusPill
                                                tone={h.status.toLowerCase() === "open" ? "info" : "neutral"}
                                                className="shrink-0"
                                            >
                                                {assignmentLabel(h.status)}
                                            </StatusPill>
                                        </TableCell>
                                        <TableCell className="max-w-40 truncate whitespace-nowrap text-sm tabular-nums" title={h.taggedAt ?? ""}>
                                            {formatStamp(h.taggedAt ?? null)}
                                        </TableCell>
                                        <TableCell className="max-w-40 truncate whitespace-nowrap text-sm tabular-nums" title={h.closedAt ?? ""}>
                                            {formatStamp(h.closedAt ?? null)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none border-border overflow-hidden">
                <CardHeader>
                    <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Add a note about this customer…"
                            aria-label="New note"
                            rows={3}
                        />
                        <Button size="sm" onClick={() => void submitDraft()} disabled={saving || !draft.trim()}>
                            <Plus className="size-4" aria-hidden />
                            {saving ? "Adding…" : "Add note"}
                        </Button>
                    </div>
                    {notes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No notes yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {notes.map((note) =>
                                editing?.id === note.id ? (
                                    <li key={note.id} className="space-y-2 rounded-md border p-3">
                                        <Textarea
                                            value={editBody}
                                            onChange={(e) => setEditBody(e.target.value)}
                                            aria-label="Edit note"
                                            rows={3}
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => void submitEdit()} disabled={busy || !editBody.trim()}>
                                                Save
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </li>
                                ) : (
                                    <li key={note.id} className="rounded-md border p-3">
                                        <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground" title={note.updated_at}>
                                                {timeAgo(note.updated_at)}
                                            </span>
                                            <div className="flex shrink-0 gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Edit note ${note.id}`}
                                                    onClick={() => {
                                                        setEditing(note);
                                                        setEditBody(note.body);
                                                    }}
                                                >
                                                    <Pencil className="size-4" aria-hidden />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Delete note ${note.id}`}
                                                    onClick={() => setDeleting(note)}
                                                >
                                                    <Trash2 className="size-4" aria-hidden />
                                                </Button>
                                            </div>
                                        </div>
                                    </li>
                                ),
                            )}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the note. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
