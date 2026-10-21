"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Activity, ActivityCreate } from "../types/pipeline.schema";
import { createActivity, fetchActivities } from "../providers/activity-provider";

/** An activity without its lead — the hook supplies the lead. */
export type ActivityDraft = Omit<ActivityCreate, "lead_id">;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Activity timeline for one lead, plus the log-activity mutation. */
export function useActivities(leadId: number | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!leadId) {
      setActivities([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setActivities(await fetchActivities(leadId));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const log = useCallback(
    async (draft: ActivityDraft): Promise<boolean> => {
      if (!leadId) return false;
      setIsCreating(true);
      try {
        await createActivity({ ...draft, lead_id: leadId });
        toast.success("Activity logged");
        await refresh();
        return true;
      } catch (err) {
        toast.error("Failed to log activity", { description: toMessage(err) });
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [leadId, refresh],
  );

  return { activities, isLoading, isCreating, error, refresh, log };
}
