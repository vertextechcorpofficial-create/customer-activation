"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Package, Pencil, Plus, Power, PowerOff, RefreshCw } from "lucide-react";
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
import type { Product } from "../types/product.schema";
import { useProducts } from "../hooks/use-products";

const flagOn = (v: Product["is_active"]) => Number(v) === 1;

function ProductStatus({ product }: { product: Product }) {
    return flagOn(product.is_active) ? (
        <StatusPill tone="success">Active</StatusPill>
    ) : (
        <StatusPill tone="neutral">Inactive</StatusPill>
    );
}

interface FormState {
    product_code: string;
    name: string;
    description: string;
    sort_order: string;
    is_active: boolean;
}

type FormErrors = Partial<Record<"product_code" | "name" | "description" | "sort_order", string>>;

const EMPTY_FORM: FormState = { product_code: "", name: "", description: "", sort_order: "0", is_active: true };

function formFrom(product: Product): FormState {
    return {
        product_code: product.product_code,
        name: product.name,
        description: product.description ?? "",
        sort_order: String(product.sort_order),
        is_active: flagOn(product.is_active),
    };
}

function ProductActions({
    product,
    busy,
    size = "icon-sm",
    onEdit,
    onToggleActive,
}: {
    product: Product;
    busy: boolean;
    size?: "icon-sm" | "icon";
    onEdit: (product: Product) => void;
    onToggleActive: (product: Product) => void;
}) {
    const active = flagOn(product.is_active);
    return (
        <div className="flex items-center justify-center gap-1">
            <Button
                variant="ghost"
                size={size}
                aria-label={`Edit ${product.name}`}
                title="Edit product"
                onClick={() => onEdit(product)}
                className="focus-visible:ring-ring"
            >
                <Pencil className="size-4" />
            </Button>
            <Button
                variant="ghost"
                size={size}
                aria-label={`${active ? "Deactivate" : "Activate"} ${product.name}`}
                title={active ? "Deactivate product" : "Activate product"}
                disabled={busy}
                onClick={() => onToggleActive(product)}
                className="focus-visible:ring-ring"
            >
                {active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
            </Button>
        </div>
    );
}

export function ProductSettings() {
    const { products, isLoading, error, refresh, createProduct, updateProduct, setProductActive } =
        useProducts();
    const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; product: Product } | null>(
        null,
    );
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState<Product | null>(null);

    const countLabel = error ? "—" : `${products.length} ${products.length === 1 ? "product" : "products"}`;

    const openCreate = () => {
        setForm({ ...EMPTY_FORM });
        setErrors({});
        setDialog({ mode: "create" });
    };

    const openEdit = (product: Product) => {
        setForm(formFrom(product));
        setErrors({});
        setDialog({ mode: "edit", product });
    };

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => (prev[key as keyof FormErrors] ? { ...prev, [key]: undefined } : prev));
    };

    const validate = (): boolean => {
        const next: FormErrors = {};
        if (!form.product_code.trim()) next.product_code = "Enter a product code.";
        if (!form.name.trim()) next.name = "Enter a product name.";
        if (form.description.trim().length > 500)
            next.description = "Description must be 500 characters or fewer.";
        if (!/^\d+$/.test(form.sort_order.trim())) next.sort_order = "Sort order must be a whole number.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!dialog || submitting || !validate()) return;
        setSubmitting(true);
        const trimmedDescription = form.description.trim();
        const payload = {
            product_code: form.product_code.trim(),
            name: form.name.trim(),
            description: trimmedDescription === "" ? null : trimmedDescription,
            sort_order: Number(form.sort_order.trim()),
            is_active: form.is_active,
        };
        const ok =
            dialog.mode === "create"
                ? await createProduct(payload)
                : await updateProduct(dialog.product.product_id, payload);
        setSubmitting(false);
        if (ok) setDialog(null);
    };

    const handleToggle = async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        if (!confirmToggle || toggling) return;
        setToggling(true);
        const ok = await setProductActive(confirmToggle.product_id, !flagOn(confirmToggle.is_active));
        setToggling(false);
        if (ok) setConfirmToggle(null);
    };

    const togglingToActive = confirmToggle ? !flagOn(confirmToggle.is_active) : false;

    return (
        <div className="mx-auto w-full max-w-screen-2xl space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="grid gap-1">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Products</h1>
                        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                            {countLabel}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Catalogue the products agents can attach to telemarketing leads.
                    </p>
                </div>
                <Button onClick={openCreate} className="min-h-11 shrink-0 md:min-h-0">
                    <Plus className="size-4" />
                    New product
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
                                <AlertTitle>Could not load products</AlertTitle>
                                <AlertDescription>
                                    <p>{error}</p>
                                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                                        <RefreshCw className="size-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="p-6">
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Package />
                                    </EmptyMedia>
                                    <EmptyTitle>No products yet</EmptyTitle>
                                    <EmptyDescription>
                                        Create the first product to start tagging leads with what they asked about.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={openCreate} className="min-h-11 md:min-h-0">
                                        <Plus className="size-4" />
                                        New product
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-border md:hidden">
                                {products.map((product) => (
                                    <li key={product.product_id} className="flex flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium break-words">{product.name}</p>
                                                {product.description ? (
                                                    <p
                                                        className="truncate text-xs text-muted-foreground"
                                                        title={product.description}
                                                    >
                                                        {product.description}
                                                    </p>
                                                ) : null}
                                                <p className="font-mono text-xs text-muted-foreground break-words">
                                                    {product.product_code}
                                                </p>
                                            </div>
                                            <ProductStatus product={product} />
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                Order {product.sort_order}
                                            </span>
                                            <ProductActions
                                                product={product}
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
                                            <TableHead>Name</TableHead>
                                            <TableHead className="w-28">Sort order</TableHead>
                                            <TableHead className="w-32">Status</TableHead>
                                            <TableHead className="w-36 text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.map((product) => (
                                            <TableRow key={product.product_id}>
                                                <TableCell
                                                    className="max-w-40 truncate font-mono text-xs"
                                                    title={product.product_code}
                                                >
                                                    {product.product_code}
                                                </TableCell>
                                                <TableCell className="max-w-64">
                                                    <p className="truncate" title={product.name}>
                                                        {product.name}
                                                    </p>
                                                    {product.description ? (
                                                        <p
                                                            className="truncate text-xs text-muted-foreground"
                                                            title={product.description}
                                                        >
                                                            {product.description}
                                                        </p>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="tabular-nums">{product.sort_order}</TableCell>
                                                <TableCell>
                                                    <ProductStatus product={product} />
                                                </TableCell>
                                                <TableCell>
                                                    <ProductActions
                                                        product={product}
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
                            {dialog?.mode === "edit" ? "Edit product" : "New product"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "edit"
                                ? "Rename the product or change its order and availability."
                                : "Add a product agents can attach to telemarketing leads."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="product-code">
                                    Code <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="product-code"
                                    value={form.product_code}
                                    onChange={(e) => setField("product_code", e.target.value)}
                                    placeholder="e.g. fiber-plan-100"
                                    maxLength={64}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.product_code)}
                                    aria-describedby={errors.product_code ? "product-code-error" : undefined}
                                />
                                {errors.product_code && (
                                    <p id="product-code-error" className="text-xs text-destructive">
                                        {errors.product_code}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="product-name">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="product-name"
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder="e.g. Fiber Plan 100 Mbps"
                                    maxLength={191}
                                    aria-required="true"
                                    aria-invalid={Boolean(errors.name)}
                                    aria-describedby={errors.name ? "product-name-error" : undefined}
                                />
                                {errors.name && (
                                    <p id="product-name-error" className="text-xs text-destructive">
                                        {errors.name}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-baseline justify-between gap-2">
                                    <Label htmlFor="product-description">Description</Label>
                                    <span
                                        className="text-xs tabular-nums text-muted-foreground"
                                        aria-live="polite"
                                    >
                                        {form.description.trim().length}/500
                                    </span>
                                </div>
                                <Textarea
                                    id="product-description"
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                    placeholder="Short copy shown on the website, e.g. what this plan includes."
                                    maxLength={500}
                                    rows={3}
                                    aria-invalid={Boolean(errors.description)}
                                    aria-describedby={
                                        errors.description ? "product-description-error" : undefined
                                    }
                                />
                                {errors.description && (
                                    <p id="product-description-error" className="text-xs text-destructive">
                                        {errors.description}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="product-sort-order">Sort order</Label>
                                <Input
                                    id="product-sort-order"
                                    value={form.sort_order}
                                    onChange={(e) => setField("sort_order", e.target.value)}
                                    placeholder="0"
                                    inputMode="numeric"
                                    aria-invalid={Boolean(errors.sort_order)}
                                    aria-describedby={errors.sort_order ? "product-sort-order-error" : undefined}
                                />
                                {errors.sort_order && (
                                    <p id="product-sort-order-error" className="text-xs text-destructive">
                                        {errors.sort_order}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                <div className="grid gap-0.5">
                                    <Label htmlFor="product-active">Active</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive products stay on past leads but cannot be picked.
                                    </p>
                                </div>
                                <Switch
                                    id="product-active"
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
                                {dialog?.mode === "edit" ? "Save changes" : "Create product"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmToggle !== null} onOpenChange={(open) => !open && setConfirmToggle(null)}>
                <AlertDialogContent size="sm" className="w-[95vw] rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {togglingToActive ? "Activate product?" : "Deactivate product?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmToggle
                                ? togglingToActive
                                    ? `"${confirmToggle.name}" becomes available for new leads again.`
                                    : `"${confirmToggle.name}" will no longer be offered for new leads. Leads already carrying it keep it.`
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
