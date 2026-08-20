// =============================================================================
// The account-ordering contract (V2.1 item 1, regression coverage).
//
// Four orders have to agree at all times: the accounts panel, the chart legend,
// the chart series, and the expanded-month ledger rows. Nothing asserted this
// before, which is what let the blank-name defect read as an ORDERING fault —
// an unlabeled row wedged between two named ones looks misplaced, not unnamed.
//
// Per the V2.1 test ruling this is asserted on the pure layer the rendered
// components map over, not on rendered DOM:
//   panel   → scenario.accounts
//   series  → assetTimelines(result.accountTimelines)   (RunwayChart bands)
//   legend  → the SAME array (RunwayChart legend; the stack reverses it for
//             painting, which is order-preserving by construction)
//   ledger  → month.accounts, for every month  (LedgerView expanded rows)
// =============================================================================

import { describe, expect, it } from "vitest";
import { assetTimelines } from "./chart";
import { accountDisplayNames } from "./engine/accountName";
import { defaultOngoingCost, defaultTaxTreatment, isCreditType } from "./engine/defaults";
import { seededLine } from "./engine/expenses";
import { simulate } from "./engine/simulate";
import type { Account, AccountType, Scenario } from "./engine/types";
import { SCENARIO_VERSION } from "./migrate";
import { moveAccount, newAccount, renumber } from "./scenario";

function acct(id: string, type: AccountType, name: string, priority: number): Account {
  return {
    id,
    name,
    type,
    balance: 5_000,
    depletionPriority: priority,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
  };
}

function scenarioOf(accounts: Account[]): Scenario {
  return {
    id: "ordering",
    name: "ordering",
    version: SCENARIO_VERSION,
    createdDate: "2026-01-01",
    timeline: { start: "2026-01-01", end: "2026-06-30" },
    accounts,
    // A real burn, so the waterfall actually cascades and every account posts
    // ledger activity rather than sitting inert.
    levers: {
      incomeEvents: [],
      expenseEvents: [
        seededLine("housing", 1_000, "2026-01-01"),
        seededLine("living", 2_000, "2026-01-01"),
      ],
    },
  };
}

/** Assert all four orders agree, and that the names on them agree too. */
function expectOrdersAgree(scenario: Scenario, step: string): void {
  const result = simulate(scenario);

  const panel = scenario.accounts.map((a) => a.id);
  const series = assetTimelines(result.accountTimelines).map((t) => t.accountId);
  const panelAssets = scenario.accounts.filter((a) => !isCreditType(a.type)).map((a) => a.id);

  // ledger rows — every month, not just the first
  for (const month of result.months) {
    expect(month.accounts.map((a) => a.accountId), `${step} · ledger ${month.monthKey}`).toEqual(
      panel,
    );
  }
  // chart series + legend (both map this array)
  expect(series, `${step} · chart series/legend`).toEqual(panelAssets);
  // full timeline order, before the credit-line filter
  expect(result.accountTimelines.map((t) => t.accountId), `${step} · timelines`).toEqual(panel);

  // Array order IS the tap order: a divergence here would leave the panel and
  // the legend agreeing while the waterfall drained in a different sequence.
  expect(scenario.accounts.map((a) => a.depletionPriority), `${step} · priorities`).toEqual(
    scenario.accounts.map((_, i) => i + 1),
  );

  // …and the labels on those rows agree with the panel's, position by position.
  const expected = accountDisplayNames(scenario.accounts);
  for (const t of result.accountTimelines) {
    expect(t.name, `${step} · timeline name ${t.accountId}`).toBe(expected.get(t.accountId));
  }
  for (const month of result.months) {
    for (const a of month.accounts) {
      expect(a.name, `${step} · ledger name ${a.accountId}`).toBe(expected.get(a.accountId));
    }
  }
}

const START: Account[] = [
  acct("checking", "checking", "Everyday Checking", 1),
  acct("savings", "savings", "", 2),
  acct("brokerage", "brokerage", "", 3),
  acct("line", "credit_line", "HELOC", 4),
];

describe("account ordering stays consistent across add / remove / reorder", () => {
  it("agrees on the initial list", () => {
    expectOrdersAgree(scenarioOf(START), "initial");
  });

  it("agrees after every step of an add / remove / reorder sequence", () => {
    let accounts = START;
    const step = (label: string, next: Account[]) => {
      accounts = next;
      expectOrdersAgree(scenarioOf(accounts), label);
    };

    step("move first to third", moveAccount(accounts, 0, 2));
    step("move last to first", moveAccount(accounts, accounts.length - 1, 0));
    step("append an account", [
      ...accounts,
      { ...newAccount("hysa", accounts.length + 1), id: "added" },
    ]);
    step("remove from the middle", renumber(accounts.filter((a) => a.id !== "brokerage")));
    step("move the added account up", moveAccount(accounts, accounts.length - 1, 1));
    step("append a second unnamed account of an existing type", [
      ...accounts,
      { ...newAccount("savings", accounts.length + 1), id: "savings-2", name: "" },
    ]);
    step("remove the first account", renumber(accounts.filter((a) => a.id !== accounts[0].id)));

    // The sequence is only meaningful if it actually churned the list.
    expect(accounts.map((a) => a.id)).not.toEqual(START.map((a) => a.id));
  });

  it("keeps the legend's fallback labels in step with a reorder", () => {
    // Two unnamed accounts of one type: reordering them swaps which one carries
    // the trailing index, and the legend must follow the panel — not cache the
    // label it resolved on the previous render.
    const unnamed = [
      acct("op", "checking", "Everyday Checking", 1),
      acct("r1", "roth", "", 2),
      acct("r2", "roth", "", 3),
    ];
    const before = simulate(scenarioOf(unnamed));
    expect(before.accountTimelines.map((t) => t.name)).toEqual([
      "Everyday Checking",
      "Roth retirement",
      "Roth retirement (2)",
    ]);

    const swapped = scenarioOf(moveAccount(unnamed, 2, 1));
    const after = simulate(swapped);
    expect(after.accountTimelines.map((t) => t.accountId)).toEqual(["op", "r2", "r1"]);
    expect(after.accountTimelines.map((t) => t.name)).toEqual([
      "Everyday Checking",
      "Roth retirement",
      "Roth retirement (2)",
    ]);
    expectOrdersAgree(swapped, "reordered unnamed pair");
  });

  it("holds when every account is unnamed", () => {
    const allBlank = [
      acct("a", "checking", "", 1),
      acct("b", "savings", "  ", 2),
      acct("c", "savings", "", 3),
      acct("d", "credit_line", "", 4),
    ];
    expectOrdersAgree(scenarioOf(allBlank), "all unnamed");
    expect(simulate(scenarioOf(allBlank)).accountTimelines.map((t) => t.name)).toEqual([
      "Everyday / checking",
      "Savings",
      "Savings (2)",
      "Credit line / HELOC",
    ]);
  });

  it("holds for a single account", () => {
    expectOrdersAgree(scenarioOf([acct("only", "checking", "", 1)]), "single account");
  });
});
