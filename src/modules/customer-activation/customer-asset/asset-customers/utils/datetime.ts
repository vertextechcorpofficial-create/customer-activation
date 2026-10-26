const humanFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
});

export function formatHuman(value: string | null | undefined): string {
    if (!value) return "—";
    const parsed = new Date(value.replace(" ", "T")).getTime();
    if (!Number.isFinite(parsed)) return "—";
    return humanFormatter.format(new Date(parsed));
}
