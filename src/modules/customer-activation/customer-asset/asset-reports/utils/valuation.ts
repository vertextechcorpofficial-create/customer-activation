// Depreciation math for Customer Asset: projected value = cost - (cost / lifespan)
// depleting from acquisition, floored at zero.
// Always computed, never stored.
export type DepreciationUnit = "day" | "month";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DAYS_PER_MONTH = 30;

// UTC midnight so day math is timezone-stable.
function parseIsoDate(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export function daysElapsed(dateAcquired: string, now: Date = new Date()): number {
    const start = parseIsoDate(dateAcquired).getTime();
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.floor((end - start) / MS_PER_DAY);
    return days > 0 ? days : 0;
}

export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface UnitValueInput {
    costPerItem: number;
    lifeSpanMonths: number;
    dateAcquired: string;
    now?: Date;
    unit?: DepreciationUnit;
}

export function unitValue({
    costPerItem,
    lifeSpanMonths,
    dateAcquired,
    now = new Date(),
    unit = "month",
}: UnitValueInput): number {
    if (costPerItem <= 0 || lifeSpanMonths <= 0) return 0;

    const days = daysElapsed(dateAcquired, now);
    const lossPerDay = costPerItem / (lifeSpanMonths * DAYS_PER_MONTH);
    const lossPerMonth = costPerItem / lifeSpanMonths;

    const lost = unit === "day" ? lossPerDay * days : lossPerMonth * (days / DAYS_PER_MONTH);
    const remaining = costPerItem - lost;

    return round2(remaining > 0 ? remaining : 0);
}

export function isFullyDepreciated(input: UnitValueInput): boolean {
    return unitValue(input) === 0;
}

export function lotValue(input: UnitValueInput & { quantity: number }): number {
    if (input.quantity <= 0) return 0;
    return round2(unitValue(input) * input.quantity);
}

export interface AssignmentLike {
    quantity: number;
    returned_quantity: number;
}

export function quantityOut(assignments: readonly AssignmentLike[]): number {
    return assignments.reduce(
        (total, row) => total + Math.max(0, row.quantity - row.returned_quantity),
        0,
    );
}

export function quantityAvailable(
    quantity: number,
    assignments: readonly AssignmentLike[],
): number {
    const available = quantity - quantityOut(assignments);
    return available > 0 ? available : 0;
}
