import { describe, expect, it } from "vitest";
import { simulate } from "./engine/simulate";
import { createBlankScenario, createSampleScenario } from "./sample";
import { getPreset } from "./presets";
import { visibleMonthCount } from "./chartWindow";

describe("visibleMonthCount", () => {
  const base = createSampleScenario();
  const baseRes = simulate(base);
  const roleRes = simulate(getPreset("landed-new-role")!.apply(base));

  it("keeps the baseline a clean ~12-month view despite a 60-month horizon", () => {
    expect(baseRes.projection.length).toBe(60);
    // baseline cash-zero ~month 9 → window floors at 12
    expect(visibleMonthCount(baseRes, null, false)).toBe(12);
  });

  it("shows the full horizon when the CURRENT scenario is sustainable", () => {
    expect(roleRes.runway.survivesHorizon).toBe(true);
    expect(visibleMonthCount(roleRes, baseRes, true)).toBe(60);
  });

  it("windows to the current cash-zero when the BASELINE survives (no forced 60)", () => {
    // Current craters (~month 9), baseline is sustainable — a surviving baseline
    // alone must NOT stretch to the full horizon (the long flat-zero-tail bug).
    expect(visibleMonthCount(baseRes, roleRes, true)).toBe(12);
  });

  it("collapses the empty/all-zeros canvas to the floor, not 60 flat-zero months", () => {
    const blankRes = simulate(createBlankScenario());
    expect(blankRes.runway.survivesHorizon).toBe(true); // trivially beyond-horizon
    expect(visibleMonthCount(blankRes, blankRes, false)).toBe(12);
  });

  it("stretches the axis when a lever pushes cash-zero later", () => {
    // Halve the living spend → runway extends well past the baseline.
    const leaner = { ...base, levers: { ...base.levers, targetMonthlySpend: 3_000 } };
    const leanRes = simulate(leaner);
    const window = visibleMonthCount(leanRes, baseRes, true);
    expect(window).toBeGreaterThan(12);
    expect(window).toBeLessThanOrEqual(60);
  });
});
