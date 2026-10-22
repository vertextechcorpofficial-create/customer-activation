"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeadCreateSchema, type SourceOption } from "../types/lead.schema";
import { createLead } from "../providers/lead-provider";
import { TagMultiCombobox } from "./tag-multi-combobox";

export interface LeadPrefill {
    company_name?: string;
    contact_name?: string | null;
    mobile?: string | null;
    email?: string | null;
    address?: string | null;
    industry?: string | null;
    product_interest?: string | null;
    need?: string | null;
    source: SourceOption;
    party_kind?: "customer" | "company" | "dealer" | "none";
    party_id?: number | null;
    /** Client the row was browsed from — recorded as lead provenance when the column exists. */
    dealer_id?: number | null;
}

let provenanceWarned = false;

/**
 * Session-once, non-blocking notice that the client origin could not be
 * persisted (the `dealer_id` column is not applied yet). Shared by the single
 * and bulk create paths so one session warns at most once, never per row.
 */
export function warnProvenanceOnce(): void {
    if (provenanceWarned) return;
    provenanceWarned = true;
    toast.warning("Client origin not stored yet", {
        description: "The lead was created, but its client database origin could not be saved yet.",
    });
}

export function CreateLeadDialog({
    open,
    onOpenChange,
    prefill,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prefill: LeadPrefill | null;
    onCreated?: () => void;
}) {
    const [companyName, setCompanyName] = useState("");
    const [contactName, setContactName] = useState("");
    const [mobile, setMobile] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [industry, setIndustry] = useState("");
    const [productInterest, setProductInterest] = useState("");
    const [need, setNeed] = useState("");
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Inline, calm validation surface — set on submit, cleared as the user types.
    const [fieldErrors, setFieldErrors] = useState<{ company?: string; contact?: string }>({});

    const prefillKey = JSON.stringify(prefill);

    useEffect(() => {
        if (!open) return;
        const p = JSON.parse(prefillKey) as LeadPrefill | null;
        setCompanyName(p?.company_name ?? "");
        setContactName(p?.contact_name ?? "");
        setMobile(p?.mobile ?? "");
        setEmail(p?.email ?? "");
        setAddress(p?.address ?? "");
        setIndustry(p?.industry ?? "");
        setProductInterest(p?.product_interest ?? "");
        setNeed(p?.need ?? "");
        setTagIds([]);
        setFieldErrors({});
    }, [open, prefillKey]);

    const source = prefill?.source ?? "prospecting";
    const canSubmit =
        companyName.trim().length > 0 && (mobile.trim().length > 0 || email.trim().length > 0) && !isSubmitting;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        const nextErrors: { company?: string; contact?: string } = {};
        if (!companyName.trim()) nextErrors.company = "Company name is required";
        if (!mobile.trim() && !email.trim()) nextErrors.contact = "Enter a mobile number or an email address";
        setFieldErrors(nextErrors);
        if (nextErrors.company || nextErrors.contact) return;
        const tags = tagIds.filter((v) => Number.isInteger(v));
        const parsed = LeadCreateSchema.safeParse({
            source,
            party_kind: prefill?.party_kind ?? "none",
            party_id: prefill?.party_id ?? null,
            dealer_id: prefill?.dealer_id ?? undefined,
            company_name: companyName.trim(),
            contact_name: contactName.trim() || null,
            mobile: mobile.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            industry: industry.trim() || null,
            product_interest: productInterest.trim() || null,
            need: need.trim() || null,
            tag_ids: tags.length ? tags : undefined,
        });
        if (!parsed.success) {
            toast.error("Check the form", { description: parsed.error.issues[0]?.message ?? "Invalid input" });
            return;
        }
        setIsSubmitting(true);
        try {
            const outcome = await createLead(parsed.data);
            if (outcome.duplicate) {
                toast.error("Duplicate lead", {
                    description: outcome.matched.label ? `Matches ${outcome.matched.label}` : "Already exists",
                });
                return;
            }
            toast.success(`Lead ${outcome.lead.lead_code} created`);
            if (!outcome.provenance_recorded) warnProvenanceOnce();
            onOpenChange(false);
            onCreated?.();
        } catch (err) {
            toast.error("Failed to create lead", {
                description: err instanceof Error ? err.message : "Something went wrong",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-[500px]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Create lead</DialogTitle>
                    <DialogDescription>Snapshot is copied onto the lead at creation.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-3 p-6 pt-0">
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-source">Source</Label>
                        <Input id="lg-source" value={source} disabled readOnly />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-company">
                            Company name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="lg-company"
                            value={companyName}
                            onChange={(e) => {
                                setCompanyName(e.target.value);
                                if (fieldErrors.company) setFieldErrors((prev) => ({ ...prev, company: undefined }));
                            }}
                            placeholder="Acme Trading"
                            maxLength={191}
                            aria-invalid={Boolean(fieldErrors.company)}
                            aria-describedby={fieldErrors.company ? "lg-company-error" : undefined}
                        />
                        {fieldErrors.company ? (
                            <p id="lg-company-error" role="alert" className="text-xs text-destructive">
                                {fieldErrors.company}
                            </p>
                        ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-contact">Contact name</Label>
                            <Input
                                id="lg-contact"
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                placeholder="Jane Dela Cruz"
                                maxLength={191}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-industry">Industry</Label>
                            <Input
                                id="lg-industry"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="Retail"
                                maxLength={128}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-mobile">
                                Mobile <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="lg-mobile"
                                value={mobile}
                                onChange={(e) => {
                                    setMobile(e.target.value);
                                    if (fieldErrors.contact) setFieldErrors((prev) => ({ ...prev, contact: undefined }));
                                }}
                                placeholder="0917…"
                                maxLength={32}
                                aria-invalid={Boolean(fieldErrors.contact)}
                                aria-describedby={fieldErrors.contact ? "lg-contact-error" : undefined}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-email">
                                Email <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="lg-email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (fieldErrors.contact) setFieldErrors((prev) => ({ ...prev, contact: undefined }));
                                }}
                                placeholder="jane@example.com"
                                maxLength={191}
                                aria-invalid={Boolean(fieldErrors.contact)}
                                aria-describedby={fieldErrors.contact ? "lg-contact-error" : undefined}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Mobile or email required</p>
                    {fieldErrors.contact ? (
                        <p id="lg-contact-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.contact}
                        </p>
                    ) : null}
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-address">Address</Label>
                        <Input
                            id="lg-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Street, City, Province"
                            maxLength={255}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-interest">Product interest</Label>
                        <Input
                            id="lg-interest"
                            value={productInterest}
                            onChange={(e) => setProductInterest(e.target.value)}
                            placeholder="Product or category"
                            maxLength={64}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-need">Need</Label>
                        <Textarea
                            id="lg-need"
                            value={need}
                            onChange={(e) => setNeed(e.target.value)}
                            placeholder="What the customer needs…"
                            rows={3}
                            className="resize-none min-h-[100px]"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Tags (optional)</Label>
                        <TagMultiCombobox
                            value={tagIds}
                            onChange={setTagIds}
                            disabled={isSubmitting}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isSubmitting}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={!canSubmit}>
                            {isSubmitting ? "Creating…" : "Submit"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
