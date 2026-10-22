"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Tag, TagCreate, TagUpdate } from "../types/tag.schema";
import {
    createTag as apiCreateTag,
    deactivateTag as apiDeactivateTag,
    getTagsPage,
    updateTag as apiUpdateTag,
} from "../providers/tag-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useTags(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const [tags, setTags] = useState<Tag[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good page if it fails. */
    const sync = useCallback(async () => {
        try {
            const result = await getTagsPage({ page, limit, search });
            setTags(result.items);
            setTotal(result.total);
            setError(null);
        } catch {
            // the write already succeeded — keep the page we have
        }
    }, [page, limit, search]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getTagsPage({ page, limit, search });
            setTags(result.items);
            setTotal(result.total);
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, search]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createTag = useCallback(
        async (input: TagCreate): Promise<boolean> => {
            try {
                await apiCreateTag(input);
                toast.success("Tag created");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to create tag", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const updateTag = useCallback(
        async (tagId: number, input: TagUpdate): Promise<boolean> => {
            try {
                await apiUpdateTag(tagId, input);
                toast.success("Tag updated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to update tag", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    const deactivateTag = useCallback(
        async (tagId: number): Promise<boolean> => {
            try {
                await apiDeactivateTag(tagId);
                toast.success("Tag deactivated");
                await sync();
                return true;
            } catch (err) {
                toast.error("Failed to deactivate tag", { description: toMessage(err) });
                return false;
            }
        },
        [sync],
    );

    return { tags, total, isLoading, error, refresh, createTag, updateTag, deactivateTag };
}
