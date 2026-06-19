// =============================================================================
// The fictional sample scenario shipped pre-loaded.
//
// Deliberately a generous, financially healthy persona so the demo reads well
// and NO real personal financial data lives in the repo. Users replace it with
// their own accounts and levers.
// =============================================================================

import { defaultOngoingCost, defaultTaxTreatment } from "./engine/defaults";
import type { Account, AccountType, Scenario } from "./engine/types";

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

export function createSampleScenario(): Scenario {
  return {
    id: "sample",
    name: "Sample User — recent transition",
    createdDate: "2026-06-18",
    // 60-month (5-year) horizon. The baseline still craters at ~9 months, but
    // the long horizon means single-lever improvements resolve to concrete
    // cash-zero dates, and "beyond horizon" only shows for genuinely
    // cash-flow-positive scenarios (e.g. the "Landed a new role" preset). The
    // chart x-axis auto-scales to the meaningful window, so the baseline still
    // reads as a clean ~12-month view. Modest balances make the waterfall
    // cascade checking → savings → HYSA → brokerage → Roth → pre-tax IRA before
    // zero, so both the brokerage cap-gains and pre-tax tax+penalty events show.
    timeline: { start: "2026-07-01", end: "2031-06-30" },
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
        // Sublet drops housing to $1,400 from month 3 (Sept 2026).
        change: { date: "2026-09-01", newAmount: 1_400 },
      },
      targetMonthlySpend: 6_500,
      incomeEvents: [
        {
          id: "inc-severance",
          label: "Severance",
          kind: "recurring",
          amount: 9_000,
          startDate: "2026-07-01",
          endDate: "2026-08-31", // ~2 months out
        },
        {
          id: "inc-unemployment",
          label: "Unemployment benefit",
          kind: "recurring",
          amount: 3_900,
          startDate: "2026-09-01",
          endDate: "2027-02-28", // ~6 months
        },
      ],
      oneTimeEvents: [
        {
          id: "one-asset-sale",
          label: "Asset sale",
          date: "2026-08-01", // month 2
          amount: 8_000,
          direction: "inflow",
        },
      ],
    },
    baselineMonthlySpend: 6_500,
  };
}
