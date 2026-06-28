// Decide how many months of the projection to render.
//
// The simulation horizon is long (60 months) so single-lever improvements
// resolve to concrete cash-zero dates. But rendering the full horizon makes
// the common ~9-month baseline a cramped sliver with a long flat-at-zero tail.
// So the chart x-axis scales to the relevant runway: through the later cash-zero
// of the current scenario and the (shown) baseline, plus a short margin, floored
// at a clean minimum. The beyond-horizon fallback keys on the CURRENT scenario:
// only when the current line itself never depletes do we show the full horizon
// (a surviving baseline alone no longer forces it). The empty/all-zeros canvas —
// trivially "beyond horizon" with nothing to plot — collapses to the floor.

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

/** Whether the scenario has any net-liquid magnitude to plot (vs. a flat-zero
 *  blank canvas). */
function hasMagnitude(res: SimulationResult): boolean {
  return res.projection.some((p) => Math.abs(p.netLiquid) > 0.5);
}

/**
 * Number of leading months to display.
 * - Beyond-horizon: if the CURRENT scenario never depletes, show the full
 *   horizon — unless there's nothing to plot (empty canvas), which collapses to
 *   the floor instead of a long flat-zero line.
 * - Otherwise show through the later cash-zero of the current and (shown)
 *   baseline scenarios + a short margin, floored at 12.
 */
export function visibleMonthCount(
  result: SimulationResult,
  baseline: SimulationResult | null,
  showBaseline: boolean,
): number {
  const total = result.projection.length;
  const cur = cashZeroIndex(result);
  if (cur === null) {
    // Current is sustainable → full horizon, unless the canvas is empty.
    return hasMagnitude(result) ? total : MIN_WINDOW;
  }
  const base = showBaseline && baseline ? cashZeroIndex(baseline) : null;
  const endIdx = base === null ? cur : Math.max(cur, base);
  return Math.min(total, Math.max(MIN_WINDOW, endIdx + 1 + MARGIN_MONTHS));
}
