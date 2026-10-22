import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export interface ListShellProps<T> {
    title: string;
    description?: string;
    columns: ColumnDef<T, unknown>[];
    data: T[];
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    filters?: ReactNode;
    action?: ReactNode;
    cards?: ReactNode;
    searchKey?: string;
    onSearch?: (value: string) => void;
    emptyTitle?: string;
    emptyDescription?: string;
    pageCount?: number;
    manualPagination?: boolean;
    pagination?: { pageIndex: number; pageSize: number };
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
}
