"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserOption } from "../types/agent.schema";
import { searchUsers, USER_PAGE_SIZE } from "../providers/agent-provider";

interface UserPage {
    query: string;
    options: UserOption[];
    hasMore: boolean;
}

/**
 * Debounced, paged read-only user search for the registration combobox.
 * `loadMore` appends the next page; a short page means the collection is
 * exhausted, so paging stops there. A request that resolves after the search
 * text moved on is discarded, which resets paging with it.
 */
export function useUserOptions(search: string, enabled = true) {
    const [page, setPage] = useState<UserPage>({ query: "", options: [], hasMore: false });
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const queryRef = useRef(search);
    const inFlightRef = useRef(0);
    const loadingMoreRef = useRef(false);

    useEffect(() => {
        queryRef.current = search;
        if (!enabled) return;
        const timer = setTimeout(() => {
            inFlightRef.current += 1;
            setIsSearching(true);
            searchUsers({ search })
                .then((options) => {
                    if (queryRef.current !== search) return;
                    setPage({ query: search, options, hasMore: options.length === USER_PAGE_SIZE });
                })
                .catch(() => {
                    if (queryRef.current === search) setPage({ query: search, options: [], hasMore: false });
                })
                .finally(() => {
                    inFlightRef.current -= 1;
                    if (inFlightRef.current === 0) setIsSearching(false);
                });
        }, 300);
        return () => clearTimeout(timer);
    }, [search, enabled]);

    const loadMore = useCallback(() => {
        if (loadingMoreRef.current || !page.hasMore || page.query !== search) return;
        const offset = page.options.length;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        searchUsers({ search, offset })
            .then((next) => {
                if (queryRef.current !== search) return;
                setPage((prev) => {
                    if (prev.query !== search) return prev;
                    const seen = new Set(prev.options.map((user) => user.user_id));
                    return {
                        query: search,
                        options: [...prev.options, ...next.filter((user) => !seen.has(user.user_id))],
                        hasMore: next.length === USER_PAGE_SIZE,
                    };
                });
            })
            .catch(() => {
                if (queryRef.current === search) {
                    setPage((prev) => ({ ...prev, hasMore: false }));
                }
            })
            .finally(() => {
                loadingMoreRef.current = false;
                setIsLoadingMore(false);
            });
    }, [page.hasMore, page.options.length, page.query, search]);

    return {
        options: page.query === search || !search ? page.options : [],
        isSearching,
        isLoadingMore,
        loadMore,
    };
}
