// Whether a scenario carries any real magnitude — used to decide if a baseline
// is "meaningful" enough to compare against. The blank/all-zeros default (and
// the Start-fresh state) is NOT meaningful, so we hide the per-lever "vs
// baseline" hints rather than comparing against an implicit $0.

import type { Scenario } from "./engine/types";

/** True if any account balance, or any income/expense amount, is non-zero.
 *  Housing and living spend are expense lines now, so the expense sweep below
 *  covers them — they no longer need checks of their own. */
export function hasMeaningfulAmounts(scenario: Scenario): boolean {
  const { accounts, levers } = scenario;
  if (accounts.some((a) => a.balance !== 0)) return true;
  if ((levers.incomeEvents ?? []).some((e) => e.amount !== 0)) return true;
  if ((levers.expenseEvents ?? []).some((e) => e.amount !== 0)) return true;
  return false;
}
