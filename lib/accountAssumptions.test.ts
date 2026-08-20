import { describe, expect, it } from "vitest";
import {
  isDefaultRate,
  isRateInRange,
  monthlyReturnAt,
  penaltyFaceClause,
  penaltyState,
  penaltyStatusLine,
  returnFaceClause,
  returnHelper,
} from "./accountAssumptions";
import { defaultExpectedReturn, defaultOngoingCost, defaultTaxTreatment } from "./engine/defaults";
import type { Account, AccountType, ScenarioTimeline } from "./engine/types";

function acct(type: AccountType, balance: number, extra?: Partial<Account>): Account {
  return {
    id: "a",
    name: "",
    type,
    balance,
    depletionPriority: 1,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: defaultExpectedReturn(type),
    ...extra,
  };
}

const HORIZON: ScenarioTimeline = { start: "2026-08-01", end: "2027-07-31" };

describe("return face clause (§2)", () => {
  it("says 'assumes' at the default and 'your rate' once changed", () => {
    expect(returnFaceClause(acct("brokerage", 5_000))).toBe(
      "assumes 6%/yr · grows ≈ $25/mo at this balance",
    );
    expect(returnFaceClause(acct("brokerage", 5_000, { expectedReturn: 0.085 }))).toBe(
      "your rate: 8.5%/yr · grows ≈ $35/mo at this balance",
    );
  });

  it("keeps 'earns' for cash savings and 'grows' for investments", () => {
    expect(returnFaceClause(acct("hysa", 4_000))).toContain("earns ≈ $13/mo");
    expect(returnFaceClause(acct("pretax", 3_000))).toContain("grows ≈ $15/mo");
  });

  it("states 0% as no growth rather than an empty figure", () => {
    expect(returnFaceClause(acct("brokerage", 5_000, { expectedReturn: 0 }))).toBe(
      "your rate: 0%/yr · no growth modeled",
    );
    // …and `other` defaults to 0, so it reads as the DEFAULT, not a user choice.
    expect(returnFaceClause(acct("other", 5_000))).toBe("assumes 0%/yr · no growth modeled");
  });

  it("does not print 'grows ≈ −$400' for a negative rate", () => {
    const clause = returnFaceClause(acct("brokerage", 80_000, { expectedReturn: -0.06 }));
    // Typographic minus (U+2212), matching formatCurrency — not an ASCII hyphen.
    expect(clause).toBe("your rate: −6%/yr · shrinks ≈ $400/mo at this balance");
    expect(clause).not.toContain("grows");
  });

  it("says 'loses' rather than 'shrinks' for a cash savings account", () => {
    expect(returnFaceClause(acct("hysa", 10_000, { expectedReturn: -0.012 }))).toBe(
      "your rate: −1.2%/yr · loses ≈ $10/mo at this balance",
    );
  });

  it("swaps the helper between the default and a user's own rate", () => {
    expect(returnHelper(acct("brokerage", 1))).toBe(
      "Upward's default for brokerage / investment. Change it to match your account. Applied monthly, before tax.",
    );
    expect(returnHelper(acct("brokerage", 1, { expectedReturn: 0.09 }))).toBe(
      "Your rate. Applied monthly, before tax.",
    );
  });

  it("lowercases only the first letter of the type, preserving acronyms", () => {
    // A blanket toLowerCase() renders "traditional ira / 401k", which reads as
    // a typo. Caught in the live render, not by a test — hence this one.
    expect(returnHelper(acct("pretax", 1))).toBe(
      "Upward's default for pre-tax retirement (Traditional IRA / 401k). Change it to match your account. Applied monthly, before tax.",
    );
    expect(returnHelper(acct("hysa", 1))).toContain("default for high-yield savings.");
  });

  it("recognises the default per type", () => {
    expect(isDefaultRate(acct("hysa", 1))).toBe(true);
    expect(isDefaultRate(acct("hysa", 1, { expectedReturn: 0.042 }))).toBe(false);
    expect(isDefaultRate(acct("other", 1))).toBe(true); // 0 IS other's default
  });

  it("validates the §2 range, negatives included", () => {
    expect(isRateInRange(0.06)).toBe(true);
    expect(isRateInRange(-0.2)).toBe(true); // the floor is legal
    expect(isRateInRange(0.4)).toBe(true);
    expect(isRateInRange(-0.21)).toBe(false);
    expect(isRateInRange(0.41)).toBe(false);
    expect(isRateInRange(NaN)).toBe(false);
  });

  it("quotes the monthly figure at the CURRENT balance", () => {
    expect(monthlyReturnAt(acct("brokerage", 10_000, { expectedReturn: 0.06 }))).toBeCloseTo(50, 9);
    expect(monthlyReturnAt(acct("brokerage", 0, { expectedReturn: 0.06 }))).toBe(0);
  });
});

describe("penalty status line — §3's four states, verbatim", () => {
  const pretax = (penaltyFreeMonth?: string) => acct("pretax", 3_000, { penaltyFreeMonth });

  it("blank", () => {
    expect(penaltyState(pretax(), HORIZON)).toBe("blank");
    expect(penaltyStatusLine(pretax(), HORIZON)).toBe(
      "Penalty applied to every withdrawal in this projection. Add a month above if you'll turn 59½ before it ends.",
    );
  });

  it("future month", () => {
    expect(penaltyState(pretax("2027-03"), HORIZON)).toBe("future");
    expect(penaltyStatusLine(pretax("2027-03"), HORIZON)).toBe(
      "Penalty applied Aug 2026 – Feb 2027, then waived. Upward models the penalty only — it isn't tax advice.",
    );
  });

  it("past month", () => {
    expect(penaltyState(pretax("2025-01"), HORIZON)).toBe("past");
    expect(penaltyStatusLine(pretax("2025-01"), HORIZON)).toBe(
      "No penalty applied — you were already past 59½ when this projection starts.",
    );
  });

  it("month after the horizon", () => {
    expect(penaltyState(pretax("2030-01"), HORIZON)).toBe("afterHorizon");
    expect(penaltyStatusLine(pretax("2030-01"), HORIZON)).toBe(
      "Penalty applied for the whole projection; the waiver starts after it ends.",
    );
  });

  it("carries the tax-advice clause on this line and NOWHERE else", () => {
    // §3: no banner, no asterisk, no legal block. It rides on the one state
    // that actually states a waiver.
    const advice = "isn't tax advice";
    expect(penaltyStatusLine(pretax("2027-03"), HORIZON)).toContain(advice);
    expect(returnFaceClause(acct("pretax", 3_000))).not.toContain(advice);
    expect(returnHelper(acct("pretax", 3_000))).not.toContain(advice);
  });

  it("is ALWAYS present — every state returns a non-empty line", () => {
    for (const month of [undefined, "2025-01", "2027-03", "2030-01", "garbage"]) {
      expect(penaltyStatusLine(pretax(month), HORIZON).length).toBeGreaterThan(0);
    }
  });

  it("treats the month the projection STARTS in as already past", () => {
    // Crossing 59½ in the first month means no withdrawal is ever penalized.
    expect(penaltyState(pretax("2026-08"), HORIZON)).toBe("past");
  });

  it("names the last penalized month, not the waiver month", () => {
    // Waiver in March → the penalty covers through February.
    expect(penaltyStatusLine(pretax("2027-03"), HORIZON)).toContain("– Feb 2027");
    // …and across a year boundary.
    expect(penaltyStatusLine(pretax("2027-01"), HORIZON)).toContain("– Dec 2026");
  });

  it("falls back to blank on an unparseable value", () => {
    for (const bad of ["garbage", "2026-13", ""]) {
      expect(penaltyState(pretax(bad), HORIZON)).toBe("blank");
    }
  });
});

describe("penalty face clause", () => {
  it("appears only when a month is set", () => {
    expect(penaltyFaceClause(acct("pretax", 1))).toBeNull();
    expect(penaltyFaceClause(acct("pretax", 1, { penaltyFreeMonth: "2027-03" }))).toBe(
      "penalty-free from Mar 2027",
    );
    expect(penaltyFaceClause(acct("pretax", 1, { penaltyFreeMonth: "nope" }))).toBeNull();
  });
});
