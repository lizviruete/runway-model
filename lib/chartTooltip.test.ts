import { describe, expect, it } from "vitest";
import {
  CAPTIONS,
  cashZeroLabel,
  eventLine,
  formatSigned,
  hasEvent,
  legendLabel,
  tooltipModel,
  tooltipRowValues,
  VIEW_LABEL,
  VIEW_SUBHEAD,
} from "./chartTooltip";
import { seededLine } from "./engine/expenses";
import { defaultExpectedReturn, defaultOngoingCost, defaultTaxTreatment } from "./engine/defaults";
import { simulate } from "./engine/simulate";
import { SCENARIO_VERSION } from "./migrate";
import type { Account, AccountType, Scenario } from "./engine/types";

function acct(id: string, type: AccountType, balance: number, priority: number, extra?: Partial<Account>): Account {
  return {
    id, name: id, type, balance, depletionPriority: priority,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: defaultExpectedReturn(type),
    ...extra,
  };
}

function scn(accounts: Account[], expenses = []): Scenario {
  return {
    id: "t", name: "t", version: SCENARIO_VERSION, createdDate: "2026-01-01",
    timeline: { start: "2026-01-01", end: "2026-06-30" },
    accounts,
    levers: {
      incomeEvents: [],
      expenseEvents: [seededLine("housing", 1_000, "2026-01-01"), seededLine("living", 2_000, "2026-01-01"), ...expenses],
    },
  };
}

describe("tooltip model — rows", () => {
  const s = scn([
    acct("check", "checking", 5_000, 1),
    acct("brok", "brokerage", 8_000, 2),
    acct("roth", "roth", 3_000, 3, { excluded: true }),
    acct("heloc", "credit_line", 20_000, 4),
  ]);
  const res = simulate(s);
  const model = tooltipModel(res.months[0], res.accountTimelines, 0, s);

  it("lists every asset series, and no liability", () => {
    expect(model.rows.map((r) => r.accountId)).toEqual(["check", "brok", "roth"]);
  });

  it("keeps an EXCLUDED row, stating 'excluded' instead of a figure", () => {
    const roth = model.rows.find((r) => r.accountId === "roth")!;
    expect(roth.excluded).toBe(true);
    expect(roth.value).toBeNull();
  });

  it("SHOWS a $0 balance rather than dropping it — its absence is information", () => {
    const drained = simulate(scn([acct("check", "checking", 100, 1), acct("b", "savings", 5_000, 2)]));
    const late = tooltipModel(drained.months[3], drained.accountTimelines, 3, scn([]));
    const zeroRow = late.rows.find((r) => r.zero);
    expect(zeroRow).toBeDefined();
    expect(zeroRow!.value).toBe("$0");
  });

  it("reads the month's NET from the engine, never re-deriving it", () => {
    // Ruling (n): items 6 and 7 read one figure. Re-deriving would let the
    // tooltip and the ledger's NET column disagree.
    expect(model.cashFlow).toBe(formatSigned(res.months[0].totals.net));
  });

  it("states opening and closing in the subheading", () => {
    expect(model.subheading).toMatch(/^opening \$[\d,]+ · closing \$[\d,]+$/);
  });

  it("has no double or missing spaces anywhere it renders", () => {
    const strings = [model.heading, model.subheading, model.netLiquid, model.cashFlow];
    for (const str of strings) expect(str).not.toMatch(/\s{2}/);
  });
});

describe("formatSigned", () => {
  it("always shows the sign except at zero", () => {
    expect(formatSigned(-7_900)).toBe("−$7,900");
    expect(formatSigned(1_200)).toBe("+$1,200");
    expect(formatSigned(0)).toBe("$0");
  });
});

describe("event line — one per month, first match wins", () => {
  const withStep = scn([acct("a", "checking", 5_000, 1)], [
    { id: "e", label: "Childcare", amount: 1_400, kind: "recurring", startDate: "2026-01-01", endDate: "2026-03-31" },
  ] as never);

  it("names a step change taking effect", () => {
    const s = scn([acct("a", "checking", 5_000, 1)]);
    s.levers.expenseEvents[0].stepChange = { date: "2026-03-01", newAmount: 1_200 };
    expect(eventLine(s, "2026-03-01")).toBe("Housing / rent → $1,200 from this month");
  });

  it("names a line ending", () => {
    expect(eventLine(withStep, "2026-03-01")).toBe("Childcare ends this month");
  });

  it("names a penalty-free month being reached", () => {
    const s = scn([acct("ira", "pretax", 5_000, 1, { penaltyFreeMonth: "2026-04" })]);
    expect(eventLine(s, "2026-04-01")).toBe("Penalty-free from this month");
  });

  it("is null in a month with no event", () => {
    expect(eventLine(withStep, "2026-02-01")).toBeNull();
    expect(hasEvent(withStep, "2026-02-01")).toBe(false);
    expect(hasEvent(withStep, "2026-03-01")).toBe(true);
  });
});

describe("captions — §5 edge states, verbatim", () => {
  it("states the depleted caption once", () => {
    expect(CAPTIONS.depleted).toBe("depleted");
  });

  it("says nothing runs out, and never substitutes a green marker", () => {
    expect(CAPTIONS.noCashZero(24)).toBe("No cash-zero within this 24-month view.");
    expect(CAPTIONS.noCashZero(24)).not.toMatch(/green|safe|good/i);
  });

  it("distinguishes all-excluded from no-accounts — different code paths", () => {
    expect(CAPTIONS.allExcluded).toBe("Every account is excluded. Include one to see a runway.");
    expect(CAPTIONS.noAccounts).not.toBe(CAPTIONS.allExcluded);
  });

  it("keeps the y-axis title, which is the cost of moving off area", () => {
    expect(CAPTIONS.yAxisTitle).toBe("Balance at month end");
  });

  it("gives each view a subhead naming the QUANTITY, not just the split", () => {
    expect(VIEW_SUBHEAD.total).toContain("end of each month");
    expect(VIEW_SUBHEAD.byAccount).toContain("split by account in tap order");
  });

  it("renames the toggle to name the quantity", () => {
    expect(VIEW_LABEL.total).toBe("Balances · total");
    expect(VIEW_LABEL.byAccount).toBe("Balances · by account");
  });

  it("has no double spaces in any caption", () => {
    const all = [
      CAPTIONS.depleted, CAPTIONS.noCashZero(24), CAPTIONS.allExcluded,
      CAPTIONS.noAccounts, CAPTIONS.yAxisTitle,
      VIEW_SUBHEAD.total, VIEW_SUBHEAD.byAccount, VIEW_LABEL.total, VIEW_LABEL.byAccount,
    ];
    for (const c of all) expect(c).not.toMatch(/\s{2}/);
  });
});

describe("cash-zero label", () => {
  it("reads 'cash-zero · Apr 29'", () => {
    expect(cashZeroLabel("2027-04-29")).toBe("cash-zero · Apr 29");
    expect(cashZeroLabel("2026-01-05")).toBe("cash-zero · Jan 5");
  });
});

describe("legend label — the tap NUMBER is the primary channel (ruling u)", () => {
  it("leads with the tap number so a hue collision degrades gracefully", () => {
    expect(legendLabel(1, "Everyday Checking", false)).toBe("1. Everyday Checking");
    expect(legendLabel(4, "Brokerage", false)).toBe("4. Brokerage");
  });

  it("drops the number and says 'excluded' for a held-out account", () => {
    expect(legendLabel(null, "Pre-tax IRA", true)).toBe("Pre-tax IRA — excluded");
  });

  it("has no double spaces at any position", () => {
    for (const n of [null, 1, 8]) {
      expect(legendLabel(n, "Savings", false)).not.toMatch(/\s{2}/);
      expect(legendLabel(n, "Savings", true)).not.toMatch(/\s{2}/);
    }
  });
});

describe("the tooltip RECONCILES — rows sum to net liquid, every month", () => {
  const build = (accounts: Account[]) => {
    const s = scn(accounts);
    const res = simulate(s);
    return { s, res };
  };

  it("holds for every month of a scenario that depletes and draws credit", () => {
    // The panel is a reconciliation, not a list: every account reading $0 while
    // the footer reads −$66,775, with no row holding that number, reads as
    // internally inconsistent even though the arithmetic is right.
    const { res } = build([
      acct("check", "checking", 3_000, 1),
      acct("brok", "brokerage", 4_000, 2),
      acct("heloc", "credit_line", 2_000, 3),
    ]);
    expect(res.months.length).toBe(6); // the whole window, not a sample of it
    for (let i = 0; i < res.months.length; i++) {
      const v = tooltipRowValues(res.months[i], res.accountTimelines, i);
      const sum = v.accounts.reduce((a, b) => a + b, 0) + v.notCovered + v.creditDrawn;
      expect(sum, `month ${res.months[i].monthKey} does not reconcile`).toBeCloseTo(
        res.months[i].totals.closing,
        6,
      );
    }
  });

  it("holds POST-DEPLETION specifically, which is where it used to break", () => {
    const { res } = build([acct("check", "checking", 1_000, 1)]);
    const last = res.months.length - 1;
    const v = tooltipRowValues(res.months[last], res.accountTimelines, last);
    expect(v.accounts.every((a) => a === 0)).toBe(true); // every account reads $0…
    expect(v.notCovered).toBeLessThan(0); // …and this row carries the shortfall
    const sum = v.accounts.reduce((a, b) => a + b, 0) + v.notCovered + v.creditDrawn;
    expect(sum).toBeCloseTo(res.months[last].totals.closing, 6);
  });

  it("keeps 'Not covered' and 'Credit drawn' SEPARATE — debt was covered, by borrowing", () => {
    const { res } = build([
      acct("check", "checking", 1_000, 1),
      acct("heloc", "credit_line", 5_000, 2),
    ]);
    const last = res.months.length - 1;
    const v = tooltipRowValues(res.months[last], res.accountTimelines, last);
    expect(v.creditDrawn).toBeLessThan(0);
    expect(v.notCovered).toBeLessThan(0);
    // Folding the drawn credit into the shortfall would mislabel real debt.
    expect(v.notCovered).not.toBe(v.notCovered + v.creditDrawn);
  });

  it("adds NEITHER row while the accounts still cover everything", () => {
    const { s, res } = build([acct("check", "checking", 500_000, 1)]);
    const model = tooltipModel(res.months[0], res.accountTimelines, 0, s);
    expect(model.rows.some((r) => r.kind)).toBe(false);
  });

  it("labels the rows exactly, with no double or missing spaces", () => {
    const { s, res } = build([
      acct("check", "checking", 1_000, 1),
      acct("heloc", "credit_line", 3_000, 2),
    ]);
    const last = res.months.length - 1;
    const model = tooltipModel(res.months[last], res.accountTimelines, last, s);
    const labels = model.rows.filter((r) => r.kind).map((r) => r.label);
    expect(labels).toEqual(["Credit drawn", "Not covered"]);
    for (const l of labels) expect(l).not.toMatch(/\s{2}/);
  });
});
