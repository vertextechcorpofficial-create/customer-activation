"use client";

import { useEffect, useState } from "react";
import type { UserOption } from "../types/agent.schema";
import { searchUsers } from "../providers/agent-provider";

/** Debounced read-only user search for the registration combobox. */
export function useUserOptions(search: string, enabled = true) {
    const [options, setOptions] = useState<UserOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        const timer = setTimeout(() => {
            setIsSearching(true);
            searchUsers(search)
                .then(setOptions)
                .catch(() => setOptions([]))
                .finally(() => setIsSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [search, enabled]);

    return { options, isSearching };
}
