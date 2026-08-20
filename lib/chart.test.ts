import { describe, expect, it } from "vitest";
import {
  assetStackTotalAt,
  assetTimelines,
  chartMax,
  DEFAULT_CHART_MODE,
  legendTimelines,
  niceMax,
} from "./chart";
import { defaultOngoingCost, defaultTaxTreatment } from "./engine/defaults";
import { seededLine } from "./engine/expenses";
import { simulate } from "./engine/simulate";
import { SCENARIO_VERSION } from "./migrate";
import { createSampleScenario } from "./sample";
import type { Account, AccountType, Scenario } from "./engine/types";

function acct(type: AccountType, balance: number, priority: number, extra?: Partial<Account>): Account {
  return {
    id: extra?.id ?? `${type}-${priority}`,
    name: extra?.name ?? type,
    type,
    balance,
    depletionPriority: priority,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: 0,
    ...extra,
  };
}

function scenario(accounts: Account[], start: string, end: string): Scenario {
  return {
    id: "t",
    name: "t",
    version: SCENARIO_VERSION,
    createdDate: start,
    timeline: { start, end },
    accounts,
    levers: {
      incomeEvents: [],
      expenseEvents: [seededLine("housing", 0, start), seededLine("living", 0, start)],
    },
  };
}

describe("chart geometry", () => {
  it("defaults to the clean Total view", () => {
    expect(DEFAULT_CHART_MODE).toBe("total");
  });

  it("excludes credit lines from the asset stack", () => {
    // Built locally rather than read off the example scenario. Item 8 removed
    // the HELOC from the demo, and this test is about `assetTimelines`, not
    // about what the demo happens to ship — a fixture that can be edited out
    // from under an assertion was never the right fixture.
    const tls = simulate(
      scenario(
        [acct("checking", 5_000, 1), acct("credit_line", 2_000, 2)],
        "2026-07-01",
        "2026-12-31",
      ),
    ).accountTimelines;
    const assets = assetTimelines(tls);
    expect(tls.some((t) => t.type === "credit_line")).toBe(true);
    expect(assets.some((t) => t.type === "credit_line")).toBe(false);
    expect(assets).toHaveLength(tls.length - 1);
  });

  it("rounds the axis up to a clean bound", () => {
    expect(niceMax(0)).toBe(1000);
    expect(niceMax(2_300)).toBe(2_500);
    expect(niceMax(22_000)).toBe(25_000);
  });

  it("scales to cover the stack, net-liquid line, and baseline overlay", () => {
    const res = simulate(createSampleScenario());
    const assets = assetTimelines(res.accountTimelines);
    const peakStack = Math.max(...res.projection.map((_, i) => assetStackTotalAt(assets, i)));
    const peakNet = Math.max(...res.projection.map((p) => Math.max(0, p.netLiquid)));
    const max = chartMax(res.projection, res.projection, assets, true);
    expect(max).toBeGreaterThanOrEqual(peakStack);
    expect(max).toBeGreaterThanOrEqual(peakNet);
  });
});

describe("net-liquid line vs. the asset stack", () => {
  it("net liquid never rises above the (clamped) asset stack, and diverges below it", () => {
    const res = simulate(createSampleScenario());
    const assets = assetTimelines(res.accountTimelines);
    let diverged = false;
    res.projection.forEach((p, i) => {
      const stack = assetStackTotalAt(assets, i);
      expect(p.netLiquid).toBeLessThanOrEqual(stack + 1e-6); // line is authoritative, never above
      if (p.netLiquid < stack - 1e-6) diverged = true;
    });
    expect(diverged).toBe(true); // the drawn HELOC / negative operating pulls it below
  });

  it("a credit draw makes the net-liquid line dip below the stack while assets remain", () => {
    // Checking stays funded; a manual HELOC draw lifts cash but adds debt, so
    // net liquid (assets − drawn) sits below the asset stack (= checking).
    const res = simulate(
      scenario(
        [
          acct("checking", 10_000, 1, { id: "chk" }),
          acct("credit_line", 50_000, 2, { id: "heloc", manualDraw: { date: "2026-03-15", amount: 5_000 } }),
        ],
        "2026-01-01",
        "2026-12-31",
      ),
    );
    const assets = assetTimelines(res.accountTimelines);
    const march = res.projection.findIndex((p) => p.monthKey === "2026-03");
    const stack = assetStackTotalAt(assets, march); // checking = 15,000 after the draw
    expect(stack).toBe(15_000);
    expect(res.projection[march].netLiquid).toBe(10_000); // 15,000 − 5,000 drawn
    expect(res.projection[march].netLiquid).toBeLessThan(stack);
  });
});

describe("excluded series: named but never drawn (V2.1 item 5)", () => {
  const timelines = () =>
    simulate(
      scenario(
        [
          acct("checking", 3_000, 1, { id: "check" }),
          acct("brokerage", 200_000, 2, { id: "brok", excluded: true }),
        ],
        "2026-01-01",
        "2026-06-30",
      ),
    ).accountTimelines;

  it("assetTimelines DROPS excluded series — they draw no band", () => {
    expect(assetTimelines(timelines()).map((t) => t.accountId)).toEqual(["check"]);
  });

  it("legendTimelines KEEPS them, in tap-order position", () => {
    // Keeping them listed is what tells a returning user why a band is missing.
    expect(legendTimelines(timelines()).map((t) => t.accountId)).toEqual(["check", "brok"]);
  });

  it("chartMax ignores an excluded balance, so the axis is not squashed", () => {
    // The excluded account holds $200k at FULL value — its balances are frozen,
    // not zeroed. Left in the scale, the real $3k stack would be flattened into
    // the floor by money that draws nothing.
    const all = timelines();
    const drawn = assetTimelines(all);
    const projection = simulate(
      scenario(
        [
          acct("checking", 3_000, 1, { id: "check" }),
          acct("brokerage", 200_000, 2, { id: "brok", excluded: true }),
        ],
        "2026-01-01",
        "2026-06-30",
      ),
    ).projection;

    expect(chartMax(projection, null, drawn, false)).toBeLessThanOrEqual(5_000);
    // …and the guard: passing the UNFILTERED list would scale to the held money.
    expect(chartMax(projection, null, all, false)).toBeGreaterThanOrEqual(200_000);
  });

  it("the excluded series is frozen at its held balance, not zeroed", () => {
    const brok = timelines().find((t) => t.accountId === "brok")!;
    expect(brok.excluded).toBe(true);
    expect(new Set(brok.balances)).toEqual(new Set([200_000]));
  });
});
