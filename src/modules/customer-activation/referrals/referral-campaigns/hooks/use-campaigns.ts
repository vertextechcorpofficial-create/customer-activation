"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Campaign, CampaignCreate, CampaignUpdate } from "../types/campaign.schema";
import {
    createCampaign as apiCreateCampaign,
    getCampaigns,
    setCampaignActive as apiSetCampaignActive,
    updateCampaign as apiUpdateCampaign,
} from "../providers/campaign-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useCampaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good list if it fails. */
    const sync = useCallback(async () => {
        try {
            setCampaigns(await getCampaigns());
            setError(null);
        } catch {
            // the write already succeeded — keep the list we have
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setCampaigns(await getCampaigns());
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

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

    return { campaigns, isLoading, error, refresh, createCampaign, updateCampaign, setCampaignActive };
}
