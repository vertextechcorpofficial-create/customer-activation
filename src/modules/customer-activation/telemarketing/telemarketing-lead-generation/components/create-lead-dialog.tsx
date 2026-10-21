"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
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
    const [tagIds, setTagIds] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        setTagIds("");
    }, [open, prefillKey]);

    const source = prefill?.source ?? "prospecting";
    const canSubmit =
        companyName.trim().length > 0 && (mobile.trim().length > 0 || email.trim().length > 0) && !isSubmitting;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        const tags = tagIds
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isInteger(v));
        const parsed = LeadCreateSchema.safeParse({
            source,
            party_kind: prefill?.party_kind ?? "none",
            party_id: prefill?.party_id ?? null,
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create lead</DialogTitle>
                    <DialogDescription>Snapshot is copied onto the lead at creation.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-source">Source</Label>
                        <Input id="lg-source" value={source} disabled readOnly />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-company">Company name</Label>
                        <Input
                            id="lg-company"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Acme Trading"
                            maxLength={191}
                        />
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
                            <Label htmlFor="lg-mobile">Mobile</Label>
                            <Input
                                id="lg-mobile"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                placeholder="0917…"
                                maxLength={32}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-email">Email</Label>
                            <Input
                                id="lg-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="jane@example.com"
                                maxLength={191}
                            />
                        </div>
                    </div>
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
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="lg-tags">Tags (optional, comma-separated IDs)</Label>
                        <Input
                            id="lg-tags"
                            value={tagIds}
                            onChange={(e) => setTagIds(e.target.value)}
                            placeholder="1, 2"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {isSubmitting ? "Creating…" : "Submit"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
