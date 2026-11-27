"use client";

import { DataTable as NewDataTable } from "@/components/ui/new-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RefreshCwIcon } from "lucide-react";
import type { ListShellProps } from "../types/list-shell";
import styles from "./list-shell.module.css";

export function AssetCustomersListShell<T>({
    columns,
    data,
    isLoading,
    error,
    onRefresh,
    filters,
    action,
    cards,
    searchKey,
    onSearch,
    emptyTitle,
    emptyDescription,
    pageCount,
    manualPagination,
    pagination,
    onPaginationChange,
}: ListShellProps<T>) {
    return (
        <Card className="gap-0 overflow-hidden rounded-2xl border-border/50 py-0">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 px-6 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {action}
                    {filters}
                </div>
                {onRefresh ? (
                    <Button variant="outline" size="sm" onClick={onRefresh} className="shrink-0">
                        <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
                        <span className="whitespace-nowrap">Refresh</span>
                    </Button>
                ) : null}
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                {error ? (
                    <div className="pt-2 pb-4">
                        <Alert variant="destructive">
                            <AlertTitle>Could not load</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </div>
                ) : null}
                <div className="hidden md:block">
                <div className={styles.hideColumnMenu}>
                <NewDataTable
                    columns={columns}
                    data={data}
                    isLoading={isLoading}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                    pageCount={pageCount}
                    manualPagination={manualPagination}
                    pagination={pagination}
                    onPaginationChange={onPaginationChange}
                    {...(searchKey && onSearch ? { searchKey, onSearch } : {})}
                />
                </div>
                </div>
                {cards ? <div className="md:hidden">{cards}</div> : null}
            </CardContent>
        </Card>
    );
}
