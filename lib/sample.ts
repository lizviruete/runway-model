// =============================================================================
// The fictional sample scenario shipped pre-loaded.
//
// Deliberately a generous, financially healthy persona so the demo reads well
// and NO real personal financial data lives in the repo. Users replace it with
// their own accounts and levers.
//
// The scenario is anchored to an "as of" date and every event is expressed
// RELATIVE to it, so the sample always tells the same ~9-month-crunch story no
// matter when someone opens the app. The app passes the real "today"; tests and
// SSR use the canonical SAMPLE_AS_OF so the scenario stays deterministic.
// =============================================================================

import { addMonths, daysInMonth, firstOfMonth, parseISO, toISO } from "./engine/dates";
import { defaultOngoingCost, defaultTaxTreatment } from "./engine/defaults";
import type { Account, AccountType, Scenario } from "./engine/types";

/** Canonical anchor for deterministic tests + the SSR/first render. */
export const SAMPLE_AS_OF = "2026-07-01";

/** Reserved id for the always-on "Salary / primary income" core lever. */
export const SALARY_ID = "inc-salary";

/** Last calendar day of the month containing `iso`. */
function endOfMonth(iso: string): string {
  const { y, m } = parseISO(iso);
  return toISO({ y, m, d: daysInMonth(y, m) });
}

function account(
  id: string,
  name: string,
  type: AccountType,
  balance: number,
  depletionPriority: number,
  extra?: Partial<Account>,
): Account {
  return {
    id,
    name,
    type,
    balance,
    depletionPriority,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    ...extra,
  };
}

export function createSampleScenario(asOf: string = SAMPLE_AS_OF): Scenario {
  const start = asOf;
  // First-of-month, `k` months out from the anchor — for events that land on a
  // month boundary (housing change, the asset sale, the unemployment start).
  const monthStart = (k: number) => firstOfMonth(addMonths(start, k));

  return {
    id: "sample",
    name: "Sample User — recent transition",
    createdDate: start,
    // 60-month (5-year) horizon from the anchor. The baseline still craters at
    // ~9 months, but the long horizon means single-lever improvements resolve
    // to concrete cash-zero dates, and "beyond horizon" only shows for genuinely
    // cash-flow-positive scenarios (e.g. the "Landed a new role" preset). The
    // chart x-axis auto-scales to the meaningful window. Modest balances make
    // the waterfall cascade checking → savings → HYSA → brokerage → Roth →
    // pre-tax IRA before zero, so both the brokerage cap-gains and the pre-tax
    // tax+penalty events show.
    timeline: { start, end: endOfMonth(addMonths(start, 59)) },
    accounts: [
      account("acc-checking", "Everyday Checking", "checking", 3_000, 1),
      account("acc-savings", "Savings", "savings", 4_000, 2),
      account("acc-hysa", "High-Yield Savings", "hysa", 4_000, 3),
      account("acc-brokerage", "Brokerage", "brokerage", 5_000, 4),
      account("acc-roth", "Roth IRA", "roth", 3_000, 5),
      account("acc-pretax", "Pre-tax IRA", "pretax", 3_000, 6),
      account("acc-heloc", "HELOC", "credit_line", 2_000, 7),
    ],
    levers: {
      housing: {
        monthlyAmount: 2_800,
        // Sublet drops housing to $1,400 from the anchor's month 3.
        change: { date: monthStart(2), newAmount: 1_400 },
      },
      targetMonthlySpend: 6_500,
      incomeEvents: [
        {
          // Core always-on lever: $0 because income has paused (a layoff).
          id: SALARY_ID,
          label: "Salary / primary income",
          kind: "recurring",
          amount: 0,
          startDate: start,
        },
        {
          id: "inc-severance",
          label: "Severance",
          kind: "recurring",
          amount: 9_000,
          startDate: start,
          endDate: endOfMonth(addMonths(start, 1)), // ~2 months out
        },
        {
          id: "inc-unemployment",
          label: "Unemployment benefit",
          kind: "recurring",
          amount: 3_900,
          startDate: monthStart(2),
          endDate: endOfMonth(addMonths(start, 7)), // ~6 months
        },
        {
          // A one-off inflow (was the standalone one-time section).
          id: "one-asset-sale",
          label: "Asset sale",
          kind: "oneoff",
          amount: 8_000,
          startDate: monthStart(1), // anchor's month 2
        },
      ],
      expenseEvents: [],
    },
    baselineMonthlySpend: 6_500,
  };
}

/** A blank slate — everything at $0, anchored to `asOf` — for "Start fresh". */
export function createBlankScenario(asOf: string = SAMPLE_AS_OF): Scenario {
  const start = asOf;
  return {
    id: "blank",
    name: "My scenario",
    createdDate: start,
    timeline: { start, end: endOfMonth(addMonths(start, 59)) },
    accounts: [
      account("acc-checking", "Checking", "checking", 0, 1),
      account("acc-savings", "Savings", "savings", 0, 2),
    ],
    levers: {
      housing: { monthlyAmount: 0 },
      targetMonthlySpend: 0,
      incomeEvents: [
        { id: SALARY_ID, label: "Salary / primary income", kind: "recurring", amount: 0, startDate: start },
      ],
      expenseEvents: [],
    },
    baselineMonthlySpend: 0,
  };
}
