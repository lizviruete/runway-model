import { describe, expect, it } from "vitest";
import {
  cashFlowDelta,
  cashFlowSummary,
  incomeResumesMonths,
  netCaret,
  netCellLabel,
  netCellText,
} from "./cashFlowSummary";
import type { MonthLedger, Scenario } from "./engine/types";
import { seededLine } from "./engine/expenses";
import { SCENARIO_VERSION } from "./migrate";

/** Months carrying only what the summary reads: the key, the date and the net. */
const M = (monthKey: string, net: number): MonthLedger => ({
  monthKey,
  date: `${monthKey}-01`,
  accounts: [],
  totals: { opening: 0, inflow: 0, outflow: 0, net, closing: 0 },
});

const series = (start: number, nets: number[]) =>
  nets.map((n, i) => {
    const month = ((start + i - 1) % 12) + 1;
    const year = 2026 + Math.floor((start + i - 1) / 12);
    return M(`${year}-${String(month).padStart(2, "0")}`, n);
  });

describe("§6's six copy states, verbatim", () => {
  it("1 · turns positive in horizon", () => {
    const s = cashFlowSummary(series(10, [-7_900, -7_900, -7_900, -7_900, -7_900, 1_200]))!;
    expect(s.text).toBe("Burning about $7,900/mo · turns positive Mar 2027");
    expect(s.turnaroundChip).toBe("TURNS POSITIVE");
    expect(s.turnaroundMonth).toBe("2027-03");
  });

  it("2 · never positive", () => {
    const s = cashFlowSummary(series(10, [-7_900, -7_900, -7_900]))!;
    expect(s.text).toBe("Burning about $7,900/mo · no month turns positive in this view");
    expect(s.turnaroundChip).toBeNull();
    expect(s.turnaroundMonth).toBeNull();
  });

  it("3 · positive throughout", () => {
    const s = cashFlowSummary(series(10, [1_200, 1_200, 1_200]))!;
    expect(s.text).toBe("Adding about $1,200/mo · positive every month in this view");
    expect(s.turnaroundChip).toBeNull();
  });

  it("4 · turns negative", () => {
    const s = cashFlowSummary(series(10, [1_200, 1_200, 1_200, -500]))!;
    expect(s.text).toBe("Adding about $1,200/mo · turns negative Jan 2027");
    expect(s.turnaroundChip).toBe("TURNS NEGATIVE");
  });

  it("5 · varies month to month — a RANGE once the spread exceeds 25% of the mean", () => {
    const s = cashFlowSummary(series(10, [-4_000, -9_300, -6_000, -7_000, -5_000, 1_200]))!;
    expect(s.text).toBe("Burning $4,000–$9,300/mo · turns positive Mar 2027");
  });

  it("5b · stays a single figure while the spread is inside 25%", () => {
    const s = cashFlowSummary(series(10, [-8_000, -8_100, -7_900]))!;
    expect(s.text).toMatch(/^Burning about \$8,000\/mo/);
    expect(s.text).not.toContain("–");
  });

  it("6 · exactly zero", () => {
    const s = cashFlowSummary(series(10, [0, 0, 0]))!;
    expect(s.text).toBe("Flat about $0/mo");
    expect(s.regime).toBe("flat");
    expect(s.turnaroundChip).toBeNull();
  });

  it("does NOT treat a $0 month as turning positive — flat is not positive", () => {
    // Found by mutation: `>= 0` instead of `> 0` was unguarded, because no
    // test had a burning projection that touches exactly zero. A month where
    // nothing moved is not the month things turned around.
    const s = cashFlowSummary(series(10, [-7_900, -7_900, 0, -7_900]))!;
    expect(s.turnaroundMonth).toBeNull();
    expect(s.text).toBe("Burning about $7,900/mo · no month turns positive in this view");
  });

  it("names the first genuinely POSITIVE month, skipping a $0 month before it", () => {
    const s = cashFlowSummary(series(10, [-7_900, 0, 1_200]))!;
    expect(s.turnaroundMonth).toBe("2026-12"); // not the $0 month in Nov
    expect(s.turnaroundChip).toBe("TURNS POSITIVE");
  });

  it("mirrors both rules for a projection that is adding, then flat", () => {
    // Symmetric: a $0 month is not "turns negative" either.
    const flat = cashFlowSummary(series(10, [1_200, 1_200, 0, 1_200]))!;
    expect(flat.turnaroundMonth).toBeNull();
    expect(flat.text).toBe("Adding about $1,200/mo · positive every month in this view");
    const turns = cashFlowSummary(series(10, [1_200, 0, -500]))!;
    expect(turns.turnaroundMonth).toBe("2026-12");
    expect(turns.turnaroundChip).toBe("TURNS NEGATIVE");
  });

  it("keeps 'about' — a projection rounded in language beats false precision", () => {
    expect(cashFlowSummary(series(10, [-7_912, -7_888]))!.text).toContain("about");
  });

  it("hides the bar entirely with no data, rather than showing $0/mo", () => {
    expect(cashFlowSummary([])).toBeNull();
  });

  it("has no double or missing spaces in any state", () => {
    const cases = [
      [-7_900, 1_200], [-7_900], [1_200], [1_200, -500],
      [-4_000, -9_300, 1_200], [0, 0],
    ];
    for (const nets of cases) {
      expect(cashFlowSummary(series(10, nets))!.text).not.toMatch(/\s{2}/);
    }
  });
});

describe("NO COLOUR — the turnaround is a word, and the NET cell is sign + magnitude", () => {
  it("marks the turnaround with a WORD, never a hue", () => {
    const s = cashFlowSummary(series(10, [-7_900, 1_200]))!;
    // The chip is text. Nothing in the model names a colour, a class or a tone.
    expect(s.turnaroundChip).toBe("TURNS POSITIVE");
    expect(JSON.stringify(s)).not.toMatch(/red|green|emerald|rose|color|colour|tone/i);
  });

  it("gives the NET cell an explicit sign at every magnitude", () => {
    expect(netCellText(-3_987)).toBe("−$3,987");
    expect(netCellText(1_200)).toBe("+$1,200");
    expect(netCellText(0)).toBe("$0");
  });

  it("drops the caret at exactly zero", () => {
    expect(netCaret(-1)).toBe("▾");
    expect(netCaret(1)).toBe("▴");
    expect(netCaret(0)).toBeNull();
  });

  it("names the value for a screen reader without the caret", () => {
    expect(netCellLabel(-3_987)).toBe("Net cash flow, minus 3,987 dollars");
    expect(netCellLabel(1_200)).toBe("Net cash flow, plus 1,200 dollars");
    expect(netCellLabel(0)).toBe("Net cash flow, zero dollars");
  });
});

describe("delta against the baseline", () => {
  it("states less, more, or the same", () => {
    expect(cashFlowDelta(series(10, [-6_500]), series(10, [-7_900]))).toBe(
      "$1,400/mo less than baseline",
    );
    expect(cashFlowDelta(series(10, [-8_500]), series(10, [-7_900]))).toBe(
      "$600/mo more than baseline",
    );
    expect(cashFlowDelta(series(10, [-7_900]), series(10, [-7_900]))).toBe("Same as baseline");
  });

  it("treats a sub-dollar difference as the same", () => {
    expect(cashFlowDelta(series(10, [-7_900.4]), series(10, [-7_900]))).toBe("Same as baseline");
  });

  it("is null when either side has no months", () => {
    expect(cashFlowDelta([], series(10, [-1]))).toBeNull();
  });
});

describe("INCOME RESUMES chip", () => {
  const scn = (starts: string[]): Scenario => ({
    id: "t", name: "t", version: SCENARIO_VERSION, createdDate: "2026-10-01",
    timeline: { start: "2026-10-01", end: "2027-03-31" },
    accounts: [],
    levers: {
      incomeEvents: starts.map((startDate, i) => ({
        id: `i${i}`, label: "Income", amount: 3_000, kind: "recurring" as const, startDate,
      })),
      expenseEvents: [seededLine("housing", 0, "2026-10-01"), seededLine("living", 0, "2026-10-01")],
    },
  });

  it("marks the month a recurring income starts", () => {
    const months = series(10, [-1, -1, -1, -1]);
    expect([...incomeResumesMonths(scn(["2026-12-01"]), months)]).toEqual(["2026-12"]);
  });

  it("does NOT mark the first month — that is the starting state, not a resumption", () => {
    const months = series(10, [-1, -1]);
    expect(incomeResumesMonths(scn(["2026-10-01"]), months).size).toBe(0);
  });

  it("ignores one-off inflows and zero-amount streams", () => {
    const s = scn(["2026-12-01"]);
    s.levers.incomeEvents[0].kind = "oneoff";
    expect(incomeResumesMonths(s, series(10, [-1, -1, -1])).size).toBe(0);
    const z = scn(["2026-12-01"]);
    z.levers.incomeEvents[0].amount = 0;
    expect(incomeResumesMonths(z, series(10, [-1, -1, -1])).size).toBe(0);
  });

  it("ignores a stream starting outside the visible window", () => {
    expect(incomeResumesMonths(scn(["2028-01-01"]), series(10, [-1, -1])).size).toBe(0);
  });
});
