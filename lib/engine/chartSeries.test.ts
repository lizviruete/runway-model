import { describe, expect, it } from "vitest";
import { drawsBand, seriesFill, seriesIndex, seriesStroke, SERIES_SLOTS } from "./chartSeries";
import { defaultExpectedReturn, defaultOngoingCost, defaultTaxTreatment } from "./defaults";
import type { Account, AccountType } from "./types";

function acct(id: string, type: AccountType, extra?: Partial<Account>): Account {
  return {
    id,
    name: id,
    type,
    balance: 1_000,
    depletionPriority: 1,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: defaultExpectedReturn(type),
    ...extra,
  };
}
const slots = (a: Account[]) => [...seriesIndex(a).values()];

describe("seriesIndex — liabilities are out of the rotation", () => {
  it("numbers assets 0..n in tap order", () => {
    expect(slots([acct("a", "checking"), acct("b", "savings"), acct("c", "brokerage")])).toEqual([
      0, 1, 2,
    ]);
  });

  it("gives a credit line null and does NOT let it consume a slot", () => {
    // The off-by-one: a HELOC at tap 1 must not push the first asset to slot 1,
    // which would put two adjacent bands in the same colour.
    expect(slots([acct("heloc", "credit_line"), acct("a", "checking"), acct("b", "savings")]))
      .toEqual([null, 0, 1]);
  });

  it("handles a liability at tap position 1 — reachable once every asset is excluded", () => {
    const accounts = [
      acct("a", "checking", { excluded: true }),
      acct("heloc", "credit_line"),
      acct("b", "savings"),
    ];
    // The excluded asset still holds slot 0; the HELOC still takes none.
    expect(slots(accounts)).toEqual([0, null, 1]);
  });

  it("keeps a liability out of rotation wherever it sits", () => {
    expect(slots([acct("a", "checking"), acct("heloc", "credit_line"), acct("b", "savings")]))
      .toEqual([0, null, 1]);
  });
});

describe("seriesIndex — an excluded asset KEEPS its slot", () => {
  it("does not repaint the survivors when one is excluded", () => {
    // "Colour follows the entity, never its rank" — a filter that changes the
    // series count must not recolour what remains.
    const included = [acct("a", "checking"), acct("b", "savings"), acct("c", "brokerage")];
    const withExcluded = [
      acct("a", "checking"),
      acct("b", "savings", { excluded: true }),
      acct("c", "brokerage"),
    ];
    expect(seriesIndex(withExcluded).get("a")).toBe(seriesIndex(included).get("a"));
    expect(seriesIndex(withExcluded).get("c")).toBe(seriesIndex(included).get("c"));
    // …and the excluded one keeps its own slot rather than losing it.
    expect(seriesIndex(withExcluded).get("b")).toBe(1);
  });

  it("means excluding a middle account puts NON-CONSECUTIVE slots adjacent", () => {
    // The consequence ruling (u) records: slots 1 and 3 end up side by side.
    // Colour cannot separate them, so the gap and the legend number must.
    const accounts = [
      acct("a", "checking"),
      acct("b", "savings"),
      acct("c", "brokerage", { excluded: true }),
      acct("d", "roth"),
    ];
    const drawing = accounts.filter(drawsBand).map((x) => seriesIndex(accounts).get(x.id));
    expect(drawing).toEqual([0, 1, 3]); // slot 2 is held out, 1 and 3 now touch
  });
});

describe("seriesIndex — rotation length", () => {
  it("repeats from slot 0 past eight assets", () => {
    const many = Array.from({ length: 10 }, (_, i) => acct(`a${i}`, "brokerage"));
    expect(slots(many)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
  });

  it("defines exactly eight slots", () => {
    expect(SERIES_SLOTS).toBe(8);
  });
});

describe("fills and strokes", () => {
  it("maps slots to the ten tokens and nothing else", () => {
    expect(seriesFill(0)).toBe("var(--chart-series-1)");
    expect(seriesFill(7)).toBe("var(--chart-series-8)");
    expect(seriesFill(null)).toBe("var(--chart-liability)");
  });

  it("gives every LIGHT slot a stroke and every dark slot none", () => {
    // Light fills are slots 1,3,5,7 (taps 2,4,6,8). The stroke stops a thin
    // band vanishing against white — a different job from the surface gap.
    for (const light of [1, 3, 5, 7]) expect(seriesStroke(light)).toBeTruthy();
    for (const dark of [0, 2, 4, 6]) expect(seriesStroke(dark)).toBeNull();
    expect(seriesStroke(null)).toBeNull();
  });
});

describe("drawsBand", () => {
  it("is true only for an included asset", () => {
    expect(drawsBand(acct("a", "brokerage"))).toBe(true);
    expect(drawsBand(acct("a", "brokerage", { excluded: true }))).toBe(false);
    expect(drawsBand(acct("a", "credit_line"))).toBe(false);
    // A liability's exclude flag is ignored either way — it still draws no band.
    expect(drawsBand(acct("a", "credit_line", { excluded: true }))).toBe(false);
  });
});
