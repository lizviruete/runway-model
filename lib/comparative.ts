// "vs baseline" comparative hints for the numeric levers. Pure so it's testable.
//
// Each lever shows its current value relative to the active baseline's matching
// lever: "Same as baseline" when equal, else a signed, comma-formatted delta.
// `/mo` is kept for recurring/monthly levers and omitted for one-time lumps —
// a $2,000/mo delta is not a $2,000 one-time delta.

import { formatCurrency } from "./format";

/** Caption for a lever present now but absent from the baseline. */
export const NEW_VS_BASELINE = "New — not in baseline";

/**
 * Comparative hint for a lever vs. its baseline counterpart.
 * @param perMonth append "/mo" (recurring levers) — omit for one-time amounts.
 */
export function comparativeHint(
  current: number,
  baseline: number,
  opts?: { perMonth?: boolean },
): string {
  const delta = current - baseline;
  if (delta === 0) return "Same as baseline";
  const unit = opts?.perMonth ? "/mo" : "";
  return `${formatCurrency(delta, { sign: true })}${unit} vs. baseline (${formatCurrency(baseline)})`;
}
