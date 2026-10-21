"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Tag, TagCreate, TagUpdate } from "../types/tag.schema";
import {
    createTag as apiCreateTag,
    deactivateTag as apiDeactivateTag,
    getTags,
    updateTag as apiUpdateTag,
} from "../providers/tag-provider";

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useTags() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Background reload after a write: keeps the last good list if it fails. */
    const sync = useCallback(async () => {
        try {
            setTags(await getTags());
            setError(null);
        } catch {
            // the write already succeeded — keep the list we have
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setTags(await getTags());
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    return { tags, isLoading, error, refresh, createTag, updateTag, deactivateTag };
}
