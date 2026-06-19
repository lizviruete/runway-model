import { describe, expect, it } from "vitest";
import { simulate } from "./engine/simulate";
import { createSampleScenario } from "./sample";
import { getPreset } from "./presets";
import { visibleMonthCount } from "./chartWindow";

describe("visibleMonthCount", () => {
  const base = createSampleScenario();
  const baseRes = simulate(base);

  it("keeps the baseline a clean ~12-month view despite a 60-month horizon", () => {
    expect(baseRes.projection.length).toBe(60);
    // baseline cash-zero ~month 9 → window floors at 12
    expect(visibleMonthCount(baseRes, null, false)).toBe(12);
  });

  it("shows the full horizon when the scenario is sustainable", () => {
    const role = simulate(getPreset("landed-new-role")!.apply(base));
    expect(role.runway.survivesHorizon).toBe(true);
    expect(visibleMonthCount(role, baseRes, true)).toBe(60);
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
