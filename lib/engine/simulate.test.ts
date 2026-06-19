import { describe, expect, it } from "vitest";
import { simulate } from "./simulate";
import { defaultOngoingCost, defaultTaxTreatment } from "./defaults";
import { createSampleScenario } from "../sample";
import { getPreset } from "../presets";
import type {
  Account,
  AccountType,
  LedgerCategory,
  Levers,
  Scenario,
  SimulationResult,
} from "./types";

// ---- builders ---------------------------------------------------------------

function acct(
  o: { type: AccountType; balance: number; priority: number } & Partial<Account>,
): Account {
  return {
    id: o.id ?? `${o.type}-${o.priority}`,
    name: o.name ?? o.type,
    type: o.type,
    balance: o.balance,
    depletionPriority: o.priority,
    taxTreatment: o.taxTreatment ?? defaultTaxTreatment(o.type),
    ongoingCost: o.ongoingCost ?? defaultOngoingCost(o.type),
    manualDraw: o.manualDraw,
    userNote: o.userNote,
  };
}

function scn(o: {
  accounts: Account[];
  levers?: Partial<Levers>;
  start?: string;
  end?: string;
  baselineMonthlySpend?: number;
}): Scenario {
  return {
    id: "test",
    name: "test",
    createdDate: "2026-01-01",
    timeline: { start: o.start ?? "2026-01-01", end: o.end ?? "2026-12-31" },
    accounts: o.accounts,
    levers: {
      housing: { monthlyAmount: 0 },
      targetMonthlySpend: 0,
      incomeEvents: [],
      oneTimeEvents: [],
      ...o.levers,
    },
    baselineMonthlySpend: o.baselineMonthlySpend,
  };
}

// ---- ledger helpers ---------------------------------------------------------

/** Sum a ledger category across every account in every month. */
function sumCategory(res: SimulationResult, cat: LedgerCategory): number {
  let total = 0;
  for (const month of res.months) {
    for (const a of month.accounts) {
      total += (a.inflows[cat] ?? 0) + (a.outflows[cat] ?? 0);
    }
  }
  return total;
}

function sumAmounts(amounts: Record<string, number | undefined>): number {
  return Object.values(amounts).reduce<number>((s, v) => s + (v ?? 0), 0);
}

const EPS = 1e-6;

// =============================================================================

describe("spend lever self-consistency (Chris P0)", () => {
  it("a $X/mo change moves cumulative living outflow by exactly $X/mo", () => {
    const base = scn({
      accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
      levers: { targetMonthlySpend: 5_000 },
    });
    const bumped = scn({
      accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
      levers: { targetMonthlySpend: 5_500 },
    });
    const months = simulate(base).months.length;
    expect(months).toBe(12);

    const baseLiving = sumCategory(simulate(base), "living");
    const bumpedLiving = sumCategory(simulate(bumped), "living");

    expect(baseLiving).toBeCloseTo(5_000 * 12, 6);
    expect(bumpedLiving).toBeCloseTo(5_500 * 12, 6);
    // The whole point: the delta is exactly $500 * 12, nothing else moves.
    expect(bumpedLiving - baseLiving).toBeCloseTo(500 * 12, 6);
  });
});

describe("depletion waterfall order (Chris P1)", () => {
  it("drains accounts strictly in priority order", () => {
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1, id: "c" }),
          acct({ type: "savings", balance: 2_000, priority: 2, id: "s" }),
          acct({ type: "brokerage", balance: 5_000, priority: 3, id: "b" }),
        ],
        levers: { targetMonthlySpend: 1_500 },
      }),
    );
    const bal = (id: string) =>
      res.accountTimelines.find((t) => t.accountId === id)!.balances;

    // Month 1: checking (1000) drained, 500 pulled from savings, brokerage untouched.
    expect(bal("c")[0]).toBe(0);
    expect(bal("s")[0]).toBe(1_500);
    expect(bal("b")[0]).toBe(5_000);
    // Month 2: savings finishes, brokerage still untouched.
    expect(bal("s")[1]).toBe(0);
    expect(bal("b")[1]).toBe(5_000);
    // Month 3: only now does brokerage get tapped.
    expect(bal("b")[2]).toBe(3_500);
  });
});

describe("future-dated tax events (Chris P1)", () => {
  it("schedules a pre-tax withdrawal's tax+penalty for the following April 15", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2027-12-31",
        accounts: [
          acct({ type: "checking", balance: 100_000, priority: 1 }),
          acct({
            type: "pretax",
            balance: 50_000,
            priority: 2,
            id: "ira",
            manualDraw: { date: "2026-03-15", amount: 10_000 },
          }),
        ],
      }),
    );

    expect(res.scheduledTaxes).toHaveLength(1);
    const t = res.scheduledTaxes[0];
    expect(t.sourceAccountId).toBe("ira");
    expect(t.dueDate).toBe("2027-04-15");
    expect(t.tax).toBeCloseTo(10_000 * 1 * 0.22, 6); // ordinary income
    expect(t.penalty).toBeCloseTo(10_000 * 1 * 0.1, 6); // early penalty

    // ...and the cash actually leaves in April 2027, not at withdrawal time.
    const april = res.months.find((m) => m.monthKey === "2027-04")!;
    const aprilTax = april.accounts.reduce(
      (s, a) => s + (a.outflows.tax ?? 0),
      0,
    );
    expect(aprilTax).toBeCloseTo(3_200, 6);
    // No tax outflow before then.
    const beforeApril = res.months
      .filter((m) => m.monthKey < "2027-04")
      .reduce((s, m) => s + m.accounts.reduce((x, a) => x + (a.outflows.tax ?? 0), 0), 0);
    expect(beforeApril).toBe(0);
  });
});

describe("credit-line ongoing cost (Chris P1)", () => {
  it("accrues interest beginning the month AFTER a draw, on the drawn balance", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-06-30",
        accounts: [
          acct({ type: "checking", balance: 50_000, priority: 1 }),
          acct({
            type: "credit_line",
            balance: 50_000,
            priority: 2,
            id: "heloc",
            ongoingCost: { kind: "credit_interest", annualRate: 0.085 },
            manualDraw: { date: "2026-01-15", amount: 10_000 },
          }),
        ],
      }),
    );

    const monthly = 10_000 * (0.085 / 12); // ≈ 70.83
    const interestIn = (mk: string) =>
      res.months
        .find((m) => m.monthKey === mk)!
        .accounts.reduce((s, a) => s + (a.outflows.creditInterest ?? 0), 0);

    expect(interestIn("2026-01")).toBe(0); // none the month of the draw
    expect(interestIn("2026-02")).toBeCloseTo(monthly, 6);
    expect(interestIn("2026-06")).toBeCloseTo(monthly, 6);

    // Drawn principal stays at 10k (interest paid in cash, not capitalized).
    const heloc = res.accountTimelines.find((t) => t.accountId === "heloc")!;
    // remaining credit = limit - drawn = 40k throughout after the draw
    expect(heloc.balances[0]).toBe(40_000);
    expect(heloc.balances[5]).toBe(40_000);

    // Total interest over 5 accruing months.
    expect(sumCategory(res, "creditInterest")).toBeCloseTo(monthly * 5, 6);
  });
});

describe("HYSA interest earned", () => {
  it("accrues yield into the account each month", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-03-31",
        accounts: [
          acct({
            type: "hysa",
            balance: 10_000,
            priority: 1,
            id: "hysa",
            ongoingCost: { kind: "interest_earned", annualRate: 0.04 },
          }),
        ],
      }),
    );
    const jan = res.months[0].accounts[0];
    expect(jan.inflows.interestEarned).toBeCloseTo(10_000 * (0.04 / 12), 6);
    const bal = res.accountTimelines[0].balances;
    expect(bal[0]).toBeGreaterThan(10_000);
    expect(bal[2]).toBeGreaterThan(bal[0]); // compounds upward
  });
});

describe("manual draw override", () => {
  it("taps a specific account on its date regardless of need", () => {
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1, id: "c" }),
          acct({
            type: "savings",
            balance: 5_000,
            priority: 2,
            id: "s",
            manualDraw: { date: "2026-02-15", amount: 2_000 },
          }),
        ],
      }),
    );
    const c = res.accountTimelines.find((t) => t.accountId === "c")!.balances;
    const s = res.accountTimelines.find((t) => t.accountId === "s")!.balances;
    // Month 1: nothing happens.
    expect(c[0]).toBe(1_000);
    expect(s[0]).toBe(5_000);
    // Month 2: 2,000 moved from savings into checking, even with no shortfall.
    expect(s[1]).toBe(3_000);
    expect(c[1]).toBe(3_000);
  });
});

describe("housing change date", () => {
  it("applies the new amount from the change month forward", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-06-30",
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        levers: {
          housing: { monthlyAmount: 2_000, change: { date: "2026-04-01", newAmount: 1_000 } },
        },
      }),
    );
    const housingIn = (mk: string) =>
      res.months.find((m) => m.monthKey === mk)!.accounts[0].outflows.housing ?? 0;
    expect(housingIn("2026-01")).toBe(2_000);
    expect(housingIn("2026-03")).toBe(2_000);
    expect(housingIn("2026-04")).toBe(1_000);
    expect(housingIn("2026-06")).toBe(1_000);
    expect(sumCategory(res, "housing")).toBeCloseTo(2_000 * 3 + 1_000 * 3, 6);
  });
});

describe("one-time dated events", () => {
  it("applies inflows and outflows in their month only", () => {
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        levers: {
          oneTimeEvents: [
            { id: "in", label: "Sale", date: "2026-02-10", amount: 5_000, direction: "inflow" },
            { id: "out", label: "Bill", date: "2026-03-10", amount: 3_000, direction: "outflow" },
          ],
        },
      }),
    );
    const feb = res.months.find((m) => m.monthKey === "2026-02")!.accounts[0];
    const mar = res.months.find((m) => m.monthKey === "2026-03")!.accounts[0];
    expect(feb.inflows.oneTime).toBe(5_000);
    expect(mar.outflows.oneTime).toBe(3_000);
    expect(feb.outflows.oneTime ?? 0).toBe(0);
  });
});

describe("major asset sale lever (Chris P2)", () => {
  function saleScenario(over: Partial<Scenario["levers"]["assetSale"]> = {}) {
    return scn({
      start: "2026-01-01",
      end: "2026-12-31",
      accounts: [acct({ type: "checking", balance: 100_000, priority: 1 })],
      levers: {
        assetSale: {
          enabled: true,
          label: "Condo",
          saleDate: "2026-04-15",
          salePrice: 500_000,
          closingCostPct: 0.06,
          loanPayoff: 300_000,
          costBasis: 350_000,
          capGainsRate: 0.15,
          taxTiming: "next_april",
          associatedMonthlyIncomeToStop: 2_000,
          associatedMonthlyCostToStop: 1_500,
          ...over,
        },
      },
    });
  }

  it("books net proceeds, stops associated income/cost, schedules cap-gains tax", () => {
    const res = simulate(saleScenario());

    // net = 500k − 6% closing (30k) − 300k loan = 170k, in the sale month.
    const april = res.months.find((m) => m.monthKey === "2026-04")!;
    expect(april.accounts[0].inflows.assetSale).toBeCloseTo(170_000, 6);

    // associated income + carrying cost only accrue before the sale (Jan–Mar).
    expect(sumCategory(res, "assetCarry")).toBeCloseTo(1_500 * 3, 6); // outflow
    const assetIncome = res.months
      .filter((m) => m.monthKey < "2026-04")
      .reduce((s, m) => s + (m.accounts[0].inflows.income ?? 0), 0);
    expect(assetIncome).toBeCloseTo(2_000 * 3, 6);
    // none after the sale
    const afterCarry = res.months
      .filter((m) => m.monthKey > "2026-04")
      .reduce((s, m) => s + (m.accounts[0].outflows.assetCarry ?? 0), 0);
    expect(afterCarry).toBe(0);

    // capital gains: (500k − 350k) × 15% = 22.5k, due the following April 15.
    expect(res.scheduledTaxes).toHaveLength(1);
    expect(res.scheduledTaxes[0].tax).toBeCloseTo(22_500, 6);
    expect(res.scheduledTaxes[0].dueDate).toBe("2027-04-15");

    // ledger still reconciles with the sale in play
    for (const m of res.months) {
      expect(Math.abs(m.totals.opening + m.totals.inflow - m.totals.outflow - m.totals.closing)).toBeLessThan(1e-4);
    }
  });

  it("pays off a tied credit line from the proceeds", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-12-31",
        accounts: [
          acct({ type: "checking", balance: 100_000, priority: 1 }),
          acct({
            type: "credit_line",
            balance: 50_000,
            priority: 2,
            id: "heloc",
            manualDraw: { date: "2026-02-15", amount: 10_000 },
          }),
        ],
        levers: {
          assetSale: {
            enabled: true,
            label: "House",
            saleDate: "2026-04-15",
            salePrice: 100_000,
            closingCostPct: 0,
            loanPayoff: 0,
            costBasis: 100_000, // no gain → no cap-gains tax
            capGainsRate: 0.15,
            taxTiming: "next_april",
            tiedCreditAccountId: "heloc",
          },
        },
      }),
    );

    const heloc = res.accountTimelines.find((t) => t.accountId === "heloc")!;
    // Drawn 10k in Feb (remaining credit 40k); paid off at the April sale (50k).
    expect(heloc.balances[1]).toBe(40_000);
    expect(heloc.balances[3]).toBe(50_000);
    // net proceeds = 100k − 10k tied payoff = 90k
    const april = res.months.find((m) => m.monthKey === "2026-04")!;
    const op = april.accounts.find((a) => a.accountId !== "heloc")!;
    expect(op.inflows.assetSale).toBeCloseTo(90_000, 6);
    expect(res.scheduledTaxes).toHaveLength(0); // no gain
  });

  it("ignores the lever entirely when disabled", () => {
    const res = simulate(saleScenario({ enabled: false }));
    expect(sumCategory(res, "assetSale")).toBe(0);
    expect(res.scheduledTaxes).toHaveLength(0);
  });
});

describe("runway math", () => {
  it("computes a finite cash-zero date for a depleting scenario", () => {
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 3_000, priority: 1 })],
        levers: { targetMonthlySpend: 1_000 },
      }),
    );
    // 3,000 / 1,000 = exhausted after 3 months → dry at the start of month 4.
    expect(res.runway.survivesHorizon).toBe(false);
    expect(res.runway.cashZeroDate).toBe("2026-04-01");
    expect(res.runway.weeks).toBeCloseTo(90 / 7, 6); // Jan 1 → Apr 1 = 90 days
    expect(res.runway.months).toBeCloseTo(90 / (365.25 / 12), 6);
  });

  it("reports survivesHorizon when funds outlast the timeline", () => {
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        levers: { targetMonthlySpend: 100 },
      }),
    );
    expect(res.runway.survivesHorizon).toBe(true);
    expect(res.runway.cashZeroDate).toBeNull();
  });
});

describe("ledger integrity (Chris P0 — auditable)", () => {
  const res = simulate(createSampleScenario());

  it("reconciles every account every month: opening + inflows - outflows = closing", () => {
    for (const month of res.months) {
      for (const a of month.accounts) {
        const expected = a.opening + sumAmounts(a.inflows) - sumAmounts(a.outflows);
        expect(Math.abs(expected - a.closing)).toBeLessThan(1e-4);
      }
    }
  });

  it("reconciles monthly totals: closing = opening + inflow - outflow", () => {
    for (const month of res.months) {
      const { opening, inflow, outflow, closing } = month.totals;
      expect(Math.abs(opening + inflow - outflow - closing)).toBeLessThan(1e-4);
    }
  });

  it("carries closing balance into the next month's opening", () => {
    for (let i = 1; i < res.months.length; i++) {
      expect(
        Math.abs(res.months[i].totals.opening - res.months[i - 1].totals.closing),
      ).toBeLessThan(EPS);
    }
  });
});

describe("sample scenario smoke", () => {
  const res = simulate(createSampleScenario());
  const horizon = res.months.length;
  /** Index of the month an account first hits ~0 (or -1 if never). */
  const drainedAt = (name: string) => {
    const tl = res.accountTimelines.find((t) => t.name === name)!;
    return tl.balances.findIndex((b) => b <= 0.01);
  };

  it("produces the full horizon for all accounts", () => {
    expect(horizon).toBe(60); // 2026-07 .. 2031-06 (5-year horizon)
    expect(res.projection).toHaveLength(horizon);
    expect(res.accountTimelines).toHaveLength(7);
    for (const t of res.accountTimelines) expect(t.balances).toHaveLength(horizon);
    expect(res.transactions.length).toBeGreaterThan(0);
  });

  it("tells a tight, believable ~9-month depletion story", () => {
    expect(res.runway.survivesHorizon).toBe(false);
    expect(res.runway.cashZeroDate).not.toBeNull();
    expect(res.runway.months).toBeGreaterThan(8);
    expect(res.runway.months).toBeLessThan(10);
    expect(res.baselineMonthlySpend).toBe(6_500);
  });

  it("cascades the waterfall in priority order before cash-zero", () => {
    // Each lower-priority account drains no earlier than the one above it.
    const order = [
      "Everyday Checking",
      "Savings",
      "High-Yield Savings",
      "Brokerage",
      "Roth IRA",
      "Pre-tax IRA",
    ].map(drainedAt);
    for (const idx of order) expect(idx).toBeGreaterThanOrEqual(0); // all drained
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    }
  });

  it("reaches retirement and triggers BOTH brokerage and pre-tax tax events", () => {
    const brokerage = res.scheduledTaxes.filter((t) => t.sourceAccountName === "Brokerage");
    const pretax = res.scheduledTaxes.filter((t) => t.sourceAccountName === "Pre-tax IRA");
    expect(brokerage.length).toBeGreaterThan(0);
    expect(pretax.length).toBeGreaterThan(0);
    // Brokerage: capital gains only, no early penalty.
    expect(brokerage.every((t) => t.penalty === 0)).toBe(true);
    // Pre-tax: ordinary income tax AND a 10% early-withdrawal penalty.
    expect(pretax.some((t) => t.tax > 0 && t.penalty > 0)).toBe(true);
  });
});

describe("presets", () => {
  it("'Landed a new role' adds recovery income that extends the runway", () => {
    const base = createSampleScenario();
    const baseRes = simulate(base);
    const withRole = simulate(getPreset("landed-new-role")!.apply(base));

    // Baseline runs dry; the new role keeps funds alive through the horizon.
    expect(baseRes.runway.survivesHorizon).toBe(false);
    expect(withRole.runway.survivesHorizon).toBe(true);

    // The recovery income starts in month 6 (Dec 2026).
    const dec = withRole.months.find((m) => m.monthKey === "2026-12")!;
    const decIncome = dec.accounts.reduce((s, a) => s + (a.inflows.income ?? 0), 0);
    expect(decIncome).toBeGreaterThanOrEqual(7_000);
  });

  it("the preset is idempotent (no duplicate income on re-apply)", () => {
    const base = createSampleScenario();
    const preset = getPreset("landed-new-role")!;
    const once = preset.apply(base);
    const twice = preset.apply(once);
    const count = (s: typeof base) =>
      s.levers.incomeEvents.filter((e) => e.id === "inc-new-role").length;
    expect(count(once)).toBe(1);
    expect(count(twice)).toBe(1);
  });
});
