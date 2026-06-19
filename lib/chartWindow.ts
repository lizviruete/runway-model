// Decide how many months of the projection to render.
//
// The simulation horizon is long (60 months) so single-lever improvements
// resolve to concrete cash-zero dates. But rendering the full horizon makes
// the common ~9-month baseline a cramped sliver. So the chart x-axis
// auto-scales to the meaningful window: cash-zero (the later of current vs.
// baseline, when overlaid) plus a short margin, floored at a clean minimum.
// A scenario that never depletes ("beyond horizon") shows the full horizon.

import { monthKey } from "./engine/dates";
import type { SimulationResult } from "./engine/types";

const MIN_WINDOW = 12;
const MARGIN_MONTHS = 3;

/** Month index containing the cash-zero date, or null if it never depletes. */
function cashZeroIndex(res: SimulationResult): number | null {
  const d = res.runway.cashZeroDate;
  if (!d) return null;
  const key = monthKey(d);
  const idx = res.projection.findIndex((p) => p.monthKey === key);
  return idx >= 0 ? idx : res.projection.length - 1;
}

/**
 * Number of leading months to display.
 * - If either the current or (shown) baseline scenario survives the horizon,
 *   show the full horizon.
 * - Otherwise show through the later cash-zero + a short margin, min 12.
 */
export function visibleMonthCount(
  result: SimulationResult,
  baseline: SimulationResult | null,
  showBaseline: boolean,
): number {
  const total = result.projection.length;
  const cur = cashZeroIndex(result);
  const base = showBaseline && baseline ? cashZeroIndex(baseline) : cur;
  if (cur === null || base === null) return total; // someone is sustainable
  const endIdx = Math.max(cur, base);
  return Math.min(total, Math.max(MIN_WINDOW, endIdx + 1 + MARGIN_MONTHS));
}
