import { describe, expect, it } from "vitest";
import {
  bandCenter,
  cashZeroGapX,
  COLUMN,
  columnWidth,
  drawingSeries,
  firstDepletedIndex,
  niceMax,
  stackAt,
  stackTotalAt,
} from "./chartGeometry";
import type { AccountTimeline } from "./engine/types";

const tl = (o: Partial<AccountTimeline> & { accountId: string; balances: number[] }): AccountTimeline => ({
  name: o.accountId,
  type: "brokerage",
  excluded: false,
  ...o,
});

describe("column geometry (§5)", () => {
  it("caps a column at 52px however wide the plot", () => {
    expect(columnWidth(2000, 3)).toBe(COLUMN.maxWidth);
  });

  it("floors a column at 8px however many months", () => {
    expect(columnWidth(300, 120)).toBe(COLUMN.minWidth);
  });

  it("uses 0.62 of the band between those bounds", () => {
    expect(columnWidth(600, 12)).toBeCloseTo((600 / 12) * 0.62, 6);
  });

  it("centres each column in its band", () => {
    expect(bandCenter(600, 12, 0)).toBeCloseTo(25, 6);
    expect(bandCenter(600, 12, 11)).toBeCloseTo(575, 6);
  });
});

describe("stacking — tap 1 at the TOP", () => {
  const series = [
    { accountId: "a", slot: 0, balances: [100] },
    { accountId: "b", slot: 1, balances: [200] },
    { accountId: "c", slot: 2, balances: [300] },
  ];

  it("builds bottom-up from the LAST-tapped account", () => {
    // Reversed so tap 1 lands on top, matching the previous area chart's order.
    expect(stackAt(series, 0).map((s) => s.accountId)).toEqual(["c", "b", "a"]);
  });

  it("stacks contiguously with no gaps in the values", () => {
    const segs = stackAt(series, 0);
    expect(segs.map((s) => [s.from, s.to])).toEqual([[0, 300], [300, 500], [500, 600]]);
  });

  it("keeps a zero-balance series as a zero-height segment, not a hole", () => {
    // A drained-but-included account still occupies a row in the stack model;
    // the caller skips painting it. Dropping it here would lose its identity.
    const segs = stackAt([{ accountId: "empty", slot: 3, balances: [0] }, ...series], 0);
    const drained = segs.find((s) => s.accountId === "empty")!;
    expect(drained.to - drained.from).toBe(0);
    expect(segs).toHaveLength(4);
    // …and the others still stack contiguously around it.
    expect(segs.at(-1)!.to).toBe(600);
  });

  it("totals the stack — the money still held at month end", () => {
    expect(stackTotalAt(series, 0)).toBe(600);
  });
});

describe("edge state 1 — the cash-zero marker sits in the GAP before the first $0 column", () => {
  const series = [{ balances: [500, 200, 0, 0] }];

  it("lands on the band boundary, never through a column", () => {
    // 4 months across 400px → bands of 100. First zero is index 2, so the gap
    // before it is at x=200 — a boundary between months, not an annotation on one.
    expect(cashZeroGapX(series, 4, 400)).toBe(200);
  });

  it("is null when nothing depletes in the window", () => {
    expect(cashZeroGapX([{ balances: [5, 5, 5] }], 3, 300)).toBeNull();
  });
});

describe("edge state 2 — flat tail after depletion", () => {
  it("finds the FIRST depleted month so the caption appears once", () => {
    expect(firstDepletedIndex([{ balances: [10, 5, 0, 0, 0] }], 5)).toBe(2);
  });

  it("returns null when the stack never empties", () => {
    expect(firstDepletedIndex([{ balances: [10, 5, 1] }], 3)).toBeNull();
  });

  it("treats a negative balance as depleted", () => {
    expect(firstDepletedIndex([{ balances: [10, -5] }], 2)).toBe(1);
  });
});

describe("edge state 3 — excluded series draw nothing and do not scale the axis", () => {
  const slotOf = (id: string) => ({ a: 0, b: 1 })[id] ?? null;

  it("filters excluded BEFORE the axis maximum is computed", () => {
    const timelines = [
      tl({ accountId: "a", balances: [3_000] }),
      tl({ accountId: "b", balances: [200_000], excluded: true }),
    ];
    const drawing = drawingSeries(timelines, slotOf);
    expect(drawing.map((d) => d.accountId)).toEqual(["a"]);
    // Held at full value, so leaving it in would scale the axis to $200k.
    expect(niceMax(stackTotalAt(drawing, 0))).toBeLessThanOrEqual(5_000);
  });

  it("filters credit lines too — debt is never part of the stack", () => {
    const timelines = [
      tl({ accountId: "a", balances: [3_000] }),
      tl({ accountId: "h", type: "credit_line", balances: [50_000] }),
    ];
    expect(drawingSeries(timelines, slotOf).map((d) => d.accountId)).toEqual(["a"]);
  });
});

describe("edge state 4 — a single account", () => {
  it("still caps the column at 52px so it is not a monolith", () => {
    expect(columnWidth(1200, 1)).toBe(COLUMN.maxWidth);
  });

  it("stacks as one segment", () => {
    expect(stackAt([{ accountId: "a", slot: 0, balances: [900] }], 0)).toHaveLength(1);
  });
});

describe("edge states 6 & 7 — all excluded, and no accounts", () => {
  it("all excluded leaves nothing drawing", () => {
    const timelines = [
      tl({ accountId: "a", balances: [3_000], excluded: true }),
      tl({ accountId: "b", balances: [4_000], excluded: true }),
    ];
    expect(drawingSeries(timelines, () => 0)).toHaveLength(0);
  });

  it("no accounts at all leaves nothing drawing, and does not throw", () => {
    expect(drawingSeries([], () => 0)).toHaveLength(0);
    expect(firstDepletedIndex([], 6)).toBe(0); // an empty stack is depleted from month one
    expect(() => cashZeroGapX([], 6, 600)).not.toThrow();
  });
});

describe("niceMax", () => {
  it("rounds up to a clean bound", () => {
    expect(niceMax(0)).toBe(1000);
    expect(niceMax(900)).toBe(1000);
    expect(niceMax(12_000)).toBe(20_000);
    expect(niceMax(21_000)).toBe(25_000);
  });
});
