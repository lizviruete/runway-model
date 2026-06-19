// =============================================================================
// Situation-framed presets.
//
// A preset is a pure transform of a scenario: apply(base) -> modified scenario.
// They compose, so "Both Combined" can chain other presets in Phase D.
//
// Phase A ships the two presets relevant to the baseline-vs-recovery story:
//   - "baseline"        : the scenario as-is (a visible depletion story)
//   - "landed-new-role" : adds new income, visibly extending the runway
// The remaining situation presets (Zero Housing Cost, Dramatic Lifestyle
// Reduction, Both Combined, Survive to Year-End) are built in Phase D.
// =============================================================================

import { addMonths } from "./engine/dates";
import type { IncomeEvent, Scenario } from "./engine/types";

export interface Preset {
  id: string;
  name: string;
  description: string;
  apply: (base: Scenario) => Scenario;
}

/** The new-role income stream, sized and timed off the scenario's start. */
const NEW_ROLE_INCOME_ID = "inc-new-role";

function withNewRoleIncome(base: Scenario): Scenario {
  // Remove any prior copy so the preset is idempotent, then add fresh.
  const others = base.levers.incomeEvents.filter((e) => e.id !== NEW_ROLE_INCOME_ID);
  const newRole: IncomeEvent = {
    id: NEW_ROLE_INCOME_ID,
    label: "New income",
    kind: "recurring",
    // Comfortably above the post-sublet burn, so the scenario becomes
    // cash-flow-positive and reads as "beyond horizon" rather than just
    // a delayed cash-zero.
    amount: 8_500,
    // "From month 6" — month 1 is the timeline start month.
    startDate: addMonths(base.timeline.start, 5),
  };
  return {
    ...base,
    levers: { ...base.levers, incomeEvents: [...others, newRole] },
  };
}

export const PRESETS: Preset[] = [
  {
    id: "baseline",
    name: "Baseline",
    description: "The starting scenario, unchanged — cash draws down to zero.",
    apply: (base) => base,
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
