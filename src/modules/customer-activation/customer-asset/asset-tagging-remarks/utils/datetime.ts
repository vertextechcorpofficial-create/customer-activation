const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
});

const dateFormat = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Human-friendly local render of a "YYYY-MM-DD HH:mm:ss" wall time.
 * Date-only values render without a time; empty/invalid values render "—".
 */
export function formatTaggingDateTime(value: string | null | undefined): string {
    if (value == null) return "—";
    const raw = value.trim();
    if (!raw) return "—";
    if (DATE_ONLY.test(raw)) {
        const [y, m, d] = raw.split("-").map(Number);
        // The Date constructor rolls overflow (2024-13-01 → Jan 2025)
        // instead of failing, so validate the range explicitly.
        if (m < 1 || m > 12 || d < 1) return "—";
        if (d > new Date(y, m, 0).getDate()) return "—";
        const parsed = new Date(y, m - 1, d);
        if (Number.isNaN(parsed.getTime())) return "—";
        return dateFormat.format(parsed);
    }
    const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return "—";
    return dateTimeFormat.format(parsed);
}
