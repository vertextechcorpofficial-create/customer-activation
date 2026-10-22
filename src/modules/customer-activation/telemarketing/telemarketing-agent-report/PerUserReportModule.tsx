"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { PerUserTable } from "./components/per-user-table";
import { usePerUserReport } from "./hooks/use-per-user-report";
import { PERIOD_OPTIONS, type ReportPeriod } from "./types/report.schema";

export function PerUserReportModule() {
    const { rows, period, setPeriod, isLoading, error, refresh } = usePerUserReport("mtd");

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight">Agent Report</h1>
                <Select
                    value={period}
                    onValueChange={(value) => setPeriod(value as ReportPeriod)}
                >
                    <SelectTrigger className="h-9 w-44" aria-label="Report period">
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {PERIOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <PerUserTable
                rows={rows}
                isLoading={isLoading}
                error={error}
                onRetry={() => void refresh()}
            />
        </div>
    );
}
