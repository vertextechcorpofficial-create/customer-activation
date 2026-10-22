import type { Tone } from "../components/status-pill";

/**
 * Stage colour identity, module-local.
 * Terminal stages keep their semantic colour; anything else cycles through
 * a fixed progression by 1-based `stage_order` position.
 *
 * ponytail: `success`/`destructive` are reserved for terminal stages ONLY
 * (is_won → success, is_lost → destructive). They must never appear in the
 * non-terminal cycle — order 5 (Negotiation) previously rendered GREEN,
 * identical to Closed Won (rgb 33,196,93), so an in-progress stage read as
 * "won" and the terminal was indistinguishable. Four design-system tokens
 * only; do NOT add a 5th tone or raw hex. Accepted overlap: with 6
 * non-terminal stages, positions 1/5 share `neutral` and 2/6 share `info`;
 * adjacent stages stay distinct, which is what matters for board scanning.
 */
const PROGRESSION: Tone[] = ["neutral", "info", "primary", "warning"];

export function stageTone(stage: {
  is_won?: unknown;
  is_lost?: unknown;
  stage_order: number;
}): Tone {
  if (Number(stage.is_won) === 1) return "success";
  if (Number(stage.is_lost) === 1) return "destructive";
  const position = stage.stage_order >= 1 ? stage.stage_order : stage.stage_order + 1;
  const index =
    ((position - 1) % PROGRESSION.length + PROGRESSION.length) % PROGRESSION.length;
  return PROGRESSION[index];
}

/** Left-border/top-bar accent class for column headers. */
export function stageAccentClass(tone: Tone): string {
  switch (tone) {
    case "success":
      return "border-t-success";
    case "warning":
      return "border-t-warning";
    case "destructive":
      return "border-t-destructive";
    case "info":
      return "border-t-info";
    case "primary":
      return "border-t-primary";
    default:
      return "border-t-border";
  }
}
