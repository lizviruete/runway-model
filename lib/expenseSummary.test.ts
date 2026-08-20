import { describe, expect, it } from "vitest";
import { seededLine } from "./engine/expenses";
import type { FlowEvent } from "./engine/types";
import { expenseMeta, expensesHeadline, monthlyRecurringTotal } from "./expenseSummary";

const START = "2026-08-01";
const HORIZON = "2028-07-31";

function line(o: Partial<FlowEvent> & { id: string; amount: number }): FlowEvent {
  return {
    label: o.label ?? o.id,
    kind: "recurring",
    startDate: START,
    ...o,
  } as FlowEvent;
}

const texts = (l: FlowEvent) => expenseMeta(l).map((c) => c.text);

describe("expenseMeta — the at-a-glance signals (§1)", () => {
  it("shows cadence alone for a plain recurring line", () => {
    expect(texts(line({ id: "a", amount: 500 }))).toEqual(["Monthly"]);
  });

  it("shows a step change DOWN with its month", () => {
    expect(
      texts(line({ id: "a", amount: 2_800, stepChange: { date: "2026-09-01", newAmount: 1_200 } })),
    ).toEqual(["Monthly", "↘ $1,200 from Sep 2026"]);
  });

  it("shows a step change UP with its month", () => {
    expect(
      texts(line({ id: "a", amount: 2_800, stepChange: { date: "2027-01-01", newAmount: 3_400 } })),
    ).toEqual(["Monthly", "↗ $3,400 from Jan 2027"]);
  });

  it("shows an end date", () => {
    expect(texts(line({ id: "a", amount: 1_400, endDate: "2026-12-31" }))).toEqual([
      "Monthly",
      "ends Dec 2026",
    ]);
  });

  it("shows a one-time line as its cadence plus its month", () => {
    expect(texts(line({ id: "a", amount: 3_200, kind: "oneoff", startDate: "2026-09-15" }))).toEqual([
      "one-time",
      "Sep 2026",
    ]);
  });

  it("appends 'estimate' — the word, not just the glyph", () => {
    // §1: the ≈ is decorative; the estimate fact is carried by this word.
    expect(texts(line({ id: "a", amount: 6_500, isEstimate: true }))).toEqual([
      "Monthly",
      "estimate",
    ]);
    expect(expenseMeta(line({ id: "a", amount: 1, isEstimate: true })).at(-1)!.kind).toBe("estimate");
  });

  it("combines a step change, an end date and the estimate flag in order", () => {
    expect(
      texts(
        line({
          id: "a",
          amount: 2_000,
          stepChange: { date: "2026-10-01", newAmount: 1_000 },
          endDate: "2027-03-31",
          isEstimate: true,
        }),
      ),
    ).toEqual(["Monthly", "↘ $1,000 from Oct 2026", "ends Mar 2027", "estimate"]);
  });

  it("never shows a step change or end date on a one-off", () => {
    const oneoff = line({
      id: "a",
      amount: 500,
      kind: "oneoff",
      startDate: "2026-09-01",
      stepChange: { date: "2026-10-01", newAmount: 1 },
      endDate: "2026-12-31",
    });
    expect(texts(oneoff)).toEqual(["one-time", "Sep 2026"]);
  });
});

describe("monthlyRecurringTotal", () => {
  const lines = [
    seededLine("housing", 2_800, START, { stepChange: { date: "2026-09-01", newAmount: 1_200 } }),
    seededLine("living", 6_500, START),
    line({ id: "childcare", amount: 1_400, endDate: "2026-12-31" }),
    line({ id: "lump", amount: 9_999, kind: "oneoff", startDate: "2026-08-01" }),
  ];

  it("sums recurring lines only — a one-off is not a monthly rate", () => {
    expect(monthlyRecurringTotal(lines, "2026-08-01")).toBe(2_800 + 6_500 + 1_400);
  });

  it("follows step changes", () => {
    expect(monthlyRecurringTotal(lines, "2026-09-01")).toBe(1_200 + 6_500 + 1_400);
  });

  it("drops a line after its end date", () => {
    expect(monthlyRecurringTotal(lines, "2027-01-01")).toBe(1_200 + 6_500);
  });
});

describe("expensesHeadline — the section sub-head (§1)", () => {
  it("states the monthly total alone when nothing changes in the horizon", () => {
    const lines = [seededLine("housing", 2_800, START), seededLine("living", 6_500, START)];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$9,300/mo now");
  });

  it("adds the second clause for a step change", () => {
    const lines = [
      seededLine("housing", 2_800, START, { stepChange: { date: "2026-09-01", newAmount: 1_200 } }),
      seededLine("living", 6_500, START),
      line({ id: "childcare", amount: 1_400 }),
    ];
    // $10,700 now; housing steps down $1,600 in September.
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$10,700/mo now · $9,100 from Sep 2026");
  });

  it("adds the second clause for an end date, effective the month AFTER", () => {
    const lines = [
      seededLine("housing", 2_000, START),
      seededLine("living", 3_000, START),
      line({ id: "childcare", amount: 1_400, endDate: "2026-12-31" }),
    ];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$6,400/mo now · $5,000 from Jan 2027");
  });

  it("names the FIRST change when several exist", () => {
    const lines = [
      seededLine("housing", 2_800, START, { stepChange: { date: "2027-01-01", newAmount: 1_000 } }),
      seededLine("living", 6_500, START),
      line({ id: "childcare", amount: 1_400, endDate: "2026-09-30" }),
    ];
    // Childcare ends first (Oct 2026), before the housing step (Jan 2027).
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$10,700/mo now · $9,300 from Oct 2026");
  });

  it("ignores a change that falls outside the horizon", () => {
    const lines = [
      seededLine("housing", 2_800, START, { stepChange: { date: "2030-01-01", newAmount: 1_000 } }),
      seededLine("living", 6_500, START),
    ];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$9,300/mo now");
  });

  it("ignores a 'change' that does not move the number", () => {
    const lines = [
      seededLine("housing", 2_800, START, { stepChange: { date: "2026-09-01", newAmount: 2_800 } }),
      seededLine("living", 6_500, START),
    ];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$9,300/mo now");
  });

  it("handles the all-zero blank canvas without an empty state", () => {
    const lines = [seededLine("housing", 0, START), seededLine("living", 0, START)];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$0/mo now");
  });

  it("counts a line that starts later as a change", () => {
    const lines = [
      seededLine("housing", 2_000, START),
      seededLine("living", 3_000, START),
      line({ id: "loan", amount: 410, startDate: "2027-02-01" }),
    ];
    expect(expensesHeadline(lines, START, HORIZON)).toBe("$5,000/mo now · $5,410 from Feb 2027");
  });
});
