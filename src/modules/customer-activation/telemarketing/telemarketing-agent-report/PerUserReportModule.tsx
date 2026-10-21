"use client";

import { PerUserTable } from "./components/per-user-table";
import { usePerUserReport } from "./hooks/use-per-user-report";

export function PerUserReportModule() {
    const { rows, report, period, setPeriod, isLoading, error, refresh } = usePerUserReport("mtd");
    const rangeLabel =
        report !== null ? `${report.start} – ${report.end} (Asia/Manila)` : undefined;

    return (
        <PerUserTable
            rows={rows}
            period={period}
            onPeriodChange={setPeriod}
            isLoading={isLoading}
            error={error}
            onRetry={() => void refresh()}
            rangeLabel={rangeLabel}
        />
    );
}
