"use client";

import { useCallback, useEffect, useState } from "react";
import { getWebsites, type ReferralWebsite } from "../providers/website-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Could not load websites. Please try again.";
}

/**
 * Active referral websites for the Website select. Loads once; the dialog
 * surfaces `error` with a retry instead of an empty select.
 */
export function useWebsites() {
    const [websites, setWebsites] = useState<ReferralWebsite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setWebsites(await getWebsites());
        } catch (err) {
            setWebsites([]);
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { websites, isLoading, error, refresh };
}
