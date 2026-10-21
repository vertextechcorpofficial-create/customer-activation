"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Stage, StageCreate, StageUpdate } from "../types/pipeline.schema";
import {
  createStage as apiCreateStage,
  deactivateStage as apiDeactivateStage,
  getStages,
  reorderStages as apiReorderStages,
  updateStage as apiUpdateStage,
} from "../providers/stage-provider";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function useStages() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Background reload after a write: keeps the last good list if it fails. */
  const sync = useCallback(async () => {
    try {
      setStages(await getStages());
      setError(null);
    } catch {
      // the write already succeeded — keep the list we have
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStages(await getStages());
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createStage = useCallback(
    async (input: StageCreate): Promise<boolean> => {
      try {
        await apiCreateStage(input);
        toast.success("Stage created");
        await sync();
        return true;
      } catch (err) {
        toast.error("Failed to create stage", { description: toMessage(err) });
        return false;
      }
    },
    [sync],
  );

  const updateStage = useCallback(
    async (stageId: number, input: StageUpdate): Promise<boolean> => {
      try {
        await apiUpdateStage(stageId, input);
        toast.success("Stage updated");
        await sync();
        return true;
      } catch (err) {
        toast.error("Failed to update stage", { description: toMessage(err) });
        return false;
      }
    },
    [sync],
  );

  const reorderStages = useCallback(
    async (stageIds: number[]): Promise<boolean> => {
      try {
        await apiReorderStages(stageIds);
        toast.success("Order saved");
        await sync();
        return true;
      } catch (err) {
        toast.error("Failed to save order", { description: toMessage(err) });
        await sync();
        return false;
      }
    },
    [sync],
  );

  const deactivateStage = useCallback(
    async (stageId: number): Promise<boolean> => {
      try {
        await apiDeactivateStage(stageId);
        toast.success("Stage deactivated");
        await sync();
        return true;
      } catch (err) {
        toast.error("Failed to deactivate stage", { description: toMessage(err) });
        return false;
      }
    },
    [sync],
  );

  return { stages, isLoading, error, refresh, createStage, updateStage, reorderStages, deactivateStage };
}
