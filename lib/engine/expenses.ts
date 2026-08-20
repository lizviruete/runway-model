// =============================================================================
// The expense primitive.
//
// One shape for housing, living spend and everything a user adds. The two
// seeded lines are pinned first and carry a `seeded` discriminant; that is the
// ONLY difference, and it is a position and a ledger category, not a
// capability. Everything here is pure so the engine, the presets and the UI
// resolve a line the same way.
// =============================================================================

import { compareISO, firstOfMonth, monthInRange, sameMonth } from "./dates";
import type { FlowEvent, LedgerCategory, Levers, SeededExpense } from "./types";

/** Stable ids for the seeded lines, so a migration is idempotent and a saved
 *  scenario keeps pointing at the same row across sessions. */
export const SEEDED_IDS: Record<SeededExpense, string> = {
  housing: "exp-housing",
  living: "exp-living",
};

/** Labels the seeded lines are created with. Editable afterwards, exactly like
 *  a user row's label — there is no second class of row. */
export const SEEDED_LABELS: Record<SeededExpense, string> = {
  housing: "Housing / rent",
  living: "Living spend",
};

/** The ledger category a line posts under. Seeded lines keep housing and living
 *  spend named distinctly in the audit trail; everything else is "expense". */
export function expenseCategory(line: FlowEvent): LedgerCategory {
  return line.seeded ?? "expense";
}

/**
 * The amount this line costs in the month starting `monthStart`, or 0.
 *
 * Recurring lines apply across [startDate, endDate]; a step change replaces the
 * amount from the first of its month forward. One-off lines apply in their
 * month only. This is the single definition of "what does this line cost in
 * month N" — the chart, the ledger and the summary all resolve through it.
 */
export function amountForMonth(line: FlowEvent, monthStart: string): number {
  if (line.kind === "oneoff") {
    return sameMonth(line.startDate, monthStart) ? line.amount : 0;
  }
  if (!monthInRange(monthStart, line.startDate, line.endDate)) return 0;
  if (line.stepChange && compareISO(monthStart, firstOfMonth(line.stepChange.date)) >= 0) {
    return line.stepChange.newAmount;
  }
  return line.amount;
}

/** Build a seeded line. `startDate` is the scenario's timeline start, and there
 *  is no end date: housing and living spend run the whole horizon. */
export function seededLine(
  seeded: SeededExpense,
  amount: number,
  startDate: string,
  extra?: Partial<FlowEvent>,
): FlowEvent {
  return {
    id: SEEDED_IDS[seeded],
    label: SEEDED_LABELS[seeded],
    amount,
    kind: "recurring",
    startDate,
    // Living spend is modeled, housing is entered — this is what carries "≈".
    ...(seeded === "living" ? { isEstimate: true } : {}),
    seeded,
    ...extra,
  };
}

export function findSeeded(levers: Levers, seeded: SeededExpense): FlowEvent | undefined {
  return levers.expenseEvents?.find((e) => e.seeded === seeded);
}

/** Current amount on a seeded line (0 when absent). Convenience for the presets
 *  and the "is this scenario meaningful" check, which both used to read the
 *  bespoke `levers.housing` / `levers.targetMonthlySpend` fields. */
export function seededAmount(levers: Levers, seeded: SeededExpense): number {
  return findSeeded(levers, seeded)?.amount ?? 0;
}

/** Immutably set a seeded line's amount, leaving every other field untouched. */
export function setSeededAmount(levers: Levers, seeded: SeededExpense, amount: number): Levers {
  return {
    ...levers,
    expenseEvents: (levers.expenseEvents ?? []).map((e) =>
      e.seeded === seeded ? { ...e, amount } : e,
    ),
  };
}

/** Immutably patch a seeded line (amount, step change, label, …). */
export function patchSeeded(
  levers: Levers,
  seeded: SeededExpense,
  patch: Partial<FlowEvent>,
): Levers {
  return {
    ...levers,
    expenseEvents: (levers.expenseEvents ?? []).map((e) =>
      e.seeded === seeded ? { ...e, ...patch } : e,
    ),
  };
}
