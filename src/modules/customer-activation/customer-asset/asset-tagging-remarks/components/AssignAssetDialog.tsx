"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTaggingInput } from "../types/asset-tagging-remarks.schema";
import type { AvailableItem, CustomerOption } from "../types/asset-tagging-remarks.view";

const AssignFormSchema = z.object({
    customer_id: z.number().int().positive("Pick a customer from the search results."),
    item_id: z.number().int().positive("Select an item."),
    quantity: z.number().int().min(1, "Quantity must be at least 1."),
    expected_return_at: z.string().optional(),
    condition_out: z.string().max(64).nullable().optional(),
    remarks: z.string().max(4000).nullable().optional(),
});

type AssignFormValues = z.infer<typeof AssignFormSchema>;

interface AssignAssetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: AvailableItem[];
    onSearchCustomers: (query: string) => Promise<CustomerOption[]>;
    onAssign: (input: CreateTaggingInput) => Promise<boolean>;
}

export function AssignAssetDialog({
    open,
    onOpenChange,
    items,
    onSearchCustomers,
    onAssign,
}: AssignAssetDialogProps) {
    const [customerQuery, setCustomerQuery] = useState("");
    const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
    const [searching, setSearching] = useState(false);

    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
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
    const available = selectedItem?.quantity_available ?? 0;

    useEffect(() => {
        if (open) {
            reset({
                customer_id: 0,
                item_id: 0,
                quantity: 1,
                expected_return_at: "",
                condition_out: "",
                remarks: "",
            });
            setCustomerQuery("");
            setCustomerOptions([]);
        }
    }, [open, reset]);

    const debouncedSearch = useDebouncedCallback(async (q: string) => {
        setSearching(true);
        try {
            setCustomerOptions(await onSearchCustomers(q));
        } finally {
            setSearching(false);
        }
    }, 300);

    const onSubmit = async (values: AssignFormValues) => {
        // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:00" PH wall time.
        const expected = values.expected_return_at?.trim()
            ? `${values.expected_return_at.slice(0, 10)} ${values.expected_return_at.slice(11, 16)}:00`
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
            <DialogContent className="w-[95vw] sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Tag asset to customer</DialogTitle>
                    <DialogDescription>
                        Assign an available asset to a customer. Availability is re-checked on save.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="assign-customer">Customer</Label>
                        <Input
                            id="assign-customer"
                            value={customerQuery}
                            onChange={(e) => {
                                setCustomerQuery(e.target.value);
                                setValue("customer_id", 0);
                                void debouncedSearch(e.target.value);
                            }}
                            placeholder="Type to search customers…"
                            autoComplete="off"
                            aria-invalid={Boolean(errors.customer_id)}
                        />
                        {searching ? (
                            <p className="text-xs text-muted-foreground">Searching…</p>
                        ) : customerOptions.length > 0 ? (
                            <ul
                                className="max-h-36 overflow-y-auto rounded-md border p-1"
                                role="listbox"
                                aria-label="Matching customers"
                            >
                                {customerOptions.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={false}
                                            className="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                            onClick={() => {
                                                setValue("customer_id", c.id, { shouldValidate: true });
                                                setCustomerQuery(
                                                    c.customer_code
                                                        ? `${c.customer_name} (${c.customer_code})`
                                                        : c.customer_name,
                                                );
                                                setCustomerOptions([]);
                                            }}
                                        >
                                            <span className="block truncate">{c.customer_name}</span>
                                            {c.customer_code ? (
                                                <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                                                    {c.customer_code}
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
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
                                <Select
                                    value={field.value ? String(field.value) : ""}
                                    onValueChange={(v) => field.onChange(Number(v))}
                                >
                                    <SelectTrigger id="assign-item" aria-label="Asset item" className="w-full">
                                        <SelectValue placeholder="Select an available item" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {items
                                            .filter((i) => i.quantity_available > 0)
                                            .map((i) => (
                                                <SelectItem key={i.id} value={String(i.id)}>
                                                    {i.item_code} — {i.name} ({i.quantity_available} avail.)
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
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
                        />
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

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            Tag asset
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
