// =============================================================================
// Expense row presentation — the at-a-glance signals (design package §1).
//
// Pure, so the copy is unit-testable without rendering a row (ruling (a)).
// =============================================================================

import { addMonths, compareISO, firstOfMonth, monthInRange } from "./engine/dates";
import { amountForMonth } from "./engine/expenses";
import type { FlowEvent } from "./engine/types";
import { formatCurrency, formatMonthYear } from "./format";

/** One chip on a row's meta line. `kind` lets the row style them apart. */
export interface MetaChip {
  text: string;
  kind: "cadence" | "step" | "ends" | "estimate";
}

/**
 * The meta line under a row's face — §1's "at-a-glance signals".
 *
 *   Monthly · ↘ $1,200 from Sep 2026    step change down, with the month
 *   Monthly · ↗ $3,400 from Jan 2027    step change up
 *   Monthly · ends Dec 2026             has an end date
 *   one-time · Sep 2026                 non-recurring
 *   Monthly · estimate                  paired with the ≈ before the label
 */
export function expenseMeta(line: FlowEvent): MetaChip[] {
  const chips: MetaChip[] = [];

  if (line.kind === "oneoff") {
    chips.push({ text: "one-time", kind: "cadence" });
    chips.push({ text: formatMonthYear(line.startDate), kind: "ends" });
  } else {
    chips.push({ text: "Monthly", kind: "cadence" });
    if (line.stepChange) {
      // The arrow is decorative; the amount and month carry the fact.
      const up = line.stepChange.newAmount > line.amount;
      chips.push({
        text: `${up ? "↗" : "↘"} ${formatCurrency(line.stepChange.newAmount)} from ${formatMonthYear(
          line.stepChange.date,
        )}`,
        kind: "step",
      });
    }
    if (line.endDate) {
      chips.push({ text: `ends ${formatMonthYear(line.endDate)}`, kind: "ends" });
    }
  }

  if (line.isEstimate) chips.push({ text: "estimate", kind: "estimate" });
  return chips;
}

/** Total recurring outflow per month at `monthStart`. One-offs are excluded —
 *  the headline is a monthly rate, and a lump is not one. */
export function monthlyRecurringTotal(lines: FlowEvent[], monthStart: string): number {
  return lines
    .filter((l) => l.kind === "recurring")
    .reduce((sum, l) => sum + amountForMonth(l, monthStart), 0);
}

/**
 * Every month within the horizon at which the recurring total changes: a step
 * change takes effect, or a line's end date has just passed.
 */
function changeMonths(lines: FlowEvent[], start: string, horizonEnd: string): string[] {
  const months = new Set<string>();
  for (const line of lines) {
    if (line.kind !== "recurring") continue;
    if (line.stepChange) months.add(firstOfMonth(line.stepChange.date));
    // A line that ends in December changes the total in January.
    if (line.endDate) months.add(firstOfMonth(addMonths(line.endDate, 1)));
    // A line that starts later also changes it.
    if (compareISO(firstOfMonth(line.startDate), firstOfMonth(start)) > 0) {
      months.add(firstOfMonth(line.startDate));
    }
  }
  return [...months]
    .filter((m) => compareISO(m, firstOfMonth(start)) > 0 && monthInRange(m, start, horizonEnd))
    .sort(compareISO);
}

/**
 * The section sub-head: `$10,700/mo now · $6,700 from Sep 2026`.
 *
 * The second clause appears only when the total actually changes inside the
 * horizon — §1: "second clause only when a step change or end date exists in
 * the horizon". It names the FIRST change; the rows carry the rest.
 */
export function expensesHeadline(
  lines: FlowEvent[],
  start: string,
  horizonEnd: string,
): string {
  const now = monthlyRecurringTotal(lines, firstOfMonth(start));
  const head = `${formatCurrency(now)}/mo now`;

  for (const month of changeMonths(lines, start, horizonEnd)) {
    const then = monthlyRecurringTotal(lines, month);
    // Only worth stating if it moves the number.
    if (Math.abs(then - now) > 0.005) {
      return `${head} · ${formatCurrency(then)} from ${formatMonthYear(month)}`;
    }
  }
  return head;
}
