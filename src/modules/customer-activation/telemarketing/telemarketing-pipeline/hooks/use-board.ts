"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getStages } from "../providers/stage-provider";
import { listBoardLeads, type BoardLead } from "../services/board-service";
import type { Stage } from "../types/pipeline.schema";

export interface BoardColumnView {
  stage: Stage;
  leads: BoardLead[];
  total: number;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Pipeline board: every active stage (terminal included) with its lead window. */
export function useBoard(perStageLimit = 50) {
  const [columns, setColumns] = useState<BoardColumnView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [stages, board] = await Promise.all([getStages(), listBoardLeads({ perStageLimit })]);
      const byStage = new Map(board.map((column) => [column.stage_id, column]));
      setColumns(
        stages
          .filter((stage) => Number(stage.is_active) === 1)
          .sort((a, b) => a.stage_order - b.stage_order)
          .map((stage) => ({
            stage,
            leads: byStage.get(stage.stage_id)?.leads ?? [],
            total: byStage.get(stage.stage_id)?.total ?? 0,
          })),
      );
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      toast.error("Failed to load the board", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [perStageLimit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { columns, isLoading, error, refresh };
}
