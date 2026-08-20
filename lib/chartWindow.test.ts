import { describe, expect, it } from "vitest";
import { setSeededAmount } from "./engine/expenses";
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
    // Baseline cash-zero sits just past month 9 (9.00 after item 3 gave the
    // eligible accounts their default return — it was 8.94 before), so the
    // window lands on 13. The point of the test is that it is a short view and
    // not the full 60.
    expect(visibleMonthCount(baseRes, null, false)).toBe(13);
  });

  it("shows the full horizon when the CURRENT scenario is sustainable", () => {
    expect(roleRes.runway.survivesHorizon).toBe(true);
    expect(visibleMonthCount(roleRes, baseRes, true)).toBe(60);
  });

  it("windows to the current cash-zero when the BASELINE survives (no forced 60)", () => {
    // Current craters (~month 9), baseline is sustainable — a surviving baseline
    // alone must NOT stretch to the full horizon (the long flat-zero-tail bug).
    expect(visibleMonthCount(baseRes, roleRes, true)).toBe(13);
  });

  it("collapses the empty/all-zeros canvas to the floor, not 60 flat-zero months", () => {
    const blankRes = simulate(createBlankScenario());
    expect(blankRes.runway.survivesHorizon).toBe(true); // trivially beyond-horizon
    expect(visibleMonthCount(blankRes, blankRes, false)).toBe(12);
  });

  it("stretches the axis when a lever pushes cash-zero later", () => {
    // Halve the living spend → runway extends well past the baseline.
    const leaner = { ...base, levers: setSeededAmount(base.levers, "living", 3_000) };
    const leanRes = simulate(leaner);
    const window = visibleMonthCount(leanRes, baseRes, true);
    expect(window).toBeGreaterThan(12);
    expect(window).toBeLessThanOrEqual(60);
  });
});
