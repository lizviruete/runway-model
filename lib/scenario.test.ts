import { describe, expect, it } from "vitest";
import { applyTypeDefaults, moveAccount, newAccount, renumber, updateAccount } from "./scenario";
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
