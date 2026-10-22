"use client";

import { DataTable as NewDataTable } from "@/components/ui/new-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCwIcon } from "lucide-react";
import type { ListShellProps } from "../types/list-shell";
import styles from "./list-shell.module.css";

export function AssetGroupsListShell<T>({
    title,
    description,
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
}: ListShellProps<T>) {
    return (
        <Card className="overflow-hidden rounded-2xl border-border/50">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
                <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate">{title}</CardTitle>
                    {description ? (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    ) : null}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {action}
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
                    {...(searchKey && onSearch ? { searchKey, onSearch } : {})}
                />
                </div>
                </div>
                {cards ? <div className="md:hidden">{cards}</div> : null}
            </CardContent>
        </Card>
    );
}
