"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Loader2, Megaphone, Pencil, Plus, Power, PowerOff, RefreshCw } from "lucide-react";
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "./status-pill";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Campaign } from "../types/campaign.schema";
import { durationTitle, formatCampaignDuration } from "./campaign-duration";
import { useCampaigns } from "../hooks/use-campaigns";

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

function CampaignActions({
    campaign,
    busy,
    size = "icon-sm",
    onEdit,
    onToggleActive,
}: {
    campaign: Campaign;
    busy: boolean;
    size?: "icon-sm" | "icon";
    onEdit: (campaign: Campaign) => void;
    onToggleActive: (campaign: Campaign) => void;
}) {
    const active = flagOn(campaign.is_active);
    const hasPage = campaign.content_json != null;
    return (
        <div className="flex items-center justify-center gap-1">
            <Button
                variant="ghost"
                size={size}
                aria-label={`Edit content for ${campaign.title}`}
                title={
                    hasPage
                        ? "Custom page (v2)"
                        : "No page authored yet — the site shows the title and description"
                }
                asChild
                className={hasPage ? "focus-visible:ring-ring" : "text-muted-foreground focus-visible:ring-ring"}
            >
                <Link href={`/customer-activation/referrals/referral-campaigns/${campaign.campaign_id}/content`}>
                    <FileText className="size-4" />
                </Link>
            </Button>
            <Button
                variant="ghost"
                size={size}
                aria-label={`Edit ${campaign.title}`}
                title="Edit campaign"
                onClick={() => onEdit(campaign)}
                className="focus-visible:ring-ring"
            >
                <Pencil className="size-4" />
            </Button>
            <Button
                variant="ghost"
                size={size}
                aria-label={`${active ? "Deactivate" : "Activate"} ${campaign.title}`}
                title={active ? "Deactivate campaign" : "Activate campaign"}
                disabled={busy}
                onClick={() => onToggleActive(campaign)}
                className="focus-visible:ring-ring"
            >
                {active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            </Button>
        </div>
    );
}

export function CampaignSettings() {
    const { campaigns, isLoading, error, refresh, createCampaign, updateCampaign, setCampaignActive } =
        useCampaigns();
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; campaign: Campaign } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState<Campaign | null>(null);

    const countLabel = error ? "—" : `${campaigns.length} ${campaigns.length === 1 ? "campaign" : "campaigns"}`;

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

    return (
        <div className="mx-auto w-full max-w-screen-2xl space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Campaigns</h1>
                        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Define referral campaign windows. Content is managed separately.
                    </p>
                </div>
                <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
                    <Plus className="size-4" />
                    New campaign
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
                    ) : campaigns.length === 0 ? (
                        <div className="p-6">
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
                                    <Button onClick={openCreate} className="min-h-11 md:min-h-0">
                                        <Plus className="size-4" />
                                        New campaign
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-border md:hidden">
                                {campaigns.map((campaign) => (
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
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className="text-xs text-muted-foreground tabular-nums"
                                                title={windowTitle(campaign)}
                                            >
                                                {windowLabel(campaign)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <CampaignActions
                                                campaign={campaign}
                                                busy={toggling}
                                                size="icon"
                                                onEdit={openEdit}
                                                onToggleActive={setConfirmToggle}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="hidden md:block [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3">
                                <Table className="min-w-2xl">
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-40">Code</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead className="w-[240px]">Campaign Duration</TableHead>
                                            <TableHead className="w-28">Status</TableHead>
                                            <TableHead className="w-28 text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {campaigns.map((campaign) => (
                                            <TableRow key={campaign.campaign_id}>
                                                <TableCell
                                                    className="max-w-40 truncate font-mono text-xs"
                                                    title={campaign.campaign_code}
                                                >
                                                    {campaign.campaign_code}
                                                </TableCell>
                                                <TableCell className="truncate" title={campaign.title}>
                                                    {campaign.title}
                                                </TableCell>
                                                <TableCell
                                                    className="w-[240px] text-xs whitespace-nowrap text-muted-foreground tabular-nums"
                                                    title={windowTitle(campaign)}
                                                >
                                                    {windowLabel(campaign)}
                                                </TableCell>
                                                <TableCell>
                                                    <CampaignStatus campaign={campaign} />
                                                </TableCell>
                                                <TableCell>
                                                    <CampaignActions
                                                        campaign={campaign}
                                                        busy={toggling}
                                                        onEdit={openEdit}
                                                        onToggleActive={setConfirmToggle}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-muted-foreground tabular-nums">{countLabel}</p>
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
