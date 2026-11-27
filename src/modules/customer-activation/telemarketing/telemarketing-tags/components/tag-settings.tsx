"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Loader2, MoreHorizontal, Pencil, Plus, PowerOff } from "lucide-react";
import { AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "./status-pill";
import { Switch } from "@/components/ui/switch";
import { TagsListShell } from "./tags-list-shell";
import { Textarea } from "@/components/ui/textarea";
import type { Tag } from "../types/tag.schema";
import { useTags } from "../hooks/use-tags";

const flagOn = (v: Tag["is_active"]) => Number(v) === 1;

/** Row clicks must ignore interactive elements and portalled menus. */
function isRowClickIgnored(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.closest(
            "a,button,input,select,textarea,[role='menuitem'],[role='menu'],[role='dialog'],[data-no-row-click]",
        ) !== null
    );
}

function TagStatus({ tag }: { tag: Tag }) {
    return flagOn(tag.is_active) ? (
        <StatusPill tone="success">Active</StatusPill>
    ) : (
        <StatusPill tone="neutral">Inactive</StatusPill>
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
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
    const [search, setSearch] = useState("");
    const { tags, total, isLoading, error, refresh, createTag, updateTag, deactivateTag } = useTags({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search,
    });

    const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

    // The header talks about the collection, not the filter, so a no-match
    // search reads "0 of 8 tags" instead of claiming the list is empty.
    const [collectionTotal, setCollectionTotal] = useState(0);
    const isFiltered = search.trim() !== "";
    const countLabel = error
        ? "—"
        : isFiltered
          ? `${total} of ${collectionTotal} ${collectionTotal === 1 ? "tag" : "tags"}`
          : `${total} ${total === 1 ? "tag" : "tags"}`;

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

    const handleSearch = (value: string) => {
        // Remember the unfiltered total as the filter first hides the list,
        // so the header can say "0 of 8 tags" instead of "0 tags".
        if (search.trim() === "" && value.trim() !== "") setCollectionTotal(total);
        setSearch(value);
        setPagination((p) => ({ ...p, pageIndex: 0 }));
    };

    const clearSearch = () => {
        setSearch("");
        setPagination((p) => ({ ...p, pageIndex: 0 }));
    };

    const columns: ColumnDef<Tag>[] = useMemo(
        () => [
            {
                accessorKey: "tag_code",
                header: "Code",
                cell: ({ row }) => (
                    <span
                        className="block max-w-40 truncate font-mono text-xs tabular-nums"
                        title={row.original.tag_code}
                    >
                        {row.original.tag_code}
                    </span>
                ),
            },
            {
                accessorKey: "tag_name",
                header: "Name",
                cell: ({ row }) => (
                    <span className="block max-w-64 truncate font-medium" title={row.original.tag_name}>
                        {row.original.tag_name}
                    </span>
                ),
            },
            {
                accessorKey: "color",
                header: "Colour",
                cell: ({ row }) => (
                    <span className="flex min-w-0 items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="size-3 shrink-0 rounded-full border"
                            style={{ backgroundColor: row.original.color ?? "transparent" }}
                        />
                        <span className="block max-w-24 truncate font-mono text-xs tabular-nums text-muted-foreground">
                            {row.original.color ?? "—"}
                        </span>
                    </span>
                ),
            },
            {
                accessorKey: "is_active",
                header: "Status",
                cell: ({ row }) => <TagStatus tag={row.original} />,
            },
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => {
                    const tag = row.original;
                    const active = flagOn(tag.is_active);
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={`Actions for ${tag.tag_name}`}>
                                    <MoreHorizontal className="size-4" aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(tag)}>
                                    Edit
                                </DropdownMenuItem>
                                {active ? (
                                    <DropdownMenuItem onClick={() => setConfirmDeactivate(tag)}>
                                        Deactivate
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem
                                        onClick={() => void updateTag(tag.tag_id, { is_active: true })}
                                    >
                                        Activate
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
        ],
        [updateTag],
    );

    return (
        <div className="mx-auto w-full max-w-screen-2xl space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tags</h1>
                        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                            {countLabel}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Create colour-coded tags to label and segment telemarketing leads.
                    </p>
                </div>
                <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
                    <Plus className="size-4" />
                    New tag
                </Button>
            </header>

            <TagsListShell
                columns={columns}
                data={tags}
                isLoading={isLoading}
                error={error}
                onRefresh={() => void refresh()}
                searchValue={search}
                onSearch={handleSearch}
                emptyTitle={isFiltered ? `No tags match “${search.trim()}”` : "No tags yet"}
                emptyDescription={
                    isFiltered
                        ? "Check the spelling, or clear the search to see every tag."
                        : "Create the first tag to start labelling leads."
                }
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                manualPagination
                filters={
                    isFiltered ? (
                        <Button variant="ghost" size="sm" onClick={clearSearch}>
                            Clear search
                        </Button>
                    ) : undefined
                }
                cards={
                    isLoading || error || tags.length === 0 ? null : (
                        <ul className="divide-y divide-border">
                            {tags.map((tag) => (
                                <li
                                    key={tag.tag_id}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`Edit ${tag.tag_name}`}
                                    onClick={(event) => {
                                        if (isRowClickIgnored(event.target)) return;
                                        openEdit(tag);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        if (isRowClickIgnored(event.target)) return;
                                        event.preventDefault();
                                        openEdit(tag);
                                    }}
                                    className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2"
                                >
                                    <div className="flex min-w-0 items-start gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="mt-1 size-4 shrink-0 rounded-full border"
                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                        />
                                        <div className="min-w-0">
                                            <p className="font-medium break-words">{tag.tag_name}</p>
                                            <p
                                                className="font-mono text-xs break-words text-muted-foreground"
                                                title={tag.color ?? undefined}
                                            >
                                                {tag.tag_code}
                                                {tag.color ? ` · ${tag.color}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <TagStatus tag={tag} />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            data-no-row-click
                                            aria-label={`Edit ${tag.tag_name}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                openEdit(tag);
                                            }}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            data-no-row-click
                                            aria-label={`${flagOn(tag.is_active) ? "Deactivate" : "Activate"} ${tag.tag_name}`}
                                            disabled={!flagOn(tag.is_active)}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setConfirmDeactivate(tag);
                                            }}
                                        >
                                            <PowerOff className="size-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )
                }
            />

            <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
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
                        onSubmit={(event) => void handleSubmit(event)}
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
                                    <p
                                        id="tag-code-error"
                                        className="flex items-start gap-1 text-xs text-foreground"
                                    >
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
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
                                    <p
                                        id="tag-name-error"
                                        className="flex items-start gap-1 text-xs text-foreground"
                                    >
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
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
