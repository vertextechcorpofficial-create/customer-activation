"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PeriodSelectOption {
  value: string;
  label: string;
}

/** "Last 7 days" / "Last 30 days" / … — one wording across every telemarketing surface. */
export function rollingPeriodOptions(periods: readonly number[]): PeriodSelectOption[] {
  return periods.map((days) => ({ value: String(days), label: `Last ${days} days` }));
}

/**
 * The telemarketing period control: the select the agent report has always
 * used, so every report surface shares one shape, one visible wording and one
 * accessible name. Options stay per-surface because each endpoint accepts its
 * own set of windows.
 */
export function PeriodSelect({
  value,
  options,
  onChange,
  label = "Report period",
}: {
  value: string;
  options: readonly PeriodSelectOption[];
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44" aria-label={label}>
        <SelectValue placeholder="Period" />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
