"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import type { ReturnTaggingInput } from "../types/asset-tagging-remarks.schema";
import type { AssignmentView } from "../types/asset-tagging-remarks.view";

const ReturnFormSchema = z.object({
    returned_quantity: z.number().int().min(1, "Return at least 1 unit."),
    condition_in: z.string().max(64).nullable().optional(),
    return_remarks: z.string().max(4000).nullable().optional(),
});

type ReturnFormValues = z.infer<typeof ReturnFormSchema>;

interface ReturnAssetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assignment: AssignmentView | null;
    onReturn: (id: number, input: ReturnTaggingInput) => Promise<boolean>;
}

export function ReturnAssetDialog({ open, onOpenChange, assignment, onReturn }: ReturnAssetDialogProps) {
    const remaining = assignment ? Math.max(0, assignment.quantity - assignment.returned_quantity) : 0;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ReturnFormValues>({
        resolver: zodResolver(ReturnFormSchema),
        defaultValues: { returned_quantity: 1, condition_in: "", return_remarks: "" },
    });

    useEffect(() => {
        if (open) {
            reset({ returned_quantity: remaining > 0 ? remaining : 1, condition_in: "", return_remarks: "" });
        }
    }, [open, remaining, reset]);

    const onSubmit = async (values: ReturnFormValues) => {
        if (!assignment) return;
        const ok = await onReturn(assignment.id, {
            tagging_id: assignment.id,
            returned_quantity: values.returned_quantity,
            condition_in: values.condition_in?.trim() ? values.condition_in.trim() : null,
            return_remarks: values.return_remarks?.trim() ? values.return_remarks.trim() : null,
        });
        if (ok) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Record return</DialogTitle>
                    <DialogDescription>
                        {assignment
                            ? `${assignment.item_name} × ${assignment.quantity} to ${assignment.customer_name} — ${remaining} unit(s) still out.`
                            : "Record returned units."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="return-quantity">Returned quantity</Label>
                        <Input
                            id="return-quantity"
                            type="number"
                            min={1}
                            max={Math.max(remaining, 1)}
                            {...register("returned_quantity", { valueAsNumber: true })}
                            className="tabular-nums"
                            aria-invalid={Boolean(errors.returned_quantity)}
                        />
                        {errors.returned_quantity ? (
                            <p className="text-xs text-destructive">{errors.returned_quantity.message}</p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="return-condition">Condition in</Label>
                        <Input
                            id="return-condition"
                            {...register("condition_in")}
                            placeholder="e.g. Good, scratched"
                            maxLength={64}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="return-remarks">Return remarks</Label>
                        <Textarea
                            id="return-remarks"
                            {...register("return_remarks")}
                            placeholder="Condition notes, missing parts, damage…"
                            rows={3}
                            className="resize-none"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !assignment}>
                            Record return
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
