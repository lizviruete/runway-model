import { describe, expect, it } from "vitest";
import {
  applyTypeDefaults,
  moveAccount,
  newAccount,
  renumber,
  TYPE_DERIVED_KEYS,
  updateAccount,
} from "./scenario";
import { accountDisplayName } from "./engine/accountName";
import {
  ACCOUNT_TYPE_META,
  defaultExpectedReturn,
  defaultOngoingCost,
  defaultTaxTreatment,
} from "./engine/defaults";
import type { Account, AccountType } from "./engine/types";
import { createSampleScenario } from "./sample";

describe("newAccount", () => {
  it("seeds defaults from the type and sets the priority", () => {
    const a = newAccount("brokerage", 3);
    expect(a.type).toBe("brokerage");
    expect(a.depletionPriority).toBe(3);
    expect(a.taxTreatment.taxableFraction).toBeGreaterThan(0); // brokerage is taxable
    expect(a.id).toMatch(/^acc-/);
  });
  it("treats credit lines specially", () => {
    const c = newAccount("credit_line", 1);
    expect(c.ongoingCost.kind).toBe("credit_interest");
  });

  it("leaves the name empty for every type, and lets the fallback label it", () => {
    // Deliberate: a prefilled name goes stale the moment the type changes, and
    // is indistinguishable from one the user typed. The display-name fallback
    // plus the card's placeholder cover it without storing anything.
    for (const type of Object.keys(ACCOUNT_TYPE_META) as AccountType[]) {
      const a = newAccount(type, 1);
      expect(a.name).toBe("");
      expect(accountDisplayName(a)).toBe(ACCOUNT_TYPE_META[type].label);
    }
  });
});

describe("renumber / moveAccount", () => {
  const base = createSampleScenario().accounts;

  it("renumbers priorities to match order", () => {
    const shuffled = [base[2], base[0], base[1]];
    const fixed = renumber(shuffled);
    expect(fixed.map((a) => a.depletionPriority)).toEqual([1, 2, 3]);
  });

  it("moves an account and renumbers", () => {
    const moved = moveAccount(base, 0, 2);
    // the old first account now sits at index 2 with priority 3
    expect(moved[2].id).toBe(base[0].id);
    expect(moved[2].depletionPriority).toBe(3);
    expect(moved[0].id).toBe(base[1].id);
  });

  it("is a no-op for out-of-range targets", () => {
    expect(moveAccount(base, 0, -1)).toBe(base);
    expect(moveAccount(base, 0, base.length)).toBe(base);
  });
});

describe("applyTypeDefaults — every type-derived field resets", () => {
  // THE COMPILER CANNOT SEE THIS. `applyTypeDefaults` spreads the old account
  // and overrides fields; excess-property checks do not fire through a spread,
  // so a field added to `Account` but forgotten in `typeDerived` would survive
  // a type change silently. This test is the guard.
  it("resets EVERY key `typeDerived` owns, enumerated", () => {
    const dirty: Account = {
      ...newAccount("pretax", 1),
      expectedReturn: 0.19, // a rate the user set on the pre-tax account
      penaltyFreeMonth: "2027-03",
      ongoingCost: { kind: "credit_interest", annualRate: 0.31 },
      taxTreatment: { ...defaultTaxTreatment("pretax"), effectiveRate: 0.99 },
    };
    const moved = applyTypeDefaults(dirty, "checking");

    for (const key of TYPE_DERIVED_KEYS) {
      expect(moved[key], `${key} survived a type change`).not.toEqual(dirty[key]);
    }
    // …and each lands on the new type's default.
    expect(moved.expectedReturn).toBe(defaultExpectedReturn("checking"));
    expect(moved.ongoingCost).toEqual(defaultOngoingCost("checking"));
    expect(moved.taxTreatment).toEqual(defaultTaxTreatment("checking"));
    expect(moved.penaltyFreeMonth).toBeUndefined();
  });

  it("does not grow a return on a type that cannot have one", () => {
    // The concrete bug: a 6% brokerage retyped as everyday checking would keep
    // compounding at 6% forever.
    const brokerage = newAccount("brokerage", 1);
    expect(brokerage.expectedReturn).toBe(0.06);
    expect(applyTypeDefaults(brokerage, "checking").expectedReturn).toBe(0);
    expect(applyTypeDefaults(brokerage, "savings").expectedReturn).toBe(0);
  });

  it("discards the penalty-free month when the type moves away from pre-tax (§3)", () => {
    const ira = { ...newAccount("pretax", 1), penaltyFreeMonth: "2027-03" };
    expect(applyTypeDefaults(ira, "brokerage").penaltyFreeMonth).toBeUndefined();
    expect(applyTypeDefaults(ira, "roth").penaltyFreeMonth).toBeUndefined();
    // …and re-typing back to pre-tax does not resurrect it.
    expect(applyTypeDefaults(applyTypeDefaults(ira, "roth"), "pretax").penaltyFreeMonth)
      .toBeUndefined();
  });

  it("seeds a new account with its type's default return", () => {
    expect(newAccount("hysa", 1).expectedReturn).toBe(0.04);
    expect(newAccount("roth", 1).expectedReturn).toBe(0.06);
    expect(newAccount("other", 1).expectedReturn).toBe(0);
    expect(newAccount("checking", 1).expectedReturn).toBe(0);
    expect(newAccount("credit_line", 1).expectedReturn).toBe(0);
    // A liability's rate stays a COST.
    expect(newAccount("credit_line", 1).ongoingCost.annualRate).toBe(0.085);
  });

  it("never leaves a yield on ongoingCost — that field is for costs only", () => {
    expect(newAccount("hysa", 1).ongoingCost).toEqual({ kind: "none", annualRate: 0 });
  });
});

describe("applyTypeDefaults / updateAccount", () => {
  it("re-defaults implications when the type changes", () => {
    const a = newAccount("checking", 1);
    const asPretax = applyTypeDefaults(a, "pretax");
    expect(asPretax.type).toBe("pretax");
    expect(asPretax.taxTreatment.earlyPenaltyRate).toBe(0.1);
    expect(asPretax.ongoingCost.kind).toBe("none");
  });

  it("patches a single account by id immutably", () => {
    const scenario = createSampleScenario();
    const id = scenario.accounts[0].id;
    const next = updateAccount(scenario, id, { balance: 99 });
    expect(next.accounts[0].balance).toBe(99);
    expect(scenario.accounts[0].balance).not.toBe(99); // original untouched
    expect(next).not.toBe(scenario);
  });
});
