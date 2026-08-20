import { describe, expect, it } from "vitest";
import { simulate } from "./simulate";
import { defaultOngoingCost, defaultTaxTreatment } from "./defaults";
import { seededLine } from "./expenses";
import { SCENARIO_VERSION } from "../migrate";
import { createSampleScenario } from "../sample";
import { getPreset } from "../presets";
import type {
  Account,
  AccountType,
  LedgerCategory,
  Levers,
  Scenario,
  SimulationResult,
  StepChange,
} from "./types";

// ---- builders ---------------------------------------------------------------

function acct(
  o: { type: AccountType; balance: number; priority: number } & Partial<Account>,
): Account {
  // Overrides are SPREAD, not enumerated. An enumerated builder silently drops
  // any Account field added later — `excluded` was dropped exactly that way,
  // and the compiler cannot see it because `Partial<Account>` accepts the key
  // whether or not the body reads it. Spreading makes future fields propagate
  // for free.
  const { priority, ...overrides } = o;
  return {
    id: `${o.type}-${priority}`,
    name: o.type,
    depletionPriority: priority,
    taxTreatment: defaultTaxTreatment(o.type),
    ongoingCost: defaultOngoingCost(o.type),
    // 0 unless a test is about returns — keeps unrelated assertions focused.
    // Production defaults are covered by defaults/migration tests instead.
    expectedReturn: 0,
    ...overrides,
  };
}

function scn(o: {
  accounts: Account[];
  levers?: Partial<Levers>;
  /** Seeded living-spend amount (was `levers.targetMonthlySpend` in v1). */
  spend?: number;
  /** Seeded housing amount, and an optional step change on that same line. */
  housing?: number;
  housingStep?: StepChange;
  start?: string;
  end?: string;
  baselineMonthlySpend?: number;
}): Scenario {
  const start = o.start ?? "2026-01-01";
  return {
    id: "test",
    name: "test",
    version: SCENARIO_VERSION,
    createdDate: "2026-01-01",
    timeline: { start, end: o.end ?? "2026-12-31" },
    accounts: o.accounts,
    levers: {
      incomeEvents: o.levers?.incomeEvents ?? [],
      // The two seeded lines are always present, pinned first, exactly as a
      // migrated or freshly-constructed scenario has them.
      expenseEvents: [
        seededLine("housing", o.housing ?? 0, start, o.housingStep ? { stepChange: o.housingStep } : undefined),
        seededLine("living", o.spend ?? 0, start),
        ...(o.levers?.expenseEvents ?? []),
      ],
      ...(o.levers?.assetSale ? { assetSale: o.levers.assetSale } : {}),
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
      spend: 5_000,
    });
    const bumped = scn({
      accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
      spend: 5_500,
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
        spend: 1_500,
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
            expectedReturn: 0.04,
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

describe("housing step change", () => {
  it("applies the new amount from the change month forward", () => {
    // v1 called this the housing "changes later" pair; it is now the general
    // step change on the seeded housing line. Same months, same amounts.
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-06-30",
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        housing: 2_000,
        housingStep: { date: "2026-04-01", newAmount: 1_000 },
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

describe("one-off income + expense events", () => {
  it("applies a one-off income and a one-off expense in their month only", () => {
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        levers: {
          incomeEvents: [
            { id: "in", label: "Sale", kind: "oneoff", amount: 5_000, startDate: "2026-02-10" },
          ],
          expenseEvents: [
            { id: "out", label: "Bill", kind: "oneoff", amount: 3_000, startDate: "2026-03-10" },
          ],
        },
      }),
    );
    const feb = res.months.find((m) => m.monthKey === "2026-02")!.accounts[0];
    const mar = res.months.find((m) => m.monthKey === "2026-03")!.accounts[0];
    expect(feb.inflows.income).toBe(5_000);
    expect(mar.outflows.expense).toBe(3_000);
    expect(feb.outflows.expense ?? 0).toBe(0);
  });

  it("applies a recurring expense between its start and end months", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-06-30",
        accounts: [acct({ type: "checking", balance: 1_000_000, priority: 1 })],
        levers: {
          expenseEvents: [
            { id: "child", label: "Childcare", kind: "recurring", amount: 1_200, startDate: "2026-02-01", endDate: "2026-04-30" },
          ],
        },
      }),
    );
    const expenseIn = (mk: string) =>
      res.months.find((m) => m.monthKey === mk)!.accounts[0].outflows.expense ?? 0;
    expect(expenseIn("2026-01")).toBe(0);
    expect(expenseIn("2026-02")).toBe(1_200);
    expect(expenseIn("2026-04")).toBe(1_200);
    expect(expenseIn("2026-05")).toBe(0);
    expect(sumCategory(res, "expense")).toBeCloseTo(1_200 * 3, 6);
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
        spend: 1_000,
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
        spend: 100,
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

// =============================================================================

describe("account display names in engine output (V2.1 item 1)", () => {
  /** Checking runs dry in month 1, cascading into the (unnamed) second account,
   *  which is taxable — so every name-carrying output is exercised at once. */
  const cascading = (secondName: string) =>
    scn({
      accounts: [
        acct({ type: "checking", balance: 1_000, priority: 1, id: "op", name: "Everyday" }),
        acct({ type: "pretax", balance: 50_000, priority: 2, id: "blank", name: secondName }),
      ],
      spend: 3_000,
    });

  it("labels a blank-named account with its type label everywhere", () => {
    const res = simulate(cascading(""));
    const label = "Pre-tax retirement (Traditional IRA / 401k)";

    // the chart series + legend read this
    expect(res.accountTimelines.find((t) => t.accountId === "blank")!.name).toBe(label);
    // the expanded-month ledger rows read this
    for (const month of res.months) {
      expect(month.accounts.find((a) => a.accountId === "blank")!.name).toBe(label);
    }
    // the transactions view + both CSVs read these
    const txs = res.transactions.filter((t) => t.accountId === "blank");
    expect(txs.length).toBeGreaterThan(0);
    for (const t of txs) expect(t.accountName).toBe(label);

    const taxes = res.scheduledTaxes.filter((t) => t.sourceAccountId === "blank");
    expect(taxes.length).toBeGreaterThan(0);
    for (const t of taxes) expect(t.sourceAccountName).toBe(label);
  });

  it("treats a whitespace-only name exactly like a blank one", () => {
    const blank = simulate(cascading(""));
    const spaces = simulate(cascading("   "));
    const nameIn = (res: typeof blank) =>
      res.accountTimelines.find((t) => t.accountId === "blank")!.name;
    expect(nameIn(spaces)).toBe(nameIn(blank));
  });

  it("renaming updates the series, the ledger rows and the transactions together", () => {
    const res = simulate(cascading("Vanguard 401k"));
    expect(res.accountTimelines.find((t) => t.accountId === "blank")!.name).toBe("Vanguard 401k");
    for (const month of res.months) {
      expect(month.accounts.find((a) => a.accountId === "blank")!.name).toBe("Vanguard 401k");
    }
    for (const t of res.transactions.filter((t) => t.accountId === "blank")) {
      expect(t.accountName).toBe("Vanguard 401k");
    }
    for (const t of res.scheduledTaxes.filter((t) => t.sourceAccountId === "blank")) {
      expect(t.sourceAccountName).toBe("Vanguard 401k");
    }
  });

  it("indexes two unnamed accounts of the same type rather than repeating a label", () => {
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1, id: "op", name: "Everyday" }),
          acct({ type: "brokerage", balance: 5_000, priority: 2, id: "b1", name: "" }),
          acct({ type: "brokerage", balance: 5_000, priority: 3, id: "b2", name: "" }),
        ],
        spend: 3_000,
      }),
    );
    const nameOf = (id: string) => res.accountTimelines.find((t) => t.accountId === id)!.name;
    expect(nameOf("b1")).toBe("Brokerage / investment");
    expect(nameOf("b2")).toBe("Brokerage / investment (2)");
  });

  it("keeps the legend distinct when a fallback would collide with a typed name", () => {
    // QA repro: a seeded account named "Savings" plus a blank second savings
    // account rendered "Savings · Savings" in the legend — the named account
    // and the fallback were indistinguishable.
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1, id: "op", name: "Checking" }),
          acct({ type: "savings", balance: 4_000, priority: 2, id: "named", name: "Savings" }),
          acct({ type: "savings", balance: 4_000, priority: 3, id: "blank", name: "" }),
        ],
        spend: 3_000,
      }),
    );
    const legend = res.accountTimelines.map((t) => t.name);
    expect(legend).toEqual(["Checking", "Savings", "Savings (2)"]);
    expect(new Set(legend).size).toBe(legend.length);
  });

  it("names a blank credit line in the interest transaction it writes", () => {
    // Credit interest posts to the OPERATING row, labelled with the line's name
    // — a separate code path from the per-account name, and one that used to
    // render "Interest — " with nothing after it.
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 100, priority: 1, id: "op", name: "Everyday" }),
          acct({
            type: "credit_line",
            balance: 50_000,
            priority: 2,
            id: "line",
            name: "  ",
            manualDraw: { date: "2026-01-15", amount: 10_000 },
          }),
        ],
      }),
    );
    const interest = res.transactions.filter((t) => t.category === "creditInterest");
    expect(interest.length).toBeGreaterThan(0);
    for (const t of interest) expect(t.label).toBe("Interest — Credit line / HELOC");
  });
});

// =============================================================================

describe("monthly net cash flow (V2.1 item 2)", () => {
  it("computes net = in − out in the ENGINE, once per month", () => {
    // Items 6 and 7 both read this rather than deriving their own, so the chart
    // tooltip and the ledger NET column cannot disagree.
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 100_000, priority: 1 })],
        housing: 2_000,
        spend: 3_000,
        levers: {
          incomeEvents: [
            { id: "i", label: "Severance", amount: 4_000, kind: "recurring", startDate: "2026-01-01" },
          ],
        },
      }),
    );
    for (const m of res.months) {
      expect(m.totals.net).toBeCloseTo(m.totals.inflow - m.totals.outflow, 9);
      expect(m.totals.net).toBeCloseTo(4_000 - 5_000, 9); // a $1,000/mo deficit
    }
  });

  it("is positive when income exceeds outflow, and exactly zero when they match", () => {
    const surplus = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 100_000, priority: 1 })],
        spend: 1_000,
        levers: {
          incomeEvents: [
            { id: "i", label: "Salary", amount: 3_000, kind: "recurring", startDate: "2026-01-01" },
          ],
        },
      }),
    );
    expect(surplus.months[0].totals.net).toBeCloseTo(2_000, 9);

    const flat = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 100_000, priority: 1 })],
        spend: 3_000,
        levers: {
          incomeEvents: [
            { id: "i", label: "Salary", amount: 3_000, kind: "recurring", startDate: "2026-01-01" },
          ],
        },
      }),
    );
    expect(flat.months[0].totals.net).toBe(0);
  });

  it("counts yield and taxes, and excludes inter-account transfers", () => {
    // A tap moves money between the user's own accounts — it is not cash flow.
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1 }),
          acct({ type: "hysa", balance: 50_000, priority: 2, id: "h", expectedReturn: 0.04 }),
        ],
        spend: 3_000,
      }),
    );
    const m = res.months[2]; // well past the first cascade
    const yieldIn = m.accounts.reduce((s, a) => s + (a.inflows.interestEarned ?? 0), 0);
    expect(yieldIn).toBeGreaterThan(0);
    expect(m.totals.net).toBeCloseTo(yieldIn - 3_000, 6);
    // …and the taps that funded it are nowhere in the figure.
    const taps = m.accounts.reduce((s, a) => s + (a.inflows.tapIn ?? 0), 0);
    expect(taps).toBeGreaterThan(0);
  });
});

describe("per-line estimate flag drives ≈ (V2.1 item 2)", () => {
  const withLines = (lines: Levers["expenseEvents"]) =>
    simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 500_000, priority: 1 })],
        // Non-zero, so the seeded lines actually post: a $0 line contributes
        // nothing and therefore carries no estimate flag either.
        housing: 1_500,
        spend: 2_000,
        levers: { expenseEvents: lines },
      }),
    ).months[0].accounts[0];

  it("marks living spend estimated by default, and housing not", () => {
    const m = withLines([]);
    expect(m.estimated.living).toBe(true);
    expect(m.estimated.housing).toBe(false); // entered input, not modeled
  });

  it("leaves a $0 line out entirely — no amount, no flag", () => {
    const m = simulate(
      scn({ accounts: [acct({ type: "checking", balance: 500_000, priority: 1 })], spend: 0 }),
    ).months[0].accounts[0];
    expect(m.outflows.living).toBeUndefined();
    expect(m.estimated.living).toBeUndefined();
  });

  it("marks a USER row as an estimate when its flag is set", () => {
    // The old category-keyed rule could never do this: "expense" was never ≈.
    const m = withLines([
      { id: "e1", label: "Groceries", amount: 800, kind: "recurring", startDate: "2026-01-01", isEstimate: true },
    ]);
    expect(m.estimated.expense).toBe(true);
  });

  it("does NOT mark a seeded line when its flag is turned off", () => {
    const m = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 500_000, priority: 1 })],
        spend: 2_000,
      }),
    );
    const on = m.months[0].accounts[0].estimated.living;
    expect(on).toBe(true);

    const off = simulate({
      ...scn({ accounts: [acct({ type: "checking", balance: 500_000, priority: 1 })], spend: 2_000 }),
      levers: {
        incomeEvents: [],
        expenseEvents: [{ ...seededLine("living", 2_000, "2026-01-01"), isEstimate: false }],
      },
    });
    expect(off.months[0].accounts[0].estimated.living).toBe(false);
  });

  it("drops the marker when a category mixes modeled and entered lines", () => {
    // "≈ Expense" has to mean ALL of it, or it is a lie.
    const m = withLines([
      { id: "e1", label: "Groceries", amount: 800, kind: "recurring", startDate: "2026-01-01", isEstimate: true },
      { id: "e2", label: "Car payment", amount: 400, kind: "recurring", startDate: "2026-01-01" },
    ]);
    expect(m.estimated.expense).toBe(false);
  });

  it("keeps the engine-computed categories estimated by nature", () => {
    const res = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1 }),
          acct({ type: "hysa", balance: 50_000, priority: 2, id: "h", expectedReturn: 0.04 }),
        ],
        spend: 3_000,
      }),
    );
    const hysa = res.months[1].accounts.find((a) => a.accountId === "h")!;
    expect(hysa.estimated.interestEarned).toBe(true);
    // transfers never are
    expect(hysa.estimated.tapOut).toBe(false);
  });

  it("puts the same flag on the transactions the Transactions view renders", () => {
    const res = simulate(
      scn({
        accounts: [acct({ type: "checking", balance: 500_000, priority: 1 })],
        housing: 1_500,
        spend: 2_000,
      }),
    );
    const first = (cat: string) => res.transactions.find((t) => t.category === cat)!;
    expect(first("living").isEstimate).toBe(true);
    expect(first("housing").isEstimate).toBeUndefined(); // entered, not modeled
  });
});

// =============================================================================

describe("expected return (V2.1 item 3)", () => {
  const withReturn = (type: AccountType, rate: number, balance = 10_000) =>
    simulate(
      scn({
        start: "2026-01-01",
        end: "2026-03-31",
        accounts: [acct({ type, balance, priority: 1, id: "a", expectedReturn: rate })],
      }),
    );

  it("matches the old HYSA mechanic exactly: opening balance, monthly, as an inflow", () => {
    const res = withReturn("hysa", 0.04);
    const jan = res.months[0].accounts[0];
    // Same arithmetic the hardcoded yield used — no second convention.
    expect(jan.inflows.interestEarned).toBeCloseTo(10_000 * (0.04 / 12), 9);
    expect(jan.outflows.interestEarned).toBeUndefined();
  });

  it("computes on the OPENING balance, before any withdrawal that month", () => {
    // Spend drains the account in the same month; the return must still be
    // based on what was there at the start, not on the reduced balance.
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-01-31",
        accounts: [acct({ type: "hysa", balance: 10_000, priority: 1, expectedReturn: 0.12 })],
        spend: 4_000,
      }),
    );
    const jan = res.months[0].accounts[0];
    expect(jan.inflows.interestEarned).toBeCloseTo(10_000 * 0.01, 9); // NOT 6,000 * 0.01
  });

  it("posts investment and retirement returns under `growth`, not `interestEarned`", () => {
    // Calling capital appreciation "Interest" is factually wrong.
    for (const type of ["brokerage", "roth", "pretax", "other"] as AccountType[]) {
      const m = withReturn(type, 0.06).months[0].accounts[0];
      expect(m.inflows.growth).toBeCloseTo(10_000 * 0.005, 9);
      expect(m.inflows.interestEarned).toBeUndefined();
    }
    // …while cash savings still EARN interest.
    for (const type of ["hysa", "savings", "checking"] as AccountType[]) {
      const m = withReturn(type, 0.06).months[0].accounts[0];
      expect(m.inflows.interestEarned).toBeCloseTo(10_000 * 0.005, 9);
      expect(m.inflows.growth).toBeUndefined();
    }
  });

  it("applies NO return at 0%, and none at all to a credit line", () => {
    expect(withReturn("brokerage", 0).months[0].accounts[0].inflows.growth).toBeUndefined();
    const credit = simulate(
      scn({
        accounts: [
          acct({ type: "checking", balance: 5_000, priority: 1 }),
          acct({ type: "credit_line", balance: 50_000, priority: 2, id: "c", expectedReturn: 0.06 }),
        ],
      }),
    );
    for (const m of credit.months) {
      const line = m.accounts.find((a) => a.accountId === "c")!;
      expect(line.inflows.growth).toBeUndefined();
      expect(line.inflows.interestEarned).toBeUndefined();
    }
  });

  it("SHRINKS the balance on a negative rate, posting it as an outflow", () => {
    // §2 allows −20%. Silently ignoring a legal negative rate would be the
    // worst outcome: the field accepts it and the model pretends otherwise.
    const res = withReturn("brokerage", -0.12);
    const jan = res.months[0].accounts[0];
    expect(jan.outflows.growth).toBeCloseTo(10_000 * 0.01, 9);
    expect(jan.inflows.growth).toBeUndefined();
    expect(res.accountTimelines[0].balances[0]).toBeLessThan(10_000);
    // …and it compounds downward.
    expect(res.accountTimelines[0].balances[2]).toBeLessThan(
      res.accountTimelines[0].balances[0],
    );
  });

  it("never drives an asset balance below zero, however negative the rate", () => {
    // The loss is capped at the balance. Validation keeps a typed rate inside
    // −20%…40%, but a hand-crafted `?s=` payload is not bound by the field, and
    // a rate steeper than −1200%/yr would otherwise push an ASSET negative —
    // which the ledger would then read as debt.
    //
    // Deliberately no spending and a separate operating account: an operating
    // balance CAN go negative from an uncovered shortfall (that is how
    // cash-zero is detected), and this test is about the return alone.
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-06-30",
        accounts: [
          acct({ type: "checking", balance: 100_000, priority: 1 }),
          acct({ type: "brokerage", balance: 1_000, priority: 2, id: "b", expectedReturn: -24 }),
        ],
      }),
    );
    const balances = res.accountTimelines.find((t) => t.accountId === "b")!.balances;
    for (const b of balances) expect(b).toBeGreaterThanOrEqual(0);
    expect(balances[0]).toBe(0); // wiped out in month one, but not past zero
  });

  it("decays a realistic negative rate geometrically without going negative", () => {
    const res = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-12-31",
        accounts: [
          acct({ type: "checking", balance: 100_000, priority: 1 }),
          acct({ type: "brokerage", balance: 10_000, priority: 2, id: "b", expectedReturn: -0.2 }),
        ],
      }),
    );
    const balances = res.accountTimelines.find((t) => t.accountId === "b")!.balances;
    expect(balances[0]).toBeCloseTo(10_000 * (1 - 0.2 / 12), 6);
    expect(balances[11]).toBeLessThan(balances[0]);
    for (const b of balances) expect(b).toBeGreaterThan(0);
  });

  it("counts the return in the month's net cash flow", () => {
    const res = withReturn("hysa", 0.12);
    expect(res.months[0].totals.net).toBeCloseTo(10_000 * 0.01, 9);
  });
});

describe("penalty-free date (V2.1 item 4)", () => {
  /** A pre-tax account tapped by a manual draw in `drawMonth`. */
  const drawIn = (drawDate: string, penaltyFreeMonth?: string) =>
    simulate(
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
            penaltyFreeMonth,
            manualDraw: { date: drawDate, amount: 10_000 },
          }),
        ],
      }),
    ).scheduledTaxes[0];

  const TAX = 10_000 * 0.22;
  const PENALTY = 10_000 * 0.1;

  it("blank — the penalty applies to every withdrawal", () => {
    const t = drawIn("2026-06-15");
    expect(t.penalty).toBeCloseTo(PENALTY, 9);
    expect(t.tax).toBeCloseTo(TAX, 9);
  });

  it("past month — the penalty never applies", () => {
    const t = drawIn("2026-06-15", "2025-03");
    expect(t.penalty).toBe(0);
    expect(t.tax).toBeCloseTo(TAX, 9); // ordinary income is UNCHANGED
  });

  it("future month — penalized before, waived from that month forward", () => {
    expect(drawIn("2026-06-15", "2026-09").penalty).toBeCloseTo(PENALTY, 9);
    expect(drawIn("2026-10-15", "2026-09").penalty).toBe(0);
  });

  it("a withdrawal in the EXACT crossing month is waived", () => {
    // The boundary is inclusive: "waives from that month forward" includes it.
    const t = drawIn("2026-09-15", "2026-09");
    expect(t.penalty).toBe(0);
    expect(t.tax).toBeCloseTo(TAX, 9);
  });

  it("a withdrawal the month BEFORE the crossing is still penalized", () => {
    expect(drawIn("2026-08-31", "2026-09").penalty).toBeCloseTo(PENALTY, 9);
  });

  it("a month set after the horizon end never waives anything", () => {
    expect(drawIn("2027-06-15", "2030-01").penalty).toBeCloseTo(PENALTY, 9);
  });

  it("decides on the WITHDRAWAL month, never on the due date", () => {
    // A Feb 2027 pre-tax withdrawal is paid the following April 2028. Crossing
    // 59½ in March 2027 must NOT retroactively waive it — the penalty attaches
    // to when the money was taken.
    const t = drawIn("2027-02-15", "2027-03");
    expect(t.dueDate).toBe("2028-04-15");
    expect(t.penalty).toBeCloseTo(PENALTY, 9);
  });

  it("applies the waiver to waterfall withdrawals too, not just manual draws", () => {
    // Both paths funnel through the same choke point; this proves it.
    const res = (penaltyFreeMonth?: string) =>
      simulate(
        scn({
          start: "2026-01-01",
          end: "2026-12-31",
          accounts: [
            acct({ type: "checking", balance: 1_000, priority: 1 }),
            acct({ type: "pretax", balance: 100_000, priority: 2, id: "ira", penaltyFreeMonth }),
          ],
          spend: 4_000,
        }),
      ).scheduledTaxes;
    const penalized = res().reduce((s, t) => s + t.penalty, 0);
    const waived = res("2025-01").reduce((s, t) => s + t.penalty, 0);
    expect(penalized).toBeGreaterThan(0);
    expect(waived).toBe(0);
  });

  it("spans a mid-projection crossing: penalized before, waived after", () => {
    // The case a checkbox cannot express, and the one producing wrong numbers.
    const taxes = simulate(
      scn({
        start: "2026-01-01",
        end: "2026-12-31",
        accounts: [
          acct({ type: "checking", balance: 1_000, priority: 1 }),
          acct({
            type: "pretax",
            balance: 200_000,
            priority: 2,
            id: "ira",
            penaltyFreeMonth: "2026-07",
          }),
        ],
        spend: 5_000,
      }),
    ).scheduledTaxes;
    const before = taxes.filter((t) => t.withdrawalDate < "2026-07-01");
    const after = taxes.filter((t) => t.withdrawalDate >= "2026-07-01");
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(before.every((t) => t.penalty > 0)).toBe(true);
    expect(after.every((t) => t.penalty === 0)).toBe(true);
    // Ordinary income tax is charged throughout, in both halves.
    expect(taxes.every((t) => t.tax > 0)).toBe(true);
  });

  it("falls back to blank on an unparseable month, never to waived", () => {
    for (const bad of ["", "not-a-month", "2026-13", "20xx-01"]) {
      expect(drawIn("2026-06-15", bad).penalty).toBeCloseTo(PENALTY, 9);
    }
  });
});

// =============================================================================

describe("account exclusion (V2.1 item 5)", () => {
  const scenario = (overrides?: Partial<Account>[]) =>
    scn({
      start: "2026-01-01",
      end: "2026-12-31",
      accounts: [
        acct({ type: "checking", balance: 4_000, priority: 1, id: "check" }),
        acct({ type: "hysa", balance: 6_000, priority: 2, id: "hysa", expectedReturn: 0.04 }),
        acct({
          type: "brokerage",
          balance: 20_000,
          priority: 3,
          id: "brok",
          expectedReturn: 0.06,
          ...(overrides?.[0] ?? {}),
        }),
      ],
      spend: 3_000,
    });

  const withExcluded = (id: string, excluded: boolean) => {
    const base = scenario();
    return {
      ...base,
      accounts: base.accounts.map((a) => (a.id === id ? { ...a, excluded } : a)),
    };
  };

  // ---- THE FREEZE TEST — the highest-consequence assertion in the item -----

  it("re-including restores the PRIOR RESULT EXACTLY, not just the runway", () => {
    // Deep-equal on the whole SimulationResult: every ledger row, every
    // transaction, every scheduled tax. The freeze is not a snapshot that gets
    // restored — it is the absence of any mutation, so this holds by
    // construction. If it ever fails, exclusion has started writing to stored
    // state and re-inclusion is reconstructing rather than reproducing.
    const before = simulate(scenario());
    const excluded = simulate(withExcluded("brok", true));
    const after = simulate(withExcluded("brok", false));

    expect(after).toEqual(before);
    // …and the round trip is only meaningful if exclusion actually did
    // something in between. Without this, a no-op implementation passes.
    expect(excluded.runway.months).toBeLessThan(before.runway.months);
  });

  it("does not mutate the scenario it was handed", () => {
    // The other half of why re-inclusion is exact.
    const s = withExcluded("brok", true);
    const snapshot = structuredClone(s);
    simulate(s);
    expect(s).toEqual(snapshot);
  });

  // ---- what exclusion actually does ---------------------------------------

  it("shortens the runway by the excluded balance", () => {
    const before = simulate(scenario()).runway;
    const after = simulate(withExcluded("brok", true)).runway;
    expect(after.months).toBeLessThan(before.months);
    expect(after.cashZeroDate).not.toBe(before.cashZeroDate);
  });

  it("FREEZES the balance — an excluded account with a return does not grow", () => {
    // The interaction the design package flagged: silent growth on money the
    // user has set aside is a correctness bug waiting to happen.
    const res = simulate(withExcluded("brok", true));
    const balances = res.accountTimelines.find((t) => t.accountId === "brok")!.balances;
    expect(new Set(balances)).toEqual(new Set([20_000])); // flat, every month
    expect(sumCategory(res, "growth")).toBe(0);
  });

  it("keeps the excluded series in the timelines, flagged, so the legend can name it", () => {
    const res = simulate(withExcluded("brok", true));
    const t = res.accountTimelines.find((tl) => tl.accountId === "brok")!;
    expect(t).toBeDefined();
    expect(t.excluded).toBe(true);
    expect(t.name).toBe("brokerage");
    // …and the included ones are not flagged.
    expect(res.accountTimelines.find((tl) => tl.accountId === "check")!.excluded).toBe(false);
  });

  it("omits the excluded balance from net liquid and total assets", () => {
    const res = simulate(withExcluded("brok", true));
    for (const p of res.projection) {
      expect(p.totalAssets).toBeLessThanOrEqual(10_000 + 1); // 4k + 6k + yield, never +20k
    }
  });

  it("omits it from the monthly ledger totals while KEEPING its row", () => {
    const res = simulate(withExcluded("brok", true));
    const first = res.months[0];
    const row = first.accounts.find((a) => a.accountId === "brok")!;
    expect(row).toBeDefined();
    expect(row.excluded).toBe(true);
    // Nothing happened to it: no inflows, no outflows.
    expect(row.inflows).toEqual({});
    expect(row.outflows).toEqual({});
    // …and it is not in the totals.
    expect(first.totals.opening).toBeCloseTo(10_000, 6);
  });

  it("never taps an excluded account, however deep the shortfall", () => {
    const res = simulate(withExcluded("brok", true));
    const tapped = res.transactions.filter((t) => t.accountId === "brok");
    expect(tapped).toHaveLength(0);
    expect(res.scheduledTaxes.filter((t) => t.sourceAccountId === "brok")).toHaveLength(0);
  });

  it("ignores the flag on a liability — exclusion must never flatter the runway", () => {
    const base = scn({
      start: "2026-01-01",
      end: "2026-06-30",
      accounts: [
        acct({ type: "checking", balance: 500, priority: 1 }),
        acct({
          type: "credit_line",
          balance: 50_000,
          priority: 2,
          id: "heloc",
          manualDraw: { date: "2026-01-15", amount: 10_000 },
        }),
      ],
      spend: 1_000,
    });
    const flagged = {
      ...base,
      accounts: base.accounts.map((a) => (a.id === "heloc" ? { ...a, excluded: true } : a)),
    };
    // Identical: the flag does nothing on a liability, so the carrying cost on
    // the drawn balance is still charged.
    expect(simulate(flagged)).toEqual(simulate(base));
    expect(sumCategory(simulate(flagged), "creditInterest")).toBeGreaterThan(0);
  });

  it("moves the operating account on when the first asset is excluded", () => {
    const res = simulate(withExcluded("check", true));
    // Living costs now flow through the HYSA, and checking stays untouched.
    expect(res.accountTimelines.find((t) => t.accountId === "check")!.balances[0]).toBe(4_000);
    const hysaOut = res.months[0].accounts.find((a) => a.accountId === "hysa")!;
    expect(sumAmounts(hysaOut.outflows)).toBeGreaterThan(0);
  });
});

describe("no account to operate from (V2.1 item 5 — P1)", () => {
  const bare = (accounts: Account[]) =>
    scn({ start: "2026-01-01", end: "2026-06-30", accounts, spend: 1_000 });

  it("does not throw when every account has been DELETED", () => {
    // Reachable in production today: `deleteAccount` has no floor, so removing
    // the last account crashed the app on the spot.
    expect(() => simulate(bare([]))).not.toThrow();
  });

  it("does not throw when every account is EXCLUDED", () => {
    expect(() =>
      simulate(
        bare([
          acct({ type: "checking", balance: 3_000, priority: 1, excluded: true }),
          acct({ type: "savings", balance: 4_000, priority: 2, excluded: true }),
        ]),
      ),
    ).not.toThrow();
  });

  it("does not throw when only a credit line remains", () => {
    expect(() =>
      simulate(bare([acct({ type: "credit_line", balance: 50_000, priority: 1 })])),
    ).not.toThrow();
  });

  it("returns a well-formed zero runway rather than a broken result", () => {
    const res = simulate(bare([]));
    expect(res.runway.months).toBe(0);
    expect(res.runway.weeks).toBe(0);
    expect(res.runway.survivesHorizon).toBe(false);
    expect(res.runway.cashZeroDate).toBe("2026-01-01");
    // The shape is intact, so every consumer still renders.
    expect(res.months).toHaveLength(6);
    expect(res.projection).toHaveLength(6);
    expect(res.months[0].totals).toEqual({
      opening: 0, inflow: 0, outflow: 0, net: 0, oneTimeInflow: 0, closing: 0,
    });
  });

  it("still names every held account, so the legend and ledger are not blank", () => {
    const res = simulate(
      bare([
        acct({ type: "checking", balance: 3_000, priority: 1, id: "c", excluded: true }),
        acct({ type: "savings", balance: 4_000, priority: 2, id: "s", excluded: true }),
      ]),
    );
    expect(res.accountTimelines.map((t) => t.accountId)).toEqual(["c", "s"]);
    expect(res.accountTimelines.every((t) => t.excluded)).toBe(true);
    // Balances stay at what is held — "$3,000 held, not counted".
    expect(res.accountTimelines[0].balances[0]).toBe(3_000);
    expect(res.months[0].accounts.map((a) => a.excluded)).toEqual([true, true]);
  });
});
