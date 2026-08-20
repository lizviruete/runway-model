// =============================================================================
// The fictional example scenario shipped pre-loaded.
//
// DE-PERSONALIZED (item 8). Three generic accounts, round illustrative numbers,
// and nothing traceable to any real person's financial structure. The earlier
// seed carried a HELOC, a brokerage, a Roth/pre-tax IRA split and an asset sale
// — a specific balance sheet, and more surface than a demo needs. Those types
// all stay SUPPORTED; they have simply left the demo.
//
// Each account is here to show one thing:
//
//   Everyday Checking     the neutral baseline — no return, no tax, no penalty
//   High-Yield Savings    a rate of return (4.0%), earning while it is spent
//   401(k)                a penalty-free date, and tax on withdrawal
//
// THE ~9-MONTH CRUNCH IS DELIBERATE AND STAYS. The tension is what makes the
// levers worth pulling; a comfortable example demonstrates nothing.
//
// The scenario is anchored to an "as of" date and every event is expressed
// RELATIVE to it, so the example always tells the same story no matter when
// someone opens the app. The app passes the real "today"; tests and SSR use the
// canonical SAMPLE_AS_OF so the scenario stays deterministic.
// =============================================================================

import { addMonths, daysInMonth, firstOfMonth, parseISO, toISO } from "./engine/dates";
import {
  defaultExpectedReturn,
  defaultOngoingCost,
  defaultTaxTreatment,
} from "./engine/defaults";
import { seededLine } from "./engine/expenses";
import { SCENARIO_VERSION } from "./migrate";
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
    expectedReturn: defaultExpectedReturn(type),
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
    name: "Example — income has paused",
    version: SCENARIO_VERSION,
    createdDate: start,
    // 60-month (5-year) horizon from the anchor. The example still craters at
    // ~9 months, but the long horizon means single-lever improvements resolve
    // to concrete cash-zero dates, and "beyond horizon" only shows for genuinely
    // cash-flow-positive scenarios (e.g. the "Landed a new role" preset). The
    // chart x-axis auto-scales to the meaningful window.
    timeline: { start, end: endOfMonth(addMonths(start, 59)) },
    // Three accounts, tapped in this order. The waterfall runs
    // checking → high-yield savings → 401(k), so the tax-and-penalty events on
    // the last one are reached inside the crunch rather than off the horizon.
    accounts: [
      account("acc-checking", "Everyday Checking", "checking", 5_000, 1),
      account("acc-hysa", "High-Yield Savings", "hysa", 10_000, 2),
      account("acc-401k", "401(k)", "pretax", 15_000, 3, {
        // Placed so the 401(k) is tapped on BOTH sides of it: the first two
        // withdrawals carry the 10% early penalty and the next two do not, so
        // one ledger shows the difference the date makes.
        penaltyFreeMonth: monthStart(8).slice(0, 7),
      }),
    ],
    levers: {
      incomeEvents: [
        {
          // Core always-on lever: $0 because income has paused.
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
          // Below the $8,000 of housing + living deliberately. At $8,000 the
          // first month nets fractionally POSITIVE and the summary bar reads
          // "Adding about $109/mo · turns negative …" — the example's headline
          // claiming the opposite of the crunch it exists to show.
          amount: 7_000,
          startDate: start,
          endDate: endOfMonth(addMonths(start, 1)), // ~2 months out
        },
        {
          id: "inc-unemployment",
          label: "Unemployment benefit",
          kind: "recurring",
          amount: 3_000,
          startDate: monthStart(2),
          endDate: endOfMonth(addMonths(start, 7)), // ~6 months
        },
      ],
      // Housing and living spend are the two pinned, seeded expense lines.
      // The sublet is a step change ON the housing line, not a separate one.
      expenseEvents: [
        seededLine("housing", 3_000, start, {
          // Sublet halves housing from the anchor's month 3.
          stepChange: { date: monthStart(2), newAmount: 1_500 },
        }),
        seededLine("living", 5_000, start),
      ],
    },
    baselineMonthlySpend: 5_000,
  };
}

/** A blank slate — everything at $0, anchored to `asOf` — for "Start fresh". */
export function createBlankScenario(asOf: string = SAMPLE_AS_OF): Scenario {
  const start = asOf;
  return {
    id: "blank",
    name: "My scenario",
    version: SCENARIO_VERSION,
    createdDate: start,
    timeline: { start, end: endOfMonth(addMonths(start, 59)) },
    accounts: [
      account("acc-checking", "Checking", "checking", 0, 1),
      account("acc-savings", "Savings", "savings", 0, 2),
    ],
    levers: {
      incomeEvents: [
        { id: SALARY_ID, label: "Salary / primary income", kind: "recurring", amount: 0, startDate: start },
      ],
      // Seeded lines are always present, even at $0 — the expenses section is
      // never an empty state.
      expenseEvents: [seededLine("housing", 0, start), seededLine("living", 0, start)],
    },
    baselineMonthlySpend: 0,
  };
}
