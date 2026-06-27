import { describe, expect, it } from "vitest";
import { targetSpendHint } from "./spendDelta";

describe("targetSpendHint — compares against the active baseline's spend", () => {
  it("reads neutral when the target equals the baseline (loading the baseline → Δ 0)", () => {
    expect(targetSpendHint(6_500, 6_500)).toBe("Same as baseline");
    expect(targetSpendHint(0, 0)).toBe("Same as baseline");
  });

  it("measures the delta from a real saved baseline, not from $0", () => {
    // Baseline of $6,500 saved; target raised to $9,000 → +$2,500 vs that baseline.
    expect(targetSpendHint(9_000, 6_500)).toBe("+$2,500/mo vs. baseline ($6,500)");
    // ...and a cut reads negative against the same baseline (U+2212 minus).
    expect(targetSpendHint(3_250, 6_500)).toBe("−$3,250/mo vs. baseline ($6,500)");
  });

  it("falls back to the $0 reference when there is no baseline (anchor spend = 0)", () => {
    expect(targetSpendHint(5_000, 0)).toBe("+$5,000/mo vs. baseline ($0)");
  });
});
