"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { LeadRecord, LeadTagView } from "../types/pipeline.schema";
import { fetchLeadRecord } from "../providers/lead-query-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** One lead with its tags for the detail view. */
export function useLeadRecord(leadId: number | null) {
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [tags, setTags] = useState<LeadTagView[]>([]);
  const [isLoading, setIsLoading] = useState(leadId !== null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (leadId === null) {
      setLead(null);
      setTags([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const view = await fetchLeadRecord(leadId);
      setLead(view.lead);
      setTags(view.tags);
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load the lead", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { lead, tags, isLoading, error, refresh };
}
