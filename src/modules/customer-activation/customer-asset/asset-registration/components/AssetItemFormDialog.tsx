"use client";

import * as React from "react";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { z } from "zod";
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
import { DatePickerField } from "./DatePickerField";
import { TagsMultiSelect } from "./TagsMultiSelect";

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

// Local date parts only — toISOString() is UTC and renders yesterday during 00:00–08:00 PH.
function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY: FormValues = {
    name: "",
    category: "",
    quantity: 1,
    cost_per_item: 0,
    life_span_months: 12,
    date_acquired: todayLocal(),
    serial: "",
    group_id: null,
    remarks: "",
    tag_ids: [],
};

// Module-local group picker. The shared SearchableSelect exposes no id, so a
// `<Label htmlFor>` can never associate with it — the trigger carries its
// accessible name itself. The popover is portaled so it escapes the dialog's
// overflow; the DialogContent dismissal guard below keeps the dialog open
// while the popover is interacted with.
function GroupCombobox({
    groups,
    value,
    onChange,
}: {
    groups: AssetGroup[];
    value: number | null;
    onChange: (value: number | null) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const selected = groups.find((g) => g.id === value) ?? null;
    const matches = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter(
            (g) =>
                g.group_name.toLowerCase().includes(q) ||
                g.group_code.toLowerCase().includes(q),
        );
    }, [groups, search]);
    const label = selected ? `${selected.group_code} · ${selected.group_name}` : "No group";

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch("");
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Group"
                    className={cn(
                        "w-full min-w-0 justify-between gap-2 font-normal",
                        value == null && "text-muted-foreground",
                    )}
                >
                    <span className="truncate">{label}</span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[9999] w-[min(360px,calc(100vw-2rem))] p-0"
                align="start"
                sideOffset={4}
                collisionPadding={12}
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search groups..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>No groups found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none"
                                onSelect={() => {
                                    onChange(null);
                                    setSearch("");
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    aria-hidden="true"
                                    className={cn(
                                        "size-4 shrink-0",
                                        value == null ? "opacity-100" : "opacity-0",
                                    )}
                                />
                                <span className="truncate">No group</span>
                            </CommandItem>
                            {matches.map((g) => {
                                const checked = value === g.id;
                                return (
                                    <CommandItem
                                        key={g.id}
                                        value={`${g.group_code} ${g.group_name}`}
                                        onSelect={() => {
                                            onChange(g.id);
                                            setSearch("");
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            aria-hidden="true"
                                            className={cn(
                                                "size-4 shrink-0",
                                                checked ? "opacity-100" : "opacity-0",
                                            )}
                                        />
                                        <span className="truncate">
                                            {g.group_code} · {g.group_name}
                                        </span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

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
            <DialogContent
                className="flex max-h-[90dvh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[560px]"
                onPointerDownOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.closest('[data-slot="popover-content"]')) e.preventDefault();
                }}
                onFocusOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.closest('[data-slot="popover-content"]')) e.preventDefault();
                }}
            >
                <DialogHeader className="shrink-0 px-6 pt-6">
                    <DialogTitle>{editing ? "Edit asset" : "New asset"}</DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Adjust stock, cost, or lifespan. Quantity can never drop below units still assigned out."
                            : "Register a new asset into the inventory. A serial is required when registering a single unit."}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-6">
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
                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="asset-category">Category</Label>
                            <Input
                                id="asset-category"
                                {...register("category")}
                                placeholder="e.g. AV equipment"
                                maxLength={191}
                            />
                        </div>
                        <div className="grid min-w-0 gap-2">
                            <Label>Group</Label>
                            <Controller
                                name="group_id"
                                control={control}
                                render={({ field }) => (
                                    <GroupCombobox
                                        groups={groups}
                                        value={field.value ?? null}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="grid min-w-0 gap-2">
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
                        <div className="grid min-w-0 gap-2">
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
                        <div className="grid min-w-0 gap-2">
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
                        <div className="grid min-w-0 gap-2">
                            <Label htmlFor="asset-acquired">Acquired</Label>
                            <Controller
                                name="date_acquired"
                                control={control}
                                render={({ field }) => (
                                    <DatePickerField
                                        id="asset-acquired"
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
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
                            <Controller
                                name="tag_ids"
                                control={control}
                                render={({ field }) => (
                                    <TagsMultiSelect
                                        tags={tags}
                                        value={field.value ?? []}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
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
                    </div>
                    <DialogFooter className="shrink-0 justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {editing ? "Save changes" : "Register asset"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
