"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, PowerOff, RefreshCw, Tags } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Tag } from "../types/tag.schema";
import { useTags } from "../hooks/use-tags";

const flagOn = (v: Tag["is_active"]) => Number(v) === 1;

function TagStatus({ tag }: { tag: Tag }) {
    return flagOn(tag.is_active) ? (
        <StatusBadge tone="info">Active</StatusBadge>
    ) : (
        <StatusBadge tone="neutral">Inactive</StatusBadge>
    );
}

interface FormState {
    tag_code: string;
    tag_name: string;
    color: string;
    description: string;
    is_active: boolean;
}

type FormErrors = Partial<Record<"tag_code" | "tag_name", string>>;

const EMPTY_FORM: FormState = {
    tag_code: "",
    tag_name: "",
    color: "",
    description: "",
    is_active: true,
};

function formFrom(tag: Tag): FormState {
    return {
        tag_code: tag.tag_code,
        tag_name: tag.tag_name,
        color: tag.color ?? "",
        description: tag.description ?? "",
        is_active: flagOn(tag.is_active),
    };
}

export function TagSettings() {
    const { tags, isLoading, error, refresh, createTag, updateTag, deactivateTag } = useTags();
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; tag: Tag } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState<Tag | null>(null);

    const openCreate = () => {
        setForm({ ...EMPTY_FORM });
        setErrors({});
        setDialog({ mode: "create" });
    };

    const openEdit = (tag: Tag) => {
        setForm(formFrom(tag));
        setErrors({});
        setDialog({ mode: "edit", tag });
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (key === "tag_code" || key === "tag_name") {
            const k = key as "tag_code" | "tag_name";
            setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
        }
    };

    const validate = (): boolean => {
        const next: FormErrors = {};
        if (!form.tag_code.trim()) next.tag_code = "Enter a tag code.";
        if (!form.tag_name.trim()) next.tag_name = "Enter a tag name.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!dialog || submitting || !validate()) return;
        setSubmitting(true);
        const payload = {
            tag_code: form.tag_code.trim(),
            tag_name: form.tag_name.trim(),
            color: form.color.trim() ? form.color.trim() : null,
            description: form.description.trim() ? form.description.trim() : null,
            is_active: form.is_active,
        };
        const ok =
            dialog.mode === "create"
                ? await createTag(payload)
                : await updateTag(dialog.tag.tag_id, payload);
        setSubmitting(false);
        if (ok) setDialog(null);
    };

    const handleDeactivate = async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        if (!confirmDeactivate || deactivating) return;
        setDeactivating(true);
        const ok = await deactivateTag(confirmDeactivate.tag_id);
        setDeactivating(false);
        if (ok) setConfirmDeactivate(null);
    };

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tag creation</h1>
                    <p className="text-sm text-muted-foreground">
                        Create colour-coded tags to label and segment telemarketing leads.
                    </p>
                </div>
                <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
                    <Plus className="size-4" />
                    New tag
                </Button>
            </header>

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
                                <AlertTitle>Could not load tags</AlertTitle>
                                <AlertDescription>
                                    <p>{error}</p>
                                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                                        <RefreshCw className="size-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : tags.length === 0 ? (
                        <div className="p-6">
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Tags />
                                    </EmptyMedia>
                                    <EmptyTitle>No tags yet</EmptyTitle>
                                    <EmptyDescription>
                                        Create the first tag to start labelling leads.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={openCreate} className="min-h-11 md:min-h-0">
                                        <Plus className="size-4" />
                                        New tag
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-border md:hidden">
                                {tags.map((tag) => (
                                    <li key={tag.tag_id} className="flex flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                    aria-hidden="true"
                                                    className="size-4 shrink-0 rounded-full border"
                                                    style={{ backgroundColor: tag.color ?? "transparent" }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-medium break-words">{tag.tag_name}</p>
                                                    <p className="font-mono text-xs text-muted-foreground break-words">
                                                        {tag.tag_code}
                                                    </p>
                                                </div>
                                            </div>
                                            <TagStatus tag={tag} />
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Edit ${tag.tag_name}`}
                                                onClick={() => openEdit(tag)}
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Deactivate ${tag.tag_name}`}
                                                disabled={!flagOn(tag.is_active)}
                                                onClick={() => setConfirmDeactivate(tag)}
                                            >
                                                <PowerOff className="size-4" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="hidden md:block [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
                                <Table className="min-w-[640px]">
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-40">Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="w-32">Colour</TableHead>
                                            <TableHead className="w-32">Status</TableHead>
                                            <TableHead className="w-[140px] text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tags.map((tag) => (
                                            <TableRow key={tag.tag_id}>
                                                <TableCell
                                                    className="max-w-40 truncate font-mono text-xs"
                                                    title={tag.tag_code}
                                                >
                                                    {tag.tag_code}
                                                </TableCell>
                                                <TableCell
                                                    className="max-w-64 truncate"
                                                    title={tag.tag_name}
                                                >
                                                    {tag.tag_name}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="flex items-center gap-2">
                                                        <span
                                                            aria-hidden="true"
                                                            className="size-4 shrink-0 rounded-full border"
                                                            style={{
                                                                backgroundColor: tag.color ?? "transparent",
                                                            }}
                                                        />
                                                        <span className="max-w-20 truncate font-mono text-xs text-muted-foreground">
                                                            {tag.color ?? "—"}
                                                        </span>
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <TagStatus tag={tag} />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Edit ${tag.tag_name}`}
                                                            title="Edit tag"
                                                            onClick={() => openEdit(tag)}
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Deactivate ${tag.tag_name}`}
                                                            title="Deactivate tag"
                                                            disabled={!flagOn(tag.is_active)}
                                                            onClick={() => setConfirmDeactivate(tag)}
                                                        >
                                                            <PowerOff className="size-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="line-clamp-1">
                            {dialog?.mode === "edit" ? "Edit tag" : "New tag"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "edit"
                                ? "Rename the tag or change its colour."
                                : "Add a colour-coded label for telemarketing leads."}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit}
                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="tag-code">
                                    Code <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="tag-code"
                                    value={form.tag_code}
                                    onChange={(e) => setField("tag_code", e.target.value)}
                                    placeholder="e.g. hot-lead"
                                    maxLength={64}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.tag_code)}
                                    aria-describedby={errors.tag_code ? "tag-code-error" : undefined}
                                />
                                {errors.tag_code && (
                                    <p id="tag-code-error" className="text-xs text-destructive">
                                        {errors.tag_code}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tag-name">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="tag-name"
                                    value={form.tag_name}
                                    onChange={(e) => setField("tag_name", e.target.value)}
                                    placeholder="e.g. Hot Lead"
                                    maxLength={191}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.tag_name)}
                                    aria-describedby={errors.tag_name ? "tag-name-error" : undefined}
                                />
                                {errors.tag_name && (
                                    <p id="tag-name-error" className="text-xs text-destructive">
                                        {errors.tag_name}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tag-color">Colour</Label>
                                <div className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-8 shrink-0 rounded-md border"
                                        style={{ backgroundColor: form.color.trim() || "transparent" }}
                                    />
                                    <Input
                                        id="tag-color"
                                        value={form.color}
                                        onChange={(e) => setField("color", e.target.value)}
                                        placeholder="e.g. #3b82f6"
                                        maxLength={32}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tag-description">Description</Label>
                                <Textarea
                                    id="tag-description"
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                    placeholder="What is this tag for?"
                                    rows={3}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                <div className="grid gap-0.5">
                                    <Label htmlFor="tag-active">Active</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive tags stay on past leads but cannot be picked.
                                    </p>
                                </div>
                                <Switch
                                    id="tag-active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setField("is_active", checked)}
                                />
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
                                {dialog?.mode === "edit" ? "Save changes" : "Create tag"}
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
                        <AlertDialogTitle>Deactivate tag?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDeactivate
                                ? `"${confirmDeactivate.tag_name}" will no longer be offered for new leads. Leads already carrying it keep it.`
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
