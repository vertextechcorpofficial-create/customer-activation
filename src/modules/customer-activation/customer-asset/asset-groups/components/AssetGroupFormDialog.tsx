"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    CreateAssetGroupSchema,
    type AssetGroup,
    type CreateAssetGroupInput,
} from "../types/asset-groups.schema";

function isOn(value: AssetGroup["is_active"]): boolean {
    return value === true || value === 1;
}

interface AssetGroupFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: AssetGroup | null;
    onSubmit: (input: CreateAssetGroupInput) => Promise<boolean>;
}

export function AssetGroupFormDialog({ open, onOpenChange, editing, onSubmit }: AssetGroupFormDialogProps) {
    const form = useForm<CreateAssetGroupInput>({
        resolver: zodResolver(CreateAssetGroupSchema),
        defaultValues: { group_code: "", group_name: "", description: "", is_active: true },
    });
    const { isSubmitting } = form.formState;

    useEffect(() => {
        if (open) {
            form.reset({
                group_code: editing?.group_code ?? "",
                group_name: editing?.group_name ?? "",
                description: editing?.description ?? "",
                is_active: editing ? isOn(editing.is_active) : true,
            });
        }
    }, [open, editing, form]);

    const handleSubmit = async (values: CreateAssetGroupInput) => {
        const ok = await onSubmit(values);
        if (ok) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>{editing ? "Edit asset group" : "New asset group"}</DialogTitle>
                    <DialogDescription>
                        {editing ? "Rename the asset group or change its availability." : "Add an asset group for tagging inventory."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4 px-6 py-6">
                        <FormField
                            control={form.control}
                            name="group_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="e.g. IT-EQUIP"
                                            maxLength={64}
                                            disabled={Boolean(editing) || isSubmitting}
                                            className="tabular-nums"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="group_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g. IT Equipment" maxLength={191} disabled={isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={3}
                                            placeholder="What belongs in this asset group?"
                                            className="resize-none"
                                            disabled={isSubmitting}
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                        <div className="grid gap-0.5">
                                            <Label htmlFor="group-active">Active</Label>
                                            <p className="text-xs text-muted-foreground">Inactive asset groups stay on past assets but cannot be picked.</p>
                                        </div>
                                        <Switch id="group-active" checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="-mx-6 -mb-6 justify-end border-t bg-muted/20 px-6 py-4">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                                {editing ? "Save changes" : "Create asset group"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
