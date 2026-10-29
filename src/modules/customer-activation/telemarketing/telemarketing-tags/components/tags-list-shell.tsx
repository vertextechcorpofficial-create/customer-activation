"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState, type ReactNode } from "react";

import { DataTable as NewDataTable } from "@/components/ui/new-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCwIcon, Search } from "lucide-react";
import styles from "./tags-list-shell.module.css";

export interface TagsListShellProps<T> {
    columns: ColumnDef<T, unknown>[];
    data: T[];
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    searchValue?: string;
    onSearch?: (value: string) => void;
    filters?: ReactNode;
    cards?: ReactNode;
    emptyTitle?: string;
    emptyDescription?: string;
    pageCount?: number;
    pagination?: { pageIndex: number; pageSize: number };
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
    manualPagination?: boolean;
}

function ShellSearchInput({
    value,
    onSearch,
}: {
    value: string;
    onSearch: (value: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        if (draft === value) return;
        const timer = setTimeout(() => onSearch(draft), 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft]);

    return (
        <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search tags..."
                aria-label="Search tags"
                className="w-full min-w-0 rounded-lg pl-8"
            />
        </div>
    );
}

export function TagsListShell<T>({
    columns,
    data,
    isLoading,
    error,
    onRefresh,
    searchValue,
    onSearch,
    filters,
    cards,
    emptyTitle,
    emptyDescription,
    pageCount,
    pagination,
    onPaginationChange,
    manualPagination,
}: TagsListShellProps<T>) {
    return (
        <Card className="gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2 bg-muted/10 px-6 py-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                    {filters}
                    {onSearch ? <ShellSearchInput value={searchValue ?? ""} onSearch={onSearch} /> : null}
                    {onRefresh ? (
                        <Button variant="outline" size="sm" onClick={onRefresh} className="shrink-0">
                            <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
                            <span className="whitespace-nowrap">Refresh</span>
                        </Button>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {error ? (
                    <div className="px-6 pt-6">
                        <Alert variant="destructive">
                            <AlertTitle>Could not load tags</AlertTitle>
                            <AlertDescription>
                                <p>{error}</p>
                                {onRefresh ? (
                                    <Button variant="outline" size="sm" onClick={onRefresh}>
                                        <RefreshCwIcon className="size-4" aria-hidden />
                                        Retry
                                    </Button>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : null}
                <div className="hidden px-6 pb-6 md:block">
                    <div className={styles.hideColumnMenu}>
                        <NewDataTable
                            columns={columns}
                            data={data}
                            isLoading={isLoading}
                            emptyTitle={emptyTitle}
                            emptyDescription={emptyDescription}
                            pageCount={pageCount}
                            manualPagination={manualPagination}
                            {...(pagination ? { pagination } : {})}
                            {...(onPaginationChange ? { onPaginationChange } : {})}
                        />
                    </div>
                </div>
                {cards ? <div className="md:hidden">{cards}</div> : null}
            </CardContent>
        </Card>
    );
}
