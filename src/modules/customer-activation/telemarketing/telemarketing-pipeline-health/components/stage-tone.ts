// Duplicated by project rule: cross-module imports are forbidden, so the stage
// colour identity from telemarketing-pipeline/lib/stage-tone.ts is owned here.
//
// Token-only palette (no hex): New → muted, Contacted → info,
// Qualification → primary, Quotation → warning, Contract → success.
// Negotiation has no token — it is derived with color-mix (≈violet).
// Returns a CSS colour *value* (var()/color-mix) for inline styles, keyed by
// stage_code with a fallback cycle by stage_order.

export const NEGOTIATION_STAGE_COLOR =
  "color-mix(in oklab, var(--color-primary), var(--color-info))";

/** Fallback cycle by 1-based stage_order: New, Contacted, Qualification, Quotation, Negotiation, Contract. */
const FALLBACK_BY_ORDER: readonly string[] = [
  "var(--color-muted-foreground)",
  "var(--color-info)",
  "var(--color-primary)",
  "var(--color-warning)",
  NEGOTIATION_STAGE_COLOR,
  "var(--color-success)",
];

export function stageColor(stage: { stage_code: string; stage_order: number }): string {
  const code = stage.stage_code.toLowerCase();
  if (code.includes("negot")) return NEGOTIATION_STAGE_COLOR;
  if (code.includes("contact")) return "var(--color-info)";
  if (code.includes("qualif")) return "var(--color-primary)";
  if (code.includes("quot")) return "var(--color-warning)";
  if (code.includes("contract")) return "var(--color-success)";
  if (code.includes("won")) return "var(--color-success)";
  if (code.includes("lost") || code.includes("dead") || code.includes("drop"))
    return "var(--color-destructive)";
  if (code.includes("new")) return "var(--color-muted-foreground)";
  const position = stage.stage_order >= 1 ? stage.stage_order : 1;
  const index =
    ((position - 1) % FALLBACK_BY_ORDER.length + FALLBACK_BY_ORDER.length) %
    FALLBACK_BY_ORDER.length;
  return FALLBACK_BY_ORDER[index];
}
