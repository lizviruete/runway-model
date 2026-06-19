// Display formatting helpers (UI-only; the engine stays unit-free).

import { parseISO } from "./engine/dates";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** $1,234 — whole dollars by default. */
export function formatCurrency(n: number, opts?: { cents?: boolean; sign?: boolean }): string {
  const cents = opts?.cents ?? false;
  const abs = Math.abs(n);
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const neg = n < 0;
  const sign = neg ? "−" : opts?.sign ? "+" : "";
  return `${sign}$${body}`;
}

/** "Jul 2026" */
export function formatMonthYear(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Jul ’26" — compact for chart axes. */
export function formatMonthShort(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
}

/** "Mar 30, 2027" */
export function formatDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Human runway phrase, e.g. "8.9 months" or "39 weeks". */
export function formatRunway(months: number): string {
  if (months < 1) {
    const weeks = months * (365.25 / 12) / 7;
    return `${weeks.toFixed(1)} weeks`;
  }
  return `${months.toFixed(1)} months`;
}
