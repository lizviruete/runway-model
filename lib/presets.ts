// =============================================================================
// Situation-framed presets.
//
// A preset is a pure transform of a scenario: apply(base) -> modified scenario.
// They are independent starting points (applied to the loaded baseline), and
// "Both Combined" / "Survive to Year-End" compose or solve as needed.
// =============================================================================

import { addMonths, compareISO, parseISO } from "./engine/dates";
import { simulate } from "./engine/simulate";
import type { IncomeEvent, Scenario } from "./engine/types";

export interface Preset {
  id: string;
  name: string;
  description: string;
  apply: (base: Scenario) => Scenario;
}

// --- individual transforms ---------------------------------------------------

function zeroHousing(base: Scenario): Scenario {
  return { ...base, levers: { ...base.levers, housing: { monthlyAmount: 0 } } };
}

function dramaticReduction(base: Scenario): Scenario {
  const cut = Math.round((base.levers.targetMonthlySpend * 0.5) / 50) * 50;
  return { ...base, levers: { ...base.levers, targetMonthlySpend: cut } };
}

const NEW_ROLE_INCOME_ID = "inc-new-role";

function withNewRoleIncome(base: Scenario): Scenario {
  const others = base.levers.incomeEvents.filter((e) => e.id !== NEW_ROLE_INCOME_ID);
  const newRole: IncomeEvent = {
    id: NEW_ROLE_INCOME_ID,
    label: "New income",
    kind: "recurring",
    // Comfortably above the post-sublet burn → cash-flow-positive.
    amount: 8_500,
    startDate: addMonths(base.timeline.start, 5), // "from month 6"
  };
  return { ...base, levers: { ...base.levers, incomeEvents: [...others, newRole] } };
}

/**
 * Find the highest non-housing spend at which the scenario lasts through the
 * end of the calendar year it would otherwise run out in. If the baseline is
 * already sustainable, returns it unchanged.
 */
function surviveToYearEnd(base: Scenario): Scenario {
  const baseRun = simulate(base).runway;
  if (baseRun.survivesHorizon || !baseRun.cashZeroDate) return base;

  const targetYear = parseISO(baseRun.cashZeroDate).y;
  const target = `${targetYear}-12-31`;

  const reaches = (spend: number) => {
    const r = simulate({ ...base, levers: { ...base.levers, targetMonthlySpend: spend } }).runway;
    return r.survivesHorizon || (!!r.cashZeroDate && compareISO(r.cashZeroDate, target) >= 0);
  };

  // Binary-search the max spend that still reaches the target.
  let lo = 0;
  let hi = base.levers.targetMonthlySpend;
  if (!reaches(lo)) return { ...base, levers: { ...base.levers, targetMonthlySpend: 0 } };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (reaches(mid)) lo = mid;
    else hi = mid;
  }
  const spend = Math.floor(lo / 50) * 50;
  return { ...base, levers: { ...base.levers, targetMonthlySpend: spend } };
}

// --- registry ----------------------------------------------------------------

export const PRESETS: Preset[] = [
  {
    id: "baseline",
    name: "Baseline",
    description: "The starting scenario, unchanged — cash draws down to zero.",
    apply: (base) => base,
  },
  {
    id: "zero-housing",
    name: "Zero housing cost",
    description: "Housing drops to $0 (e.g. move in with family).",
    apply: zeroHousing,
  },
  {
    id: "dramatic-reduction",
    name: "Dramatic lifestyle cut",
    description: "Halve non-housing spending.",
    apply: dramaticReduction,
  },
  {
    id: "both-combined",
    name: "Both combined",
    description: "Zero housing AND halved spending.",
    apply: (base) => dramaticReduction(zeroHousing(base)),
  },
  {
    id: "survive-year-end",
    name: "Survive to year-end",
    description: "Trim spending to last through the end of the year you'd run out in.",
    apply: surviveToYearEnd,
  },
  {
    id: "landed-new-role",
    name: "Landed a new role",
    description: "New income of $8,500/mo starting month 6 — cash-flow-positive.",
    apply: withNewRoleIncome,
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
