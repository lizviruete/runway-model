// =============================================================================
// Column-chart geometry — design package §5.
//
// Pure, so the edge states are unit-testable without rendering SVG (ruling a).
// The chart component maps these numbers onto an <svg>; it decides nothing.
//
// STOCK, NOT FLOW. A column's height is the money still in the accounts at the
// END of that month — a balance, not that month's spending. Columns invite the
// flow reading, which is why the y-axis title and the view subhead are not
// optional. Nothing in here computes a per-month outflow.
// =============================================================================

import type { AccountTimeline } from "./engine/types";

/** §5 geometry constants. No new spacing values — these are chart-internal. */
export const COLUMN = {
  /** Fraction of the band a column occupies; the rest is the column gap. */
  widthRatio: 0.62,
  maxWidth: 52,
  minWidth: 8,
  /** The 2px surface gap between stacked segments (dataviz method).
   *  Separates neighbours regardless of hue — see ruling (u). */
  segmentGap: 2,
} as const;

/** Width of one column, and the band it sits in. */
export function columnWidth(plotWidth: number, months: number): number {
  if (months <= 0) return COLUMN.minWidth;
  const band = plotWidth / months;
  return Math.max(COLUMN.minWidth, Math.min(COLUMN.maxWidth, band * COLUMN.widthRatio));
}

/** Centre x of month `i` within a plot of `months` equal bands. */
export function bandCenter(plotWidth: number, months: number, i: number): number {
  if (months <= 0) return 0;
  const band = plotWidth / months;
  return band * i + band / 2;
}

/**
 * One stacked segment, bottom-up, for a single month.
 *
 * Tap 1 sits at the TOP of the stack (matching the previous area chart's band
 * order), so the array is built from the last-tapped account upward and the
 * caller paints it as-is.
 */
export interface Segment {
  accountId: string;
  slot: number | null;
  /** Value at the bottom and top of this segment, in dollars. */
  from: number;
  to: number;
}

/**
 * Stack the drawing series for month `i`.
 *
 * Only series that DRAW are passed in — excluded accounts and liabilities are
 * filtered upstream, so a zero-balance included account still produces a
 * zero-height segment (which the caller skips) rather than being dropped here.
 */
export function stackAt(
  series: { accountId: string; slot: number | null; balances: number[] }[],
  i: number,
): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  // Reversed: last-tapped at the bottom, so tap 1 lands on top.
  for (const s of [...series].reverse()) {
    const value = Math.max(0, s.balances[i] ?? 0);
    segments.push({ accountId: s.accountId, slot: s.slot, from: cursor, to: cursor + value });
    cursor += value;
  }
  return segments;
}

/** Total stack height at month `i` — the money still held at month end. */
export function stackTotalAt(series: { balances: number[] }[], i: number): number {
  return series.reduce((sum, s) => sum + Math.max(0, s.balances[i] ?? 0), 0);
}

/**
 * The month index of the FIRST fully-depleted column, or null.
 *
 * §5: zero-height columns are not drawn. The baseline continues as a rule under
 * those months with a single "depleted" caption above the first of them, once —
 * never a row of repeated zeros.
 */
export function firstDepletedIndex(series: { balances: number[] }[], months: number): number | null {
  for (let i = 0; i < months; i++) {
    if (stackTotalAt(series, i) <= 0) return i;
  }
  return null;
}

/**
 * Where the cash-zero marker goes: the GAP before the first $0 column.
 *
 * Drawn in the gap, never through a column, so it reads as a boundary between
 * months rather than an annotation on one. Returns null when nothing depletes
 * inside the window — §5 is explicit that the absence of the marker is the good
 * news, and that no green marker is substituted.
 */
export function cashZeroGapX(
  series: { balances: number[] }[],
  months: number,
  plotWidth: number,
): number | null {
  const first = firstDepletedIndex(series, months);
  if (first === null || months <= 0) return null;
  const band = plotWidth / months;
  // The left edge of the first zero column's band IS the gap before it.
  return band * first;
}

/** Round a raw maximum up to a clean axis bound (1/2/2.5/5 × 10^n). */
export function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (v <= s * mag) return s * mag;
  return 10 * mag;
}

/**
 * Which series actually draw, paired with their slot.
 *
 * Excluded series are filtered here — BEFORE the axis maximum is computed —
 * because their balances are held at full value: leaving them in would scale
 * the axis to money that draws nothing and squash the real stack into the floor.
 */
export function drawingSeries(
  timelines: AccountTimeline[],
  slotOf: (accountId: string) => number | null,
): { accountId: string; slot: number | null; balances: number[]; name: string }[] {
  return timelines
    .filter((t) => t.type !== "credit_line" && !t.excluded)
    .map((t) => ({ accountId: t.accountId, slot: slotOf(t.accountId), balances: t.balances, name: t.name }));
}
