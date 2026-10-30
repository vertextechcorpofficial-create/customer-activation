"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { LeadCreateSchema, type LeadCreate, type SourceOption } from "../types/lead.schema";
import { createLead } from "../providers/lead-provider";
import { TagMultiCombobox } from "./tag-multi-combobox";
import { cn } from "@/lib/utils";

interface TelemarketingProduct {
    product_id: number;
    product_code: string;
    name: string;
    is_active: number | boolean;
    sort_order: number | null;
}

const PRODUCTS_URL = "/api/customer-activation/telemarketing/telemarketing-products";

/**
 * Active products for the single-select. Never throws: a missing catalog
 * resolves to an empty list so the form keeps its layout and the field
 * validates as "select a product" instead of breaking.
 */
function useProducts() {
    const [products, setProducts] = useState<TelemarketingProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
                const body = (await res.json().catch(() => null)) as {
                    success: boolean;
                    data?: TelemarketingProduct[];
                    message?: string;
                } | null;
                if (!res.ok || !body?.success) throw new Error(body?.message ?? "Could not load products");
                if (!cancelled) setProducts((body.data ?? []).filter((p) => Number(p.is_active) === 1));
            } catch (e) {
                if (!cancelled) {
                    setProducts([]);
                    setError(e instanceof Error ? e.message : "Could not load products");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [nonce]);

    return { products, isLoading, error, retry: () => setNonce((n) => n + 1) };
}

/** Required single-select over the product catalog — Popover + Command, one product per lead. */
export function ProductCombobox({
    controlId,
    value,
    onChange,
    disabled,
    invalid,
    describedBy,
}: {
    controlId: string;
    value: number | null;
    onChange: (id: number) => void;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
}) {
    const { products, isLoading, error, retry } = useProducts();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const filtered = q
        ? products.filter(
              (p) => p.name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q),
          )
        : products;
    const selected = products.find((p) => p.product_id === value) ?? null;
    const label = selected ? selected.name : isLoading ? "Loading products…" : "Select a product";

    return (
        <>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) setQuery("");
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        id={controlId}
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-label="Product"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        disabled={disabled}
                        className="h-9 w-full justify-between font-normal"
                    >
                        <span className="min-w-0 flex-1 truncate text-left" title={label}>
                            {label}
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false} label="Search products">
                        <CommandInput placeholder="Search products…" value={query} onValueChange={setQuery} />
                        <CommandList className="max-h-60">
                            <CommandEmpty>
                                {isLoading
                                    ? "Loading products…"
                                    : error
                                      ? "Could not load products."
                                      : "No products found."}
                            </CommandEmpty>
                            <CommandGroup>
                                {filtered.map((p) => (
                                    <CommandItem
                                        key={p.product_id}
                                        value={`${p.name} ${p.product_code}`}
                                        keywords={[p.name, p.product_code]}
                                        title={p.name}
                                        onSelect={() => {
                                            onChange(p.product_id);
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                p.product_id === value ? "opacity-100" : "opacity-0",
                                            )}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {error && !isLoading ? (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={retry}
                        className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Retry
                    </button>
                </p>
            ) : null}
        </>
    );
}

export interface LeadPrefill {
    company_name?: string;
    contact_name?: string | null;
    mobile?: string | null;
    email?: string | null;
    address?: string | null;
    industry?: string | null;
    product_interest?: string | null;
    need?: string | null;
    /** Referral accounts only: the registrant's job title — display only, never written to the lead. */
    position?: string | null;
    source: SourceOption;
    party_kind?: "customer" | "company" | "dealer" | "none";
    party_id?: number | null;
    /** Client the row was browsed from — recorded as lead provenance when the column exists. */
    dealer_id?: number | null;
    /** Referral accounts only: `referrer_id` of the account — persisted on the lead. Other sources send nothing. */
    referrer_id?: number | null;
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
    const [productId, setProductId] = useState<number | null>(null);
    const [need, setNeed] = useState("");
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Inline, calm validation surface — set on submit, cleared as the user types.
    const [fieldErrors, setFieldErrors] = useState<{ company?: string; contact?: string; product?: string }>({});

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
        setProductId(null);
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
        const nextErrors: { company?: string; contact?: string; product?: string } = {};
        if (!companyName.trim()) nextErrors.company = "Company name is required";
        if (!mobile.trim() && !email.trim()) nextErrors.contact = "Enter a mobile number or an email address";
        if (productId === null) nextErrors.product = "Select a product";
        setFieldErrors(nextErrors);
        if (nextErrors.company || nextErrors.contact || nextErrors.product) return;
        const tags = tagIds.filter((v) => Number.isInteger(v));
        const parsed = LeadCreateSchema.safeParse({
            source,
            party_kind: prefill?.party_kind ?? "none",
            party_id: prefill?.party_id ?? null,
            dealer_id: prefill?.dealer_id ?? undefined,
            referrer_id: prefill?.referrer_id ?? undefined,
            company_name: companyName.trim(),
            contact_name: contactName.trim() || null,
            mobile: mobile.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            industry: industry.trim() || null,
            need: need.trim() || null,
            tag_ids: tags.length ? tags : undefined,
        });
        if (!parsed.success) {
            toast.error("Check the form", { description: parsed.error.issues[0]?.message ?? "Invalid input" });
            return;
        }
        setIsSubmitting(true);
        try {
            // product_id rides alongside the schema payload until LeadCreateSchema
            // carries it — the provider serializes the whole object.
            const outcome = await createLead({ ...parsed.data, product_id: productId } as LeadCreate);
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
            <DialogContent className="flex h-[min(90dvh,44rem)] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                <DialogHeader className="shrink-0 p-6 pb-0">
                    <DialogTitle>Create lead</DialogTitle>
                    <DialogDescription>Snapshot is copied onto the lead at creation.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-6 py-4">
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
                            required
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
                        {prefill?.position ? (
                            <div className="grid gap-1.5">
                                <Label htmlFor="lg-position">Position</Label>
                                <Input id="lg-position" value={prefill.position} disabled readOnly />
                            </div>
                        ) : (
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
                        )}
                    </div>
                    {prefill?.position ? (
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
                    ) : null}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-mobile">Mobile</Label>
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
                                aria-describedby={
                                    fieldErrors.contact ? "lg-contact-hint lg-contact-error" : "lg-contact-hint"
                                }
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="lg-email">Email</Label>
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
                                aria-describedby={
                                    fieldErrors.contact ? "lg-contact-hint lg-contact-error" : "lg-contact-hint"
                                }
                            />
                        </div>
                    </div>
                    <p id="lg-contact-hint" className="text-xs text-muted-foreground">
                        Mobile or email required
                    </p>
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
                        <Label htmlFor="lg-product">
                            Product <span className="text-destructive">*</span>
                        </Label>
                        <ProductCombobox
                            controlId="lg-product"
                            value={productId}
                            onChange={(id) => {
                                setProductId(id);
                                if (fieldErrors.product) setFieldErrors((prev) => ({ ...prev, product: undefined }));
                            }}
                            disabled={isSubmitting}
                            invalid={Boolean(fieldErrors.product)}
                            describedBy={fieldErrors.product ? "lg-product-error" : undefined}
                        />
                        {fieldErrors.product ? (
                            <p id="lg-product-error" role="alert" className="text-xs text-destructive">
                                {fieldErrors.product}
                            </p>
                        ) : null}
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
                    </div>
                    <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
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
