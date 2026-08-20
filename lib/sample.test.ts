import { describe, expect, it } from "vitest";
import { createBlankScenario, createSampleScenario, SAMPLE_AS_OF } from "./sample";
import { cashFlowSummary } from "./cashFlowSummary";
import { findSeeded } from "./engine/expenses";
import { penaltyWaivedAt } from "./engine/simulate";
import { simulate } from "./engine/simulate";
import type { Scenario } from "./engine/types";

const housing = (s: Scenario) => findSeeded(s.levers, "housing")!;
// Look accounts up BY ID, never by index (ruling t). Reordering the array is a
// presentation change; these assertions are about identity.
const byId = (s: Scenario, id: string) => s.accounts.find((a) => a.id === id)!;

describe("example scenario — as-of anchoring", () => {
  it("reproduces the canonical scenario for the default anchor", () => {
    const s = createSampleScenario();
    expect(SAMPLE_AS_OF).toBe("2026-07-01");
    expect(s.timeline.start).toBe("2026-07-01");
    expect(s.timeline.end).toBe("2031-06-30");
    const severance = s.levers.incomeEvents.find((e) => e.id === "inc-severance")!;
    const unemployment = s.levers.incomeEvents.find((e) => e.id === "inc-unemployment")!;
    expect(severance.startDate).toBe("2026-07-01");
    expect(severance.endDate).toBe("2026-08-31");
    expect(unemployment.startDate).toBe("2026-09-01");
    expect(unemployment.endDate).toBe("2027-02-28");
    // The sublet is a step change on the seeded housing line (was the bespoke
    // `levers.housing.change` pair in v1).
    expect(housing(s).stepChange!.date).toBe("2026-09-01");
    // The standalone one-time section is gone; one-offs live in the flow lists.
    expect("oneTimeEvents" in s.levers).toBe(false);
  });

  it("expresses every event relative to the anchor", () => {
    const s = createSampleScenario("2027-03-01");
    expect(s.timeline.start).toBe("2027-03-01");
    expect(s.timeline.end).toBe("2032-02-29"); // 5 years out, leap-year end of month
    const severance = s.levers.incomeEvents.find((e) => e.id === "inc-severance")!;
    const unemployment = s.levers.incomeEvents.find((e) => e.id === "inc-unemployment")!;
    expect(severance.startDate).toBe("2027-03-01"); // starts at the anchor
    expect(severance.endDate).toBe("2027-04-30"); // ~2 months
    expect(unemployment.startDate).toBe("2027-05-01"); // anchor + 2 months
    expect(unemployment.endDate).toBe("2027-10-31"); // ~6 months
    expect(housing(s).stepChange!.date).toBe("2027-05-01");
    // The penalty-free month moves with the anchor too — anchor + 8 months.
    expect(byId(s, "acc-401k").penaltyFreeMonth).toBe("2027-11");
  });

  it("tells the same ~9-month crunch regardless of the anchor", () => {
    // Item 8 de-personalized the accounts but KEPT the crunch. The tension is
    // what makes the levers worth pulling; a comfortable example demonstrates
    // nothing. This test is the guard on that.
    //
    // MID-MONTH ANCHORS ARE THE POINT. The app passes the real "today", which
    // is a first-of-month on 1 day in 30. An earlier version of this test used
    // only first-of-month anchors and reported a comfortable spread while the
    // real drift — a partial opening month — went unmeasured.
    const anchors = ["2026-07-01", "2026-08-20", "2027-02-28", "2029-11-14"];
    const months = anchors.map((a) => simulate(createSampleScenario(a)).runway.months);
    for (const m of months) {
      expect(m).toBeGreaterThan(8);
      expect(m).toBeLessThan(10);
    }
    // Day-count and partial-opening-month drift only — never a different story.
    expect(Math.max(...months) - Math.min(...months)).toBeLessThan(1);
  });

  it("reads as BURNING at every anchor — the headline never contradicts the crunch", () => {
    // At $8,000 severance against $8,000 of spend the opening month netted
    // fractionally positive, and the summary bar read "Adding about $109/mo ·
    // turns negative …" on the example's own landing view. The regime is taken
    // from the first month, so an example that opens flat can announce the
    // opposite of what it exists to demonstrate.
    for (const anchor of ["2026-07-01", "2026-08-20", "2027-02-28", "2029-11-14"]) {
      const res = simulate(createSampleScenario(anchor));
      const cf = cashFlowSummary(res.months.slice(0, 24))!;
      expect(cf.regime, `anchor ${anchor}`).toBe("burning");
      expect(cf.turnaroundMonth, `anchor ${anchor}`).toBeNull();
    }
  });
});

describe("example scenario — de-personalized (item 8)", () => {
  const s = createSampleScenario();

  it("ships exactly three accounts", () => {
    expect(s.accounts).toHaveLength(3);
    expect(s.accounts.map((a) => a.id).sort()).toEqual(["acc-401k", "acc-checking", "acc-hysa"]);
  });

  it("carries no HELOC, brokerage, or IRA split — the balance sheet is generic", () => {
    // The TYPES stay supported. They have left the DEMO. Asserted on `type`
    // rather than on names, because a renamed account is still the same
    // structure and this test is about structure.
    const types = s.accounts.map((a) => a.type);
    for (const gone of ["credit_line", "brokerage", "roth", "savings"] as const) {
      expect(types).not.toContain(gone);
    }
  });

  it("carries no asset sale, and no one-off inflow at all", () => {
    // Incidental, and worth keeping: this is the inflow that produced the
    // transient-turnaround bug behind ruling (y). The demo path no longer has
    // one, so the demo never depended on that fix being right.
    expect(s.levers.incomeEvents.some((e) => e.kind === "oneoff")).toBe(false);
    const r = simulate(s);
    expect(r.months.every((m) => m.totals.oneTimeInflow === 0)).toBe(true);
  });

  it("uses round, obviously-illustrative balances", () => {
    // Nobody's real checking account holds exactly $5,000.
    for (const a of s.accounts) expect(a.balance % 1_000).toBe(0);
    expect(s.accounts.reduce((t, a) => t + a.balance, 0)).toBe(30_000);
  });

  it("names nothing after a person", () => {
    expect(s.name).not.toMatch(/sample user/i);
    expect(s.name).toBe("Example — income has paused");
  });
});

describe("each example account demonstrates one thing", () => {
  const s = createSampleScenario();

  it("checking is the neutral baseline — no return, no tax, no penalty", () => {
    const a = byId(s, "acc-checking");
    expect(a.expectedReturn).toBe(0);
    expect(a.taxTreatment.effectiveRate).toBe(0);
    expect(a.taxTreatment.earlyPenaltyRate).toBe(0);
    expect(a.penaltyFreeMonth).toBeUndefined();
  });

  it("the HYSA demonstrates a rate of return, and actually earns in the ledger", () => {
    expect(byId(s, "acc-hysa").expectedReturn).toBe(0.04);
    const r = simulate(s);
    const earned = r.months
      // `LedgerAmounts` is a Partial record — a month with no interest omits the
      // key entirely, so the fallback is load-bearing, not defensive noise.
      .map((m) => m.accounts.find((x) => x.accountId === "acc-hysa")!.inflows.interestEarned ?? 0)
      .reduce((t, x) => t + x, 0);
    expect(earned).toBeGreaterThan(0);
  });

  it("the 401(k) demonstrates the penalty-free date — tapped on BOTH sides of it", () => {
    // A date with withdrawals on only one side of it demonstrates nothing.
    // Assert the difference the date makes, not merely that the field is set.
    const a = byId(s, "acc-401k");
    expect(a.penaltyFreeMonth).toBe("2027-03");
    // Both-sides has to hold at EVERY anchor, not just the canonical one — the
    // app passes the real "today", and a demonstration that only works on one
    // day of the year demonstrates nothing on the other 364.
    for (const anchor of ["2026-07-01", "2026-08-20", "2027-02-28", "2029-11-14"]) {
      const scn = createSampleScenario(anchor);
      const free = byId(scn, "acc-401k").penaltyFreeMonth!;
      const tapped = simulate(scn)
        .months.filter((m) => m.accounts.find((x) => x.accountId === "acc-401k")!.outflows.tapOut !== 0)
        .map((m) => m.monthKey);
      expect(tapped.some((k) => k < free), `anchor ${anchor}: none penalized`).toBe(true);
      expect(tapped.some((k) => k >= free), `anchor ${anchor}: none waived`).toBe(true);
    }
    const r = simulate(s);
    // …and the engine agrees about which side is which.
    expect(penaltyWaivedAt(a, "2027-02-15")).toBe(false);
    expect(penaltyWaivedAt(a, "2027-03-15")).toBe(true);
    const penalties = r.scheduledTaxes.map((t) => t.penalty);
    expect(penalties.some((p) => p > 0)).toBe(true);
    expect(penalties.some((p) => p === 0)).toBe(true);
  });
});

describe("the blank scenario is untouched by item 8", () => {
  it("still starts everything at $0 with both seeded lines present", () => {
    const b = createBlankScenario();
    expect(b.accounts.every((a) => a.balance === 0)).toBe(true);
    expect(b.levers.expenseEvents).toHaveLength(2);
    // $0 in and $0 out never depletes, so the blank slate survives the horizon
    // rather than reading "0 weeks" — an empty scenario is not a crisis.
    const r = simulate(b).runway;
    expect(r.survivesHorizon).toBe(true);
    expect(r.cashZeroDate).toBeNull();
  });
});
