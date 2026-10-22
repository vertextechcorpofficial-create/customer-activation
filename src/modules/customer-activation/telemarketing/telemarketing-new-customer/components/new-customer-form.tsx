"use client";

import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProspectCreateSchema } from "../types/prospect.schema";
import { useProspectCreate } from "../hooks/use-prospect-create";
import type { DuplicateMatch } from "../providers/prospect-provider";

const BLANK = {
    companyName: "",
    contactName: "",
    contactPosition: "",
    mobile: "",
    email: "",
    address: "",
    industry: "",
    productInterest: "",
    need: "",
};

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="text-xs text-destructive" role="alert">
            {message}
        </p>
    );
}

/** Manual entry of a prospect that never existed as a lead — not conversion. */
export function NewCustomerForm({ onCreated }: { onCreated?: () => void }) {
    const [form, setForm] = useState(BLANK);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
    const { create, isSubmitting } = useProspectCreate();

    const set = (key: keyof typeof BLANK) => (value: string) =>
        setForm((current) => ({ ...current, [key]: value }));

    const canSubmit =
        form.companyName.trim().length > 0 &&
        (form.mobile.trim().length > 0 || form.email.trim().length > 0) &&
        !isSubmitting;

    function reset() {
        setForm(BLANK);
        setFieldErrors({});
        setDuplicate(null);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!canSubmit) return;
        setDuplicate(null);
        const parsed = ProspectCreateSchema.safeParse({
            company_name: form.companyName.trim(),
            contact_name: form.contactName.trim() || null,
            contact_position: form.contactPosition.trim() || null,
            mobile: form.mobile.trim() || null,
            email: form.email.trim() || null,
            address: form.address.trim() || null,
            industry: form.industry.trim() || null,
            product_interest: form.productInterest.trim() || null,
            need: form.need.trim() || null,
        });
        if (!parsed.success) {
            setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
            return;
        }
        setFieldErrors({});
        const outcome = await create(parsed.data);
        if (!outcome) return;
        if (outcome.duplicate) {
            setDuplicate(outcome.matched);
            return;
        }
        reset();
        onCreated?.();
    }

    const error = (field: string) => fieldErrors[field]?.[0];

    return (
        <Card>
            <CardHeader>
                <CardTitle>New prospect</CardTitle>
                <CardDescription>
                    Manually enter a prospect that never existed as a lead. Mobile or email is required.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {duplicate ? (
                    <Alert variant="destructive" className="mb-4">
                        <TriangleAlert aria-hidden />
                        <AlertTitle>Possible duplicate — nothing was saved</AlertTitle>
                        <AlertDescription>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>
                                    Matches {duplicate.label || "an existing record"}
                                    {duplicate.table ? ` in ${duplicate.table}` : ""}.
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => setDuplicate(null)}
                                >
                                    <X className="size-3.5" aria-hidden />
                                    Dismiss
                                </Button>
                            </span>
                        </AlertDescription>
                    </Alert>
                ) : null}
                <form onSubmit={handleSubmit} className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="nc-company">Company name *</Label>
                        <Input
                            id="nc-company"
                            value={form.companyName}
                            onChange={(e) => set("companyName")(e.target.value)}
                            placeholder="Acme Trading"
                            maxLength={191}
                            aria-invalid={Boolean(error("company_name"))}
                        />
                        <FieldError message={error("company_name")} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-contact">Contact name</Label>
                            <Input
                                id="nc-contact"
                                value={form.contactName}
                                onChange={(e) => set("contactName")(e.target.value)}
                                placeholder="Jane Dela Cruz"
                                maxLength={191}
                            />
                            <FieldError message={error("contact_name")} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-position">Contact position</Label>
                            <Input
                                id="nc-position"
                                value={form.contactPosition}
                                onChange={(e) => set("contactPosition")(e.target.value)}
                                placeholder="Purchasing Manager"
                                maxLength={128}
                            />
                            <FieldError message={error("contact_position")} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-mobile">Mobile *</Label>
                            <Input
                                id="nc-mobile"
                                value={form.mobile}
                                onChange={(e) => set("mobile")(e.target.value)}
                                placeholder="0917…"
                                maxLength={32}
                                inputMode="tel"
                                aria-invalid={Boolean(error("mobile"))}
                            />
                            <FieldError message={error("mobile")} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-email">Email *</Label>
                            <Input
                                id="nc-email"
                                type="email"
                                value={form.email}
                                onChange={(e) => set("email")(e.target.value)}
                                placeholder="jane@example.com"
                                maxLength={191}
                                aria-invalid={Boolean(error("email"))}
                            />
                            <FieldError message={error("email")} />
                        </div>
                    </div>
                    <p className="-mt-1 text-xs text-muted-foreground">* Company plus mobile or email.</p>
                    <div className="grid gap-1.5">
                        <Label htmlFor="nc-address">Address</Label>
                        <Input
                            id="nc-address"
                            value={form.address}
                            onChange={(e) => set("address")(e.target.value)}
                            placeholder="Street, City, Province"
                            maxLength={255}
                        />
                        <FieldError message={error("address")} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-industry">Industry</Label>
                            <Input
                                id="nc-industry"
                                value={form.industry}
                                onChange={(e) => set("industry")(e.target.value)}
                                placeholder="Retail"
                                maxLength={128}
                            />
                            <FieldError message={error("industry")} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="nc-interest">Product interest</Label>
                            <Input
                                id="nc-interest"
                                value={form.productInterest}
                                onChange={(e) => set("productInterest")(e.target.value)}
                                placeholder="Product or category"
                                maxLength={191}
                            />
                            <FieldError message={error("product_interest")} />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="nc-need">Need</Label>
                        <Textarea
                            id="nc-need"
                            value={form.need}
                            onChange={(e) => set("need")(e.target.value)}
                            placeholder="What the customer needs…"
                            rows={3}
                        />
                        <FieldError message={error("need")} />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={reset} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {isSubmitting ? "Saving…" : "Submit"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
