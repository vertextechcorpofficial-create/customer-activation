"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ProspectCreate } from "../types/prospect.schema";
import {
    createProspect as apiCreate,
    type ProspectCreateOutcome,
} from "../providers/prospect-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

/**
 * Manual prospect entry. Returns the full outcome so the form can render a
 * duplicate match inline; toasts alone are not enough for a match.
 */
export function useProspectCreate() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const create = useCallback(async (input: ProspectCreate): Promise<ProspectCreateOutcome | null> => {
        setIsSubmitting(true);
        try {
            const outcome = await apiCreate(input);
            if (outcome.duplicate) {
                toast.error("Possible duplicate", {
                    description: outcome.matched.label
                        ? `Matches ${outcome.matched.label} (${outcome.matched.table})`
                        : "This contact already exists",
                });
                return outcome;
            }
            toast.success(`Prospect ${outcome.prospect.prospect_code} saved`);
            return outcome;
        } catch (err) {
            toast.error("Failed to save prospect", { description: toMessage(err) });
            return null;
        } finally {
            setIsSubmitting(false);
        }
    }, []);

    return { create, isSubmitting };
}
