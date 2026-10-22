"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { assetCustomersRoutes } from "../routes";
import type { ApiEnvelope } from "../types/api";
import type { Note } from "../types/asset-customers.schema";
import type { CustomerDetail } from "../services/asset-customers-service";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!res.ok || !body || body.success === false) {
        throw new Error(
            (body && body.success === false && body.message) || "Something went wrong. Please try again.",
        );
    }
    return body.data;
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function useCustomerDetail(id: number) {
    const [detail, setDetail] = useState<CustomerDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setDetail(await request<CustomerDetail>(`${assetCustomersRoutes.customers}/${id}`));
        } catch (err) {
            setError(toMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (Number.isFinite(id) && id > 0) void refresh();
    }, [refresh, id]);

    const syncNotes = useCallback(async () => {
        try {
            const params = new URLSearchParams({ customerId: String(id) });
            const notes = await request<Note[]>(`${assetCustomersRoutes.notes}?${params.toString()}`);
            setDetail((d) => (d ? { ...d, notes } : d));
        } catch {
            // The write already succeeded — keep the last good notes.
        }
    }, [id]);

    const addNote = useCallback(
        async (body: string): Promise<boolean> => {
            try {
                const note = await request<Note>(assetCustomersRoutes.notes, {
                    method: "POST",
                    body: JSON.stringify({ customer_id: id, body }),
                });
                // Optimistic: show immediately even if the refetch below fails.
                setDetail((d) => (d ? { ...d, notes: [note, ...(d.notes ?? [])] } : d));
                toast.success("Note added");
                await syncNotes();
                return true;
            } catch (err) {
                toast.error("Failed to add note", { description: toMessage(err) });
                return false;
            }
        },
        [id, syncNotes],
    );

    const editNote = useCallback(
        async (noteId: number, body: string): Promise<boolean> => {
            try {
                await request(assetCustomersRoutes.note(noteId), {
                    method: "PATCH",
                    body: JSON.stringify({ body }),
                });
                setDetail((d) =>
                    d ? { ...d, notes: d.notes.map((n) => (n.id === noteId ? { ...n, body } : n)) } : d,
                );
                toast.success("Note updated");
                await syncNotes();
                return true;
            } catch (err) {
                toast.error("Failed to update note", { description: toMessage(err) });
                return false;
            }
        },
        [syncNotes],
    );

    const removeNote = useCallback(
        async (noteId: number): Promise<boolean> => {
            try {
                await request(assetCustomersRoutes.note(noteId), { method: "DELETE" });
                setDetail((d) =>
                    d ? { ...d, notes: d.notes.filter((n) => n.id !== noteId) } : d,
                );
                toast.success("Note deleted");
                await syncNotes();
                return true;
            } catch (err) {
                toast.error("Failed to delete note", { description: toMessage(err) });
                return false;
            }
        },
        [syncNotes],
    );

    return { detail, isLoading, error, refresh: () => void refresh(), addNote, editNote, removeNote };
}
