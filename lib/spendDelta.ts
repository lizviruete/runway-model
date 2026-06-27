// Target-monthly-spend "vs baseline" hint. Pure so it's unit-testable.
//
// The reference is the ACTIVE baseline's non-housing spend — the same working
// anchor the runway Δ and the chart's dashed overlay use — NOT a static field.
// When there's no real baseline yet, the anchor's spend is $0, which reads as
// the fresh-start fallback organically.

import { formatCurrency } from "./format";

/** Hint copy for the target-spend lever, comparing `target` against the active
 *  baseline's non-housing spend (`baselineSpend`). */
export function targetSpendHint(target: number, baselineSpend: number): string {
  const delta = target - baselineSpend;
  if (delta === 0) return "Same as baseline";
  return `${formatCurrency(delta, { sign: true })}/mo vs. baseline (${formatCurrency(baselineSpend)})`;
}
