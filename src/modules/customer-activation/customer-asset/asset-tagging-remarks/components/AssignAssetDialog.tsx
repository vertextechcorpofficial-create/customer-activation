"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { CustomerCombobox, ItemCombobox } from "./OptionCombobox";
import type { CreateTaggingInput } from "../types/asset-tagging-remarks.schema";
import type { AvailableItem, CustomerOption } from "../types/asset-tagging-remarks.view";

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const AssignFormSchema = z.object({
    customer_id: z.number().int().positive("Pick a customer from the list."),
    item_id: z.number().int().positive("Select an item."),
    quantity: z.number().int().min(1, "Quantity must be at least 1."),
    expected_return_at: z
        .string()
        .refine((v) => !v || DATETIME_LOCAL.test(v), "Pick a valid date and time")
        .optional(),
    condition_out: z.string().max(64).nullable().optional(),
    remarks: z.string().max(4000).nullable().optional(),
});

type AssignFormValues = z.infer<typeof AssignFormSchema>;

interface AssignAssetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: AvailableItem[];
    onLoadAllCustomers: () => Promise<CustomerOption[]>;
    onAssign: (input: CreateTaggingInput) => Promise<boolean>;
}

export function AssignAssetDialog({
    open,
    onOpenChange,
    items,
    onLoadAllCustomers,
    onAssign,
}: AssignAssetDialogProps) {
    const [allCustomers, setAllCustomers] = useState<CustomerOption[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [customersError, setCustomersError] = useState<string | null>(null);
    // Remount key so both comboboxes clear search/open state on each open.
    const [session, setSession] = useState(0);

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<AssignFormValues>({
        resolver: zodResolver(AssignFormSchema),
        defaultValues: {
            customer_id: 0,
            item_id: 0,
            quantity: 1,
            expected_return_at: "",
            condition_out: "",
            remarks: "",
        },
    });

    const selectedItem = items.find((i) => i.id === watch("item_id")) ?? null;
    const selectedCustomerId = watch("customer_id");
    const selectedCustomer = allCustomers.find((c) => c.id === selectedCustomerId) ?? null;
    const available = selectedItem?.quantity_available ?? 0;

    useEffect(() => {
        if (!open) return;
        reset({
            customer_id: 0,
            item_id: 0,
            quantity: 1,
            expected_return_at: "",
            condition_out: "",
            remarks: "",
        });
        setSession((s) => s + 1);
        setLoadingCustomers(true);
        setCustomersError(null);
        onLoadAllCustomers()
            .then(setAllCustomers)
            .catch(() => setCustomersError("Could not load customers."))
            .finally(() => setLoadingCustomers(false));
        // Load once per open; the loader identity is stable from the hook.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const retryLoad = () => {
        setLoadingCustomers(true);
        setCustomersError(null);
        onLoadAllCustomers()
            .then((rows) => {
                setAllCustomers(rows);
                setSession((s) => s + 1);
            })
            .catch(() => setCustomersError("Could not load customers."))
            .finally(() => setLoadingCustomers(false));
    };

    const onSubmit = async (values: AssignFormValues) => {
        // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:00" PH wall time; partial
        // values never reach the server — the schema rejects them first.
        const raw = values.expected_return_at?.trim() ?? "";
        const expected =
            raw && DATETIME_LOCAL.test(raw)
                ? `${raw.slice(0, 10)} ${raw.slice(11, 16)}:00`
                : null;
        const ok = await onAssign({
            customer_id: values.customer_id,
            item_id: values.item_id,
            quantity: values.quantity,
            ...(expected ? { expected_return_at: expected } : {}),
            condition_out: values.condition_out?.trim() ? values.condition_out.trim() : null,
            remarks: values.remarks?.trim() ? values.remarks.trim() : null,
        });
        if (ok) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Tag asset to customer</DialogTitle>
                    <DialogDescription>
                        Assign an available asset to a customer. Availability is re-checked on save.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid">
                    <div className="grid max-h-[60dvh] gap-4 overflow-y-auto px-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="assign-customer">Customer</Label>
                            <Controller
                                name="customer_id"
                                control={control}
                                render={({ field }) => (
                                    <CustomerCombobox
                                        key={`customer-${session}`}
                                        customers={allCustomers}
                                        value={selectedCustomer}
                                        onChange={(c) =>
                                            field.onChange(c.id, { shouldValidate: true })
                                        }
                                        isLoading={loadingCustomers}
                                        loadError={customersError}
                                        onRetry={retryLoad}
                                        disabled={loadingCustomers}
                                        ariaInvalid={Boolean(errors.customer_id)}
                                    />
                                )}
                            />
                            {errors.customer_id ? (
                                <p className="text-xs text-destructive">{errors.customer_id.message}</p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="assign-item">Item</Label>
                            <Controller
                                name="item_id"
                                control={control}
                                render={({ field }) => (
                                    <ItemCombobox
                                        key={`item-${session}`}
                                        items={items}
                                        value={selectedItem}
                                        onChange={(item) =>
                                            field.onChange(item.id, { shouldValidate: true })
                                        }
                                        ariaInvalid={Boolean(errors.item_id)}
                                    />
                                )}
                            />
                            {selectedItem ? (
                                <p className="text-xs tabular-nums text-muted-foreground">
                                    {available} of {selectedItem.quantity} unit(s) available.
                                </p>
                            ) : null}
                            {errors.item_id ? (
                                <p className="text-xs text-destructive">{errors.item_id.message}</p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="assign-quantity">Quantity</Label>
                            <Input
                                id="assign-quantity"
                                type="number"
                                min={1}
                                max={Math.max(available, 1)}
                                {...register("quantity", { valueAsNumber: true })}
                                className="tabular-nums"
                                aria-invalid={Boolean(errors.quantity)}
                            />
                            {errors.quantity ? (
                                <p className="text-xs text-destructive">{errors.quantity.message}</p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="assign-expected">Expected return (optional)</Label>
                            <Input
                                id="assign-expected"
                                type="datetime-local"
                                {...register("expected_return_at")}
                                aria-invalid={Boolean(errors.expected_return_at)}
                            />
                            {errors.expected_return_at ? (
                                <p className="text-xs text-destructive">
                                    {errors.expected_return_at.message}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="assign-condition">Condition out</Label>
                            <Input
                                id="assign-condition"
                                {...register("condition_out")}
                                placeholder="e.g. Brand new"
                                maxLength={64}
                            />
                            {errors.condition_out ? (
                                <p className="text-xs text-destructive">{errors.condition_out.message}</p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="assign-remarks">Remarks</Label>
                            <Textarea
                                id="assign-remarks"
                                {...register("remarks")}
                                placeholder="Why is this asset going out?"
                                rows={3}
                                className="resize-none"
                            />
                            {errors.remarks ? (
                                <p className="text-xs text-destructive">{errors.remarks.message}</p>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            Tag asset
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
