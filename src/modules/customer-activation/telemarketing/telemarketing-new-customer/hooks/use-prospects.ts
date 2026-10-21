"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProspectStatus } from "../types/prospect.schema";
import {
    fetchProspects,
    type ProspectListData,
    type ProspectListParams,
} from "../providers/prospect-provider";

export interface ProspectQuery extends ProspectListParams {
    search?: string;
    status?: ProspectStatus;
    page?: number;
    limit?: number;
    /** Bumped by the parent after a create so the table reloads. */
    refreshKey?: number;
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useProspects(query: ProspectQuery = {}) {
    const { refreshKey: _refreshKey, ...params } = query;
    void _refreshKey;
    const [data, setData] = useState<ProspectListData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const key = JSON.stringify({ ...params, refreshKey: query.refreshKey ?? 0 });

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            const { refreshKey: _ignored, ...fetchParams } = JSON.parse(key) as ProspectQuery;
            void _ignored;
            setData(await fetchProspects(fetchParams));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [key]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        items: data?.items ?? [],
        meta: data?.meta ?? { total: 0, page: 1, limit: 20 },
        isLoading,
        error,
        refresh,
    };
}
