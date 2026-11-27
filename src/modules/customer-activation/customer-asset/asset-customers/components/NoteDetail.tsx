"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assetCustomersRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { NoteWithPreview } from "../types/asset-customers.schema";
import { BackButton } from "./BackButton";
import { RichTextEditor } from "./RichTextEditor";
import { formatHuman } from "../utils/datetime";

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function containsHtml(body: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(body);
}

export function NoteDetail({ customerId, noteId }: { customerId: number; noteId: number }) {
    const router = useRouter();
    const dashboardHref = `/customer-activation/customer-asset/asset-customers/${customerId}`;
    const [note, setNote] = useState<NoteWithPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [editHtml, setEditHtml] = useState("");
    const [saving, setSaving] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(assetCustomersRoutes.note(noteId), { cache: "no-store" });
            const body = (await res.json().catch(() => null)) as ApiEnvelope<NoteWithPreview> | null;
            if (!res.ok || !body || body.success === false) {
                throw new Error(
                    (body && body.success === false && body.message) || "Could not load the note.",
                );
            }
            if (body.data.customer_id !== customerId) {
                throw new Error("This note does not belong to this customer.");
            }
            setNote(body.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load the note.");
        } finally {
            setIsLoading(false);
        }
    }, [customerId, noteId]);

    useEffect(() => {
        void load();
    }, [load]);

    const startEdit = () => {
        setEditHtml(note?.body ?? "");
        setEditing(true);
    };

    const saveEdit = async () => {
        if (!note || saving) return;
        if (!stripHtml(editHtml)) {
            toast.error("Note cannot be empty");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(assetCustomersRoutes.note(note.id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: editHtml, customer_id: customerId }),
            });
            const body = (await res.json().catch(() => null)) as ApiEnvelope<NoteWithPreview> | null;
            if (!res.ok || !body || body.success === false) {
                throw new Error(
                    (body && body.success === false && body.message) || "Could not update the note.",
                );
            }
            setNote(body.data);
            setEditing(false);
            toast.success("Note updated");
        } catch (err) {
            toast.error("Failed to update note", {
                description: err instanceof Error ? err.message : undefined,
            });
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!note || deleting) return;
        setDeleting(true);
        try {
            const res = await fetch(
                `${assetCustomersRoutes.note(note.id)}?customerId=${customerId}`,
                { method: "DELETE" },
            );
            const body = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
            if (!res.ok || !body || body.success === false) {
                throw new Error(
                    (body && body.success === false && body.message) || "Could not delete the note.",
                );
            }
            toast.success("Note deleted");
            router.push(dashboardHref);
        } catch (err) {
            toast.error("Failed to delete note", {
                description: err instanceof Error ? err.message : undefined,
            });
            setDeleting(false);
            setConfirmingDelete(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto w-full max-w-3xl space-y-4" aria-label="Loading note">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        );
    }

    if (error || !note) {
        return (
            <div className="mx-auto w-full max-w-3xl">
                <div className="mb-3">
                    <BackButton fallbackHref={dashboardHref} />
                </div>
                <Alert variant="destructive">
                    <AlertTitle>Could not load note</AlertTitle>
                    <AlertDescription>{error ?? "Note not found."}</AlertDescription>
                </Alert>
                <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <BackButton fallbackHref={dashboardHref} />
                <div className="flex gap-2">
                    {!editing && (
                        <>
                            <Button variant="outline" size="sm" onClick={startEdit}>
                                <Pencil className="size-4" aria-hidden />
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmingDelete(true)}
                            >
                                <Trash2 className="size-4" aria-hidden />
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card className="shadow-none">
                <CardHeader>
                    <h1 className="leading-none font-semibold">Note</h1>
                    <p className="text-xs text-muted-foreground">
                        Created <span title={note.created_at}>{formatHuman(note.created_at)}</span>{" "}
                        · Updated <span title={note.updated_at}>{formatHuman(note.updated_at)}</span>
                    </p>
                </CardHeader>
                <CardContent>
                    {editing ? (
                        <div className="space-y-3">
                            <RichTextEditor
                                value={editHtml}
                                onChange={setEditHtml}
                                placeholder="Edit this note…"
                                ariaLabel="Edit note"
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => void saveEdit()}
                                    disabled={saving || !stripHtml(editHtml)}
                                >
                                    {saving ? "Saving…" : "Save"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditing(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : containsHtml(note.body) ? (
                        <div
                            className="[&_a]:underline [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 text-sm break-words"
                            dangerouslySetInnerHTML={{ __html: note.body }}
                        />
                    ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the note. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={deleting} onClick={() => void confirmDelete()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
