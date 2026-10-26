"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function parseIsoDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

// Local date parts only — toISOString() shifts the day at UTC+8.
function toIsoDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function formatLabel(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DatePickerField({
    id,
    value,
    onChange,
    disabled,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const selected = parseIsoDate(value);
    const today = React.useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }, []);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    aria-label="Date acquired"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start px-3 text-left font-normal tabular-nums",
                        !selected && "text-muted-foreground",
                    )}
                >
                    <CalendarIcon className="mr-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
                    <span className="truncate">{selected ? formatLabel(selected) : "Pick a date"}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[9999] w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-0"
                align="start"
                sideOffset={4}
                collisionPadding={12}
            >
                <Calendar
                    mode="single"
                    selected={selected}
                    disabled={(date) => date > today}
                    onSelect={(date) => {
                        if (date) {
                            onChange(toIsoDate(date));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
