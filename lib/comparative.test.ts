import { describe, expect, it } from "vitest";
import { comparativeHint, NEW_VS_BASELINE } from "./comparative";

describe("comparativeHint", () => {
  it("reads 'Same as baseline' when equal", () => {
    expect(comparativeHint(6500, 6500)).toBe("Same as baseline");
    expect(comparativeHint(0, 0)).toBe("Same as baseline");
  });

  it("shows a signed, comma-formatted delta vs. the baseline value", () => {
    expect(comparativeHint(8500, 6500, { perMonth: true })).toBe("+$2,000/mo vs. baseline ($6,500)");
    expect(comparativeHint(4000, 6500, { perMonth: true })).toBe("−$2,500/mo vs. baseline ($6,500)");
  });

  it("omits /mo for one-time amounts (accuracy over uniformity)", () => {
    expect(comparativeHint(8000, 5000)).toBe("+$3,000 vs. baseline ($5,000)");
  });

  it("exposes the 'new — not in baseline' caption for added levers", () => {
    expect(NEW_VS_BASELINE).toBe("New — not in baseline");
  });
});
