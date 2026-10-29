"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Loader2, Megaphone, MoreHorizontal, Plus, Power, PowerOff, RefreshCw, Search } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/new-data-table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Campaign } from "../types/campaign.schema";
import { durationTitle, formatCampaignDuration } from "./campaign-duration";
import { useCampaigns } from "../hooks/use-campaigns";
import styles from "./list-shell.module.css";

const flagOn = (v: Campaign["is_active"]) => Number(v) === 1;
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Directus `YYYY-MM-DD HH:mm:ss` → `datetime-local` value. */
function toInput(value: string | null | undefined): string {
    if (!value) return "";
    return value.replace(" ", "T").slice(0, 16);
}

/** `datetime-local` value → Directus `YYYY-MM-DD HH:mm:ss`, or null when empty. */
function toDb(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return `${trimmed.replace("T", " ")}:00`;
}

/** Human-readable campaign window; see `./campaign-duration`. */
function windowLabel(campaign: Campaign): string {
    return formatCampaignDuration(campaign.starts_at, campaign.ends_at);
}

/** Exact stored window for the cell `title` attribute. */
function windowTitle(campaign: Campaign): string {
    return durationTitle(campaign.starts_at, campaign.ends_at);
}

function CampaignStatus({ campaign }: { campaign: Campaign }) {
    return flagOn(campaign.is_active) ? (
        <StatusPill tone="success">Active</StatusPill>
    ) : (
        <StatusPill tone="neutral">Inactive</StatusPill>
    );
}

interface FormState {
    campaign_code: string;
    title: string;
    description: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
}

type FormErrors = Partial<Record<"campaign_code" | "title" | "ends_at", string>>;

const EMPTY_FORM: FormState = {
    campaign_code: "",
    title: "",
    description: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
};

function formFrom(campaign: Campaign): FormState {
    return {
        campaign_code: campaign.campaign_code,
        title: campaign.title,
        description: campaign.description ?? "",
        starts_at: toInput(campaign.starts_at),
        ends_at: toInput(campaign.ends_at),
        is_active: flagOn(campaign.is_active),
    };
}

function CampaignRowMenu({
    campaign,
    busy,
    onEdit,
    onToggleActive,
}: {
    campaign: Campaign;
    busy: boolean;
    onEdit: (campaign: Campaign) => void;
    onToggleActive: (campaign: Campaign) => void;
}) {
    const active = flagOn(campaign.is_active);
    const hasPage = campaign.content_json != null;
    const designerTitle = hasPage
        ? "Custom page (v2)"
        : "No page authored yet — the site shows the title and description";
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${campaign.title}`}>
                    <MoreHorizontal className="size-4" aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    asChild
                    title={designerTitle}
                    className={hasPage ? undefined : "text-muted-foreground"}
                >
                    <Link
                        href={`/customer-activation/referrals/referral-campaigns/${campaign.campaign_id}/content`}
                    >
                        Edit content
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(campaign)}>Edit details</DropdownMenuItem>
                <DropdownMenuItem disabled={busy} onClick={() => onToggleActive(campaign)}>
                    {active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function CampaignSearchInput({
    value,
    onSearch,
}: {
    value: string;
    onSearch: (value: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        if (draft === value) return;
        const timer = setTimeout(() => onSearch(draft), 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft]);

    return (
        <div className="relative w-full min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search campaigns..."
                aria-label="Search campaigns"
                className="w-full min-w-0 rounded-lg pl-8"
            />
        </div>
    );
}

export function CampaignSettings() {
    const {
        campaigns,
        pagination,
        onPaginationChange,
        pageCount,
        search,
        setSearch,
        status,
        setStatus,
        isLoading,
        error,
        refresh,
        createCampaign,
        updateCampaign,
        setCampaignActive,
    } = useCampaigns();
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; campaign: Campaign } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState<Campaign | null>(null);

    const openCreate = () => {
        setForm({ ...EMPTY_FORM });
        setErrors({});
        setDialog({ mode: "create" });
    };

    const openEdit = (campaign: Campaign) => {
        setForm(formFrom(campaign));
        setErrors({});
        setDialog({ mode: "edit", campaign });
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key as keyof FormErrors] ? { ...prev, [key]: undefined } : prev));
    };

    const validate = (): boolean => {
        const next: FormErrors = {};
        const code = form.campaign_code.trim();
        if (!code) next.campaign_code = "Enter a campaign code.";
        else if (!CODE_PATTERN.test(code)) next.campaign_code = "Use lowercase letters, numbers, and hyphens.";
        if (!form.title.trim()) next.title = "Enter a campaign title.";
        if (form.starts_at && form.ends_at && form.ends_at < form.starts_at)
            next.ends_at = "End date must not be before the start date.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!dialog || submitting || !validate()) return;
        setSubmitting(true);
        const payload = {
            campaign_code: form.campaign_code.trim(),
            title: form.title.trim(),
            description: form.description.trim() ? form.description.trim() : null,
            starts_at: toDb(form.starts_at),
            ends_at: toDb(form.ends_at),
            is_active: form.is_active,
        };
        const ok =
            dialog.mode === "create"
                ? await createCampaign(payload)
                : await updateCampaign(dialog.campaign.campaign_id, payload);
        setSubmitting(false);
        if (ok) setDialog(null);
    };

    const handleToggle = async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        if (!confirmToggle || toggling) return;
        setToggling(true);
        const ok = await setCampaignActive(confirmToggle.campaign_id, !flagOn(confirmToggle.is_active));
        setToggling(false);
        if (ok) setConfirmToggle(null);
    };

    const togglingToActive = confirmToggle ? !flagOn(confirmToggle.is_active) : false;

    const columns: ColumnDef<Campaign>[] = [
        {
            accessorKey: "campaign_code",
            header: "Code",
            cell: ({ row }) => (
                <span
                    className="block max-w-40 truncate font-mono text-xs tabular-nums"
                    title={row.original.campaign_code}
                >
                    {row.original.campaign_code}
                </span>
            ),
        },
        {
            accessorKey: "title",
            header: "Title",
            cell: ({ row }) => (
                <span className="block max-w-56 truncate font-medium" title={row.original.title}>
                    {row.original.title}
                </span>
            ),
        },
        {
            id: "duration",
            header: "Campaign Duration",
            cell: ({ row }) => (
                <span
                    className="block whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                    title={windowTitle(row.original)}
                >
                    {windowLabel(row.original)}
                </span>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) => <CampaignStatus campaign={row.original} />,
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <CampaignRowMenu
                    campaign={row.original}
                    busy={toggling}
                    onEdit={openEdit}
                    onToggleActive={setConfirmToggle}
                />
            ),
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Campaigns
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Define referral campaign windows. Content is managed separately.
                    </p>
                </div>
                <Button onClick={openCreate} className="shrink-0">
                    <Plus className="size-4" aria-hidden />
                    New campaign
                </Button>
            </header>

            <Card className="gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card py-0 shadow-sm">
                <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2 bg-muted/10 px-6 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                        <CampaignSearchInput value={search} onSearch={setSearch} />
                        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                            <SelectTrigger className="w-[120px] shrink-0 sm:w-[130px]" aria-label="Filter by status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refresh()}
                            className="shrink-0"
                        >
                            <RefreshCw className="size-4 shrink-0" aria-hidden />
                            <span className="whitespace-nowrap">Refresh</span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {error ? (
                        <div className="px-6 pb-6">
                            <Alert variant="destructive">
                                <AlertTriangle />
                                <AlertTitle>Could not load campaigns</AlertTitle>
                                <AlertDescription>
                                    <p>{error}</p>
                                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                                        <RefreshCw className="size-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : (
                        <>
                            <div className="hidden px-6 pb-6 md:block">
                                <div className={styles.hideColumnMenu}>
                                    <DataTable
                                        columns={columns}
                                        data={campaigns}
                                        isLoading={isLoading}
                                        manualPagination
                                        pageCount={pageCount}
                                        pagination={pagination}
                                        onPaginationChange={onPaginationChange}
                                        emptyTitle="No campaigns yet"
                                        emptyDescription="Create the first campaign to start running referral drives."
                                    />
                                </div>
                            </div>
                            <div className="md:hidden">
                                {isLoading ? (
                                    <div className="space-y-2 px-4 pb-4">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <Skeleton key={i} className="h-24 w-full" />
                                        ))}
                                    </div>
                                ) : campaigns.length === 0 ? (
                                    <div className="px-4 pb-4">
                                        <Empty>
                                            <EmptyHeader>
                                                <EmptyMedia variant="icon">
                                                    <Megaphone />
                                                </EmptyMedia>
                                                <EmptyTitle>No campaigns yet</EmptyTitle>
                                                <EmptyDescription>
                                                    Create the first campaign to start running referral drives.
                                                </EmptyDescription>
                                            </EmptyHeader>
                                            <EmptyContent>
                                                <Button onClick={openCreate} className="min-h-11">
                                                    <Plus className="size-4" />
                                                    New campaign
                                                </Button>
                                            </EmptyContent>
                                        </Empty>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-border">
                                        {campaigns.map((campaign) => {
                                            const active = flagOn(campaign.is_active);
                                            const hasPage = campaign.content_json != null;
                                            return (
                                                <li key={campaign.campaign_id} className="flex flex-col gap-3 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-medium break-words">{campaign.title}</p>
                                                            <p className="font-mono text-xs text-muted-foreground break-words">
                                                                {campaign.campaign_code}
                                                            </p>
                                                        </div>
                                                        <CampaignStatus campaign={campaign} />
                                                    </div>
                                                    <span
                                                        className="text-xs text-muted-foreground tabular-nums"
                                                        title={windowTitle(campaign)}
                                                    >
                                                        {windowLabel(campaign)}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="min-h-11 flex-1 whitespace-nowrap"
                                                            title={
                                                                hasPage
                                                                    ? "Custom page (v2)"
                                                                    : "No page authored yet — the site shows the title and description"
                                                            }
                                                            asChild
                                                        >
                                                            <Link
                                                                href={`/customer-activation/referrals/referral-campaigns/${campaign.campaign_id}/content`}
                                                            >
                                                                Edit content
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="min-h-11 flex-1 whitespace-nowrap"
                                                            onClick={() => openEdit(campaign)}
                                                        >
                                                            Edit details
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="min-h-11 flex-1 whitespace-nowrap"
                                                            disabled={toggling}
                                                            onClick={() => setConfirmToggle(campaign)}
                                                        >
                                                            {active ? "Deactivate" : "Activate"}
                                                        </Button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="w-[95vw] max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="line-clamp-1">
                            {dialog?.mode === "edit" ? "Edit campaign" : "New campaign"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "edit"
                                ? "Rename the campaign or change its window and availability."
                                : "Add a referral campaign. Content is authored separately."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="campaign-code">
                                    Code <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="campaign-code"
                                    value={form.campaign_code}
                                    onChange={(e) => setField("campaign_code", e.target.value)}
                                    placeholder="e.g. solar-referral-month"
                                    maxLength={64}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.campaign_code)}
                                    aria-describedby={errors.campaign_code ? "campaign-code-error" : undefined}
                                />
                                {errors.campaign_code && (
                                    <p id="campaign-code-error" className="text-xs text-destructive">
                                        {errors.campaign_code}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="campaign-title">
                                    Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="campaign-title"
                                    value={form.title}
                                    onChange={(e) => setField("title", e.target.value)}
                                    placeholder="e.g. Solar Referral Month"
                                    maxLength={191}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.title)}
                                    aria-describedby={errors.title ? "campaign-title-error" : undefined}
                                />
                                {errors.title && (
                                    <p id="campaign-title-error" className="text-xs text-destructive">
                                        {errors.title}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="campaign-description">Description</Label>
                                <Textarea
                                    id="campaign-description"
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                    placeholder="What is this campaign about?"
                                    rows={3}
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="campaign-starts-at">Starts at</Label>
                                    <Input
                                        id="campaign-starts-at"
                                        type="datetime-local"
                                        value={form.starts_at}
                                        onChange={(e) => setField("starts_at", e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="campaign-ends-at">Ends at</Label>
                                    <Input
                                        id="campaign-ends-at"
                                        type="datetime-local"
                                        value={form.ends_at}
                                        onChange={(e) => setField("ends_at", e.target.value)}
                                        aria-invalid={Boolean(errors.ends_at)}
                                        aria-describedby={errors.ends_at ? "campaign-ends-at-error" : undefined}
                                    />
                                    {errors.ends_at && (
                                        <p id="campaign-ends-at-error" className="text-xs text-destructive">
                                            {errors.ends_at}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                <div className="grid gap-0.5">
                                    <Label htmlFor="campaign-active">Active</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive campaigns stay on past referrals but cannot be picked.
                                    </p>
                                </div>
                                <Switch
                                    id="campaign-active"
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
                                {dialog?.mode === "edit" ? "Save changes" : "Create campaign"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmToggle !== null} onOpenChange={(open) => !open && setConfirmToggle(null)}>
                <AlertDialogContent size="sm" className="w-[95vw] rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {togglingToActive ? "Activate campaign?" : "Deactivate campaign?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmToggle
                                ? togglingToActive
                                    ? `"${confirmToggle.title}" becomes available for new referrals again.`
                                    : `"${confirmToggle.title}" will no longer be offered for new referrals. Referrals already carrying it keep it.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={toggling}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant={togglingToActive ? "default" : "destructive"}
                            disabled={toggling}
                            onClick={(e) => void handleToggle(e)}
                        >
                            {toggling ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : togglingToActive ? (
                                <Power className="size-4" />
                            ) : (
                                <PowerOff className="size-4" />
                            )}
                            {togglingToActive ? "Activate" : "Deactivate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
