"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Campaign, CampaignCreate, CampaignUpdate } from "../types/campaign.schema";
import {
    createCampaign as apiCreateCampaign,
    getCampaignsPage,
    setCampaignActive as apiSetCampaignActive,
    updateCampaign as apiUpdateCampaign,
} from "../providers/campaign-provider";

export interface CampaignPagination {
    pageIndex: number;
    pageSize: number;
}

export type CampaignStatusFilter = "all" | "active" | "inactive";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

/**
 * Current page rows only for a manual-mode table. `campaigns` never holds the
 * whole collection — every pagination, search, or filter change refetches the
 * page from `/api/customer-activation/referrals/referral-campaigns`.
 */
export function useCampaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [total, setTotal] = useState(0);
    const [pagination, setPagination] = useState<CampaignPagination>({ pageIndex: 0, pageSize: 10 });
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<CampaignStatusFilter>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

    const load = useCallback(
        async (signal: { cancelled: boolean }) => {
            const id = ++requestId.current;
            setIsLoading(true);
            setError(null);
            try {
                const page = await getCampaignsPage({
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    search,
                    status,
                });
                if (signal.cancelled || requestId.current !== id) return;
                setCampaigns(page.rows);
                setTotal(page.total);
            } catch (err) {
                if (signal.cancelled || requestId.current !== id) return;
                setCampaigns([]);
                setTotal(0);
                setError(toMessage(err));
            } finally {
                if (!signal.cancelled && requestId.current === id) setIsLoading(false);
            }
        },
        [pagination, search, status],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        void load(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [load]);

    /** Refetch the current page (Refresh action, retry, post-write sync). */
    const refresh = useCallback(async () => {
        await load({ cancelled: false });
    }, [load]);

    /** Background reload after a write: keeps the last good page if it fails. */
    const sync = useCallback(async () => {
        try {
            const page = await getCampaignsPage({
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize,
                search,
                status,
            });
            setCampaigns(page.rows);
            setTotal(page.total);
            setError(null);
        } catch {
            // the write already succeeded — keep the page we have
        }
    }, [pagination, search, status]);

    /** Table-driven paging: setting state refetches the new page via `load`. */
    const onPaginationChange = useCallback((next: CampaignPagination) => {
        setPagination(next);
    }, []);

    const updateSearch = useCallback((value: string) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const updateStatus = useCallback((value: CampaignStatusFilter) => {
        setStatus(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const createCampaign = useCallback(
        async (input: CampaignCreate): Promise<boolean> => {
            try {
                await apiCreateCampaign(input);
                toast.success("Campaign created");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to create campaign", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateCampaign = useCallback(
        async (campaignId: number, input: CampaignUpdate): Promise<boolean> => {
            try {
                await apiUpdateCampaign(campaignId, input);
                toast.success("Campaign updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update campaign", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const setCampaignActive = useCallback(
        async (campaignId: number, isActive: boolean): Promise<boolean> => {
            try {
                await apiSetCampaignActive(campaignId, isActive);
                toast.success(isActive ? "Campaign activated" : "Campaign deactivated");
                await sync();
                return true;
            } catch (err) {
                toast.error(isActive ? "Failed to activate campaign" : "Failed to deactivate campaign", {
                    description: toMessage(err),
                });
                return false;
            }
        },
        [sync],
    );

    return {
        campaigns,
        total,
        pagination,
        onPaginationChange,
        pageCount,
        search,
        setSearch: updateSearch,
        status,
        setStatus: updateStatus,
        isLoading,
        error,
        refresh,
        createCampaign,
        updateCampaign,
        setCampaignActive,
    };
}
