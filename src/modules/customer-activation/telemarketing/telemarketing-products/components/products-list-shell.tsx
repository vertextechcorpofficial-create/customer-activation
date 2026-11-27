"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTable as NewDataTable } from "@/components/ui/new-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RefreshCwIcon } from "lucide-react";
import styles from "./products-list-shell.module.css";

export interface ProductsListShellProps<T> {
    columns: ColumnDef<T, unknown>[];
    data: T[];
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    filters?: ReactNode;
    cards?: ReactNode;
    emptyTitle?: string;
    emptyDescription?: string;
    pageCount?: number;
    pagination?: { pageIndex: number; pageSize: number };
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
    manualPagination?: boolean;
}

export function ProductsListShell<T>({
    columns,
    data,
    isLoading,
    error,
    onRefresh,
    filters,
    cards,
    emptyTitle,
    emptyDescription,
    pageCount,
    pagination,
    onPaginationChange,
    manualPagination,
}: ProductsListShellProps<T>) {
    return (
        <Card className="gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-center justify-end gap-2 bg-muted/10 px-6 py-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                    {filters}
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
                            <AlertTitle>Could not load products</AlertTitle>
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
