// Helpers for the explicit time model: the scenario's `timeline.start` is the
// "as of" anchor — balances are current as of that date, and the projection +
// ledger run forward from it. Pure + unit-testable.

import { addMonths, compareISO, daysInMonth, firstOfMonth, parseISO, toISO } from "./engine/dates";

/** The 5-year (60-month) horizon end for a given anchor, last-day-of-month. */
export function horizonEndFor(asOf: string): string {
  const { y, m } = parseISO(addMonths(asOf, 59));
  return toISO({ y, m, d: daysInMonth(y, m) });
}

/**
 * True when the anchor's month is strictly before today's month — i.e. the
 * scenario is a snapshot taken in the past, not a live "as of today" view.
 * Month-level so editing today's date within the current month never trips it.
 */
export function isPastAnchor(asOf: string, today: string): boolean {
  return compareISO(firstOfMonth(asOf), firstOfMonth(today)) < 0;
}
