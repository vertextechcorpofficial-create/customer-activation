const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
] as const;

interface WallDate {
    year: number;
    month: number;
    day: number;
}

/**
 * Parse a Philippine wall-clock `YYYY-MM-DD HH:mm:ss` string by splitting it
 * into components. Never `new Date(string)`, so no timezone shift can move a
 * day. Returns null for empty or malformed input.
 */
export function parseWallDate(value: string | null | undefined): WallDate | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}(?::\d{2})?/.exec(value.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
}

function dayLabel(date: WallDate, currentYear: number): string {
    const base = `${MONTHS[date.month - 1]} ${date.day}`;
    return date.year === currentYear ? base : `${base}, ${date.year}`;
}

function dayWithYear(date: WallDate): string {
    return `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

/** Raw stored value trimmed to minute precision for display in `title`. */
function toMinute(value: string): string {
    return value.trim().replace("T", " ").slice(0, 16);
}

/**
 * Human form of a campaign window: `Nov 12 – Nov 30`, `Nov 12, 2026 – Jan 3,
 * 2027`, `Nov 12`, `From Nov 12`, `Until Nov 30`, or `Permanent`. The year is
 * shown whenever the range's year is not the current year.
 */
export function formatCampaignDuration(
    startsAt: string | null | undefined,
    endsAt: string | null | undefined,
    now: Date = new Date(),
): string {
    const hasStart = Boolean(startsAt?.trim());
    const hasEnd = Boolean(endsAt?.trim());
    const start = parseWallDate(startsAt);
    const end = parseWallDate(endsAt);
    if (start && end) {
        if (start.year === end.year && start.month === end.month && start.day === end.day)
            return dayLabel(start, now.getFullYear());
        if (start.year === end.year) {
            const left = `${MONTHS[start.month - 1]} ${start.day}`;
            const right = `${MONTHS[end.month - 1]} ${end.day}`;
            return start.year === now.getFullYear()
                ? `${left} – ${right}`
                : `${left} – ${right}, ${start.year}`;
        }
        return `${dayWithYear(start)} – ${dayWithYear(end)}`;
    }
    if (start) return `From ${dayLabel(start, now.getFullYear())}`;
    if (end) return `Until ${dayLabel(end, now.getFullYear())}`;
    if (hasStart) return toMinute(startsAt as string);
    if (hasEnd) return toMinute(endsAt as string);
    return "Permanent";
}

/** Exact stored values for the cell `title` attribute, so precision is kept. */
export function durationTitle(
    startsAt: string | null | undefined,
    endsAt: string | null | undefined,
): string {
    const start = startsAt?.trim() ? toMinute(startsAt as string) : null;
    const end = endsAt?.trim() ? toMinute(endsAt as string) : null;
    if (start && end) return `${start} → ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    return "Permanent";
}
