"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    CreateAssetTagSchema,
    type AssetTag,
    type CreateAssetTagInput,
    type UpdateAssetTagInput,
} from "../types/asset-tags.schema";

interface AssetTagFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tag: AssetTag | null;
    onCreate: (input: CreateAssetTagInput) => Promise<boolean>;
    onUpdate: (id: number, input: UpdateAssetTagInput) => Promise<boolean>;
}

function isActive(value: AssetTag["is_active"]): boolean {
    return value === true || value === 1;
}

export function AssetTagFormDialog({ open, onOpenChange, tag, onCreate, onUpdate }: AssetTagFormDialogProps) {
    const editing = tag !== null;
    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateAssetTagInput>({
        resolver: zodResolver(CreateAssetTagSchema),
        defaultValues: { tag_code: "", tag_name: "", color: "", description: "", is_active: true },
    });

    useEffect(() => {
        if (open) {
            reset({
                tag_code: tag?.tag_code ?? "",
                tag_name: tag?.tag_name ?? "",
                color: tag?.color ?? "",
                description: tag?.description ?? "",
                is_active: tag ? isActive(tag.is_active) : true,
            });
        }
    }, [open, tag, reset]);

    const onSubmit = async (values: CreateAssetTagInput) => {
        const color = values.color?.trim() ? values.color.trim() : null;
        const description = values.description?.trim() ? values.description.trim() : null;
        const ok = editing && tag
            ? await onUpdate(tag.id, {
                tag_name: values.tag_name.trim(),
                color,
                description,
                is_active: values.is_active,
            })
            : await onCreate({
                tag_code: values.tag_code.trim(),
                tag_name: values.tag_name.trim(),
                color,
                description,
                is_active: values.is_active,
            });
        if (ok) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>{editing ? "Edit asset tag" : "New asset tag"}</DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Rename the asset tag or change its colour."
                            : "Add a colour-coded label for customer assets."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 px-6 py-6">
                    <div className="grid gap-2">
                        <Label htmlFor="tag-code">Code</Label>
                        <Input
                            id="tag-code"
                            {...register("tag_code")}
                            disabled={editing}
                            placeholder="e.g. vip-client"
                            maxLength={64}
                            className="font-mono tabular-nums"
                            aria-invalid={Boolean(errors.tag_code)}
                        />
                        {errors.tag_code ? (
                            <p className="text-xs text-destructive">{errors.tag_code.message}</p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tag-name">Name</Label>
                        <Input
                            id="tag-name"
                            {...register("tag_name")}
                            placeholder="e.g. VIP Client"
                            maxLength={191}
                            aria-invalid={Boolean(errors.tag_name)}
                        />
                        {errors.tag_name ? (
                            <p className="text-xs text-destructive">{errors.tag_name.message}</p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tag-color">Colour</Label>
                        <div className="flex items-center gap-2">
                            <Controller
                                name="color"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="size-8 shrink-0 rounded-md border"
                                            style={{ backgroundColor: field.value?.trim() || "transparent" }}
                                        />
                                        <Input
                                            id="tag-color"
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            placeholder="#3b82f6"
                                            maxLength={32}
                                            className="font-mono tabular-nums"
                                        />
                                    </>
                                )}
                            />
                        </div>
                        {errors.color ? (
                            <p className="text-xs text-destructive">{errors.color.message}</p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tag-description">Description</Label>
                        <Textarea
                            id="tag-description"
                            {...register("description")}
                            placeholder="What is this asset tag for?"
                            rows={3}
                            className="resize-none"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                        <div className="grid gap-0.5">
                            <Label htmlFor="tag-active">Active</Label>
                            <p className="text-xs text-muted-foreground">
                                Inactive asset tags stay on past assets but cannot be picked.
                            </p>
                        </div>
                        <Controller
                            name="is_active"
                            control={control}
                            render={({ field }) => (
                                <Switch
                                    id="tag-active"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                    <DialogFooter className="-mx-6 -mb-6 justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {editing ? "Save changes" : "Create asset tag"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
