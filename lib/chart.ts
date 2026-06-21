// Pure geometry for the merged runway chart. Kept UI-free so the invariants
// the chart relies on (the asset stack, the net-liquid line, the shared scale)
// are unit-testable without rendering SVG.

import type { AccountTimeline, ProjectionPoint } from "./engine/types";

export type ChartMode = "total" | "byAccount";

/** The chart opens on the clean net-liquid view. */
export const DEFAULT_CHART_MODE: ChartMode = "total";

/** Asset timelines only — credit lines are debt, never part of the stack. */
export function assetTimelines(timelines: AccountTimeline[]): AccountTimeline[] {
  return timelines.filter((t) => t.type !== "credit_line");
}

/** Stack height (sum of asset balances) at month index `i`. */
export function assetStackTotalAt(assets: AccountTimeline[], i: number): number {
  return assets.reduce((s, t) => s + Math.max(0, t.balances[i] ?? 0), 0);
}

/** Round a raw maximum up to a clean axis bound (1/2/2.5/5 × 10^n). */
export function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (v <= s * mag) return s * mag;
  return 10 * mag;
}

/**
 * The y-axis maximum, shared by both views so toggling never rescales: the
 * larger of the net-liquid line, the optional baseline overlay, and the asset
 * stack. (Net liquid = assets − drawn ≤ assets, so the stack usually sets the
 * ceiling; the net-liquid line dips below it when a credit line is drawn.)
 */
export function chartMax(
  current: ProjectionPoint[],
  baseline: ProjectionPoint[] | null | undefined,
  assets: AccountTimeline[],
  showBaseline: boolean,
): number {
  const vals: number[] = [1];
  current.forEach((p, i) => {
    vals.push(Math.max(0, p.netLiquid));
    vals.push(assetStackTotalAt(assets, i));
  });
  if (showBaseline && baseline) {
    for (const p of baseline) vals.push(Math.max(0, p.netLiquid));
  }
  return niceMax(Math.max(...vals));
}
