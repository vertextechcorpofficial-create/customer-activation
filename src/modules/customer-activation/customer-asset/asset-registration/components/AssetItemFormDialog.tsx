"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    CreateAssetItemSchema,
    type AssetGroup,
    type AssetTag,
    type UpdateAssetItemInput,
} from "../types/asset-registration.schema";
import type { EnrichedAssetItem } from "../services/asset-registration-service";
import type { AssetItemFormValues } from "../hooks/useAssetItems";

interface AssetItemFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: EnrichedAssetItem | null;
    groups: AssetGroup[];
    tags: AssetTag[];
    onCreate: (values: AssetItemFormValues) => Promise<boolean>;
    onUpdate: (id: number, input: UpdateAssetItemInput & { tag_ids?: number[] }) => Promise<boolean>;
}

// The dialog carries tag selection + retire toggle alongside the module schemas,
// so the resolver extends (never replaces) the verified create schema.
const AssetItemFormSchema = CreateAssetItemSchema.extend({
    tag_ids: z.array(z.number().int()).optional(),
    is_retired: z.boolean().optional(),
});
type FormValues = z.infer<typeof AssetItemFormSchema>;

const EMPTY: FormValues = {
    name: "",
    category: "",
    quantity: 1,
    cost_per_item: 0,
    life_span_months: 12,
    date_acquired: new Date().toISOString().slice(0, 10),
    serial: "",
    group_id: null,
    remarks: "",
    tag_ids: [],
};

export function AssetItemFormDialog({
    open,
    onOpenChange,
    item,
    groups,
    tags,
    onCreate,
    onUpdate,
}: AssetItemFormDialogProps) {
    const editing = item !== null;
    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(AssetItemFormSchema),
        defaultValues: EMPTY,
    });

    const quantity = useWatch({ control, name: "quantity" });

    useEffect(() => {
        if (!open) return;
        if (item) {
            reset({
                name: item.name,
                category: item.category ?? "",
                quantity: item.quantity,
                cost_per_item: Number(item.cost_per_item),
                life_span_months: item.life_span_months,
                date_acquired: item.date_acquired,
                serial: item.serial ?? "",
                group_id: item.group_id ?? null,
                remarks: item.remarks ?? "",
                tag_ids: item.tags.map((t) => t.id),
                is_retired: item.is_retired === true || item.is_retired === 1,
            });
        } else {
            reset(EMPTY);
        }
    }, [open, item, reset]);

    const onSubmit = async (values: FormValues) => {
        const tag_ids = [...new Set(values.tag_ids ?? [])];
        if (editing && item) {
            const ok = await onUpdate(item.id, {
                name: values.name.trim(),
                category: values.category?.trim() ? values.category.trim() : null,
                quantity: values.quantity,
                cost_per_item: values.cost_per_item,
                life_span_months: values.life_span_months,
                date_acquired: values.date_acquired,
                serial: values.serial?.trim() ? values.serial.trim() : null,
                group_id: values.group_id ?? null,
                is_retired: values.is_retired,
                remarks: values.remarks?.trim() ? values.remarks.trim() : null,
                tag_ids,
            });
            if (ok) onOpenChange(false);
            return;
        }
        const ok = await onCreate({
            name: values.name.trim(),
            category: values.category?.trim() ? values.category.trim() : null,
            quantity: values.quantity,
            cost_per_item: values.cost_per_item,
            life_span_months: values.life_span_months,
            date_acquired: values.date_acquired,
            serial: values.serial?.trim() ? values.serial.trim() : null,
            group_id: values.group_id ?? null,
            remarks: values.remarks?.trim() ? values.remarks.trim() : null,
            tag_ids,
        });
        if (ok) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{editing ? "Edit asset" : "New asset"}</DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Adjust stock, cost, or lifespan. Quantity can never drop below units still assigned out."
                            : "Register a new asset into the inventory. A serial is required when registering a single unit."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="asset-name">Name</Label>
                        <Input
                            id="asset-name"
                            {...register("name")}
                            placeholder="e.g. Projector XG-200"
                            maxLength={191}
                            aria-invalid={Boolean(errors.name)}
                        />
                        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="asset-category">Category</Label>
                            <Input
                                id="asset-category"
                                {...register("category")}
                                placeholder="e.g. AV equipment"
                                maxLength={191}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asset-group">Group</Label>
                            <Controller
                                name="group_id"
                                control={control}
                                render={({ field }) => (
                                    <select
                                        id="asset-group"
                                        value={field.value ?? ""}
                                        onChange={(e) =>
                                            field.onChange(e.target.value === "" ? null : Number(e.target.value))
                                        }
                                        onBlur={field.onBlur}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                                    >
                                        <option value="">No group</option>
                                        {groups.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.group_name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="grid gap-2">
                            <Label htmlFor="asset-quantity">Quantity</Label>
                            <Input
                                id="asset-quantity"
                                type="number"
                                min={0}
                                step={1}
                                {...register("quantity", { valueAsNumber: true })}
                                className="tabular-nums"
                                aria-invalid={Boolean(errors.quantity)}
                            />
                            {errors.quantity ? (
                                <p className="text-xs text-destructive">{errors.quantity.message}</p>
                            ) : null}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asset-cost">Cost / item</Label>
                            <Input
                                id="asset-cost"
                                type="number"
                                min={0}
                                step="0.01"
                                {...register("cost_per_item", { valueAsNumber: true })}
                                className="tabular-nums"
                                aria-invalid={Boolean(errors.cost_per_item)}
                            />
                            {errors.cost_per_item ? (
                                <p className="text-xs text-destructive">{errors.cost_per_item.message}</p>
                            ) : null}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asset-lifespan">Lifespan (mo)</Label>
                            <Input
                                id="asset-lifespan"
                                type="number"
                                min={1}
                                step={1}
                                {...register("life_span_months", { valueAsNumber: true })}
                                className="tabular-nums"
                                aria-invalid={Boolean(errors.life_span_months)}
                            />
                            {errors.life_span_months ? (
                                <p className="text-xs text-destructive">{errors.life_span_months.message}</p>
                            ) : null}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asset-acquired">Acquired</Label>
                            <Input
                                id="asset-acquired"
                                type="date"
                                {...register("date_acquired")}
                                className="tabular-nums"
                                aria-invalid={Boolean(errors.date_acquired)}
                            />
                            {errors.date_acquired ? (
                                <p className="text-xs text-destructive">{errors.date_acquired.message}</p>
                            ) : null}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="asset-serial">
                            Serial {quantity === 1 ? <span className="text-destructive">*</span> : "(optional)"}
                        </Label>
                        <Input
                            id="asset-serial"
                            {...register("serial")}
                            placeholder={quantity === 1 ? "Required for a single unit" : "e.g. SN-000123"}
                            maxLength={191}
                            className="font-mono tabular-nums"
                            aria-invalid={Boolean(errors.serial)}
                        />
                        {errors.serial ? <p className="text-xs text-destructive">{errors.serial.message}</p> : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="asset-remarks">Remarks</Label>
                        <Textarea
                            id="asset-remarks"
                            {...register("remarks")}
                            placeholder="Condition, location, notes…"
                            rows={2}
                            className="resize-none"
                        />
                    </div>
                    <fieldset className="grid gap-2">
                        <legend className="text-sm font-medium">Tags</legend>
                        {tags.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No active tags to pick from.</p>
                        ) : (
                            <div className="grid max-h-36 gap-1 overflow-y-auto rounded-md border p-2">
                                <Controller
                                    name="tag_ids"
                                    control={control}
                                    render={({ field }) => (
                                        <>
                                            {tags.map((tag) => {
                                                const selected = field.value ?? [];
                                                const checked = selected.includes(tag.id);
                                                return (
                                                    <label
                                                        key={tag.id}
                                                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() =>
                                                                field.onChange(
                                                                    checked
                                                                        ? selected.filter((id: number) => id !== tag.id)
                                                                        : [...selected, tag.id],
                                                                )
                                                            }
                                                            className="size-4 shrink-0 accent-primary"
                                                            aria-label={`Tag ${tag.tag_name}`}
                                                        />
                                                        <span
                                                            aria-hidden="true"
                                                            className="size-3 shrink-0 rounded-full border"
                                                            style={{ backgroundColor: tag.color ?? "transparent" }}
                                                        />
                                                        <span className="truncate">{tag.tag_name}</span>
                                                    </label>
                                                );
                                            })}
                                        </>
                                    )}
                                />
                            </div>
                        )}
                    </fieldset>
                    {editing ? (
                        <Controller
                            name="is_retired"
                            control={control}
                            render={({ field }) => (
                                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                    <div className="grid gap-0.5">
                                        <Label htmlFor="asset-retired">Retired</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Retired assets stay in history but leave the available pool.
                                        </p>
                                    </div>
                                    <Switch
                                        id="asset-retired"
                                        checked={Boolean(field.value)}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            )}
                        />
                    ) : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {editing ? "Save changes" : "Register asset"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
