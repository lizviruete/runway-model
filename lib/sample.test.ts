import { describe, expect, it } from "vitest";
import { createSampleScenario, SAMPLE_AS_OF } from "./sample";
import { simulate } from "./engine/simulate";

describe("sample scenario — as-of anchoring", () => {
  it("reproduces the canonical scenario for the default anchor", () => {
    const s = createSampleScenario();
    expect(SAMPLE_AS_OF).toBe("2026-07-01");
    expect(s.timeline.start).toBe("2026-07-01");
    expect(s.timeline.end).toBe("2031-06-30");
    const severance = s.levers.incomeEvents.find((e) => e.id === "inc-severance")!;
    const unemployment = s.levers.incomeEvents.find((e) => e.id === "inc-unemployment")!;
    expect(severance.startDate).toBe("2026-07-01");
    expect(severance.endDate).toBe("2026-08-31");
    expect(unemployment.startDate).toBe("2026-09-01");
    expect(unemployment.endDate).toBe("2027-02-28");
    expect(s.levers.housing.change!.date).toBe("2026-09-01");
    const assetSale = s.levers.incomeEvents.find((e) => e.id === "one-asset-sale")!;
    expect(assetSale.kind).toBe("oneoff");
    expect(assetSale.startDate).toBe("2026-08-01");
    // The standalone one-time section is gone; one-offs live in the flow lists.
    expect("oneTimeEvents" in s.levers).toBe(false);
  });

  it("expresses every event relative to the anchor", () => {
    const s = createSampleScenario("2027-03-01");
    expect(s.timeline.start).toBe("2027-03-01");
    expect(s.timeline.end).toBe("2032-02-29"); // 5 years out, leap-year end of month
    const severance = s.levers.incomeEvents.find((e) => e.id === "inc-severance")!;
    const unemployment = s.levers.incomeEvents.find((e) => e.id === "inc-unemployment")!;
    expect(severance.startDate).toBe("2027-03-01"); // starts at the anchor
    expect(severance.endDate).toBe("2027-04-30"); // ~2 months
    expect(unemployment.startDate).toBe("2027-05-01"); // anchor + 2 months
    expect(unemployment.endDate).toBe("2027-10-31"); // ~6 months
    expect(s.levers.housing.change!.date).toBe("2027-05-01");
    expect(s.levers.incomeEvents.find((e) => e.id === "one-asset-sale")!.startDate).toBe("2027-04-01"); // anchor + 1 month
  });

  it("tells the same ~9-month crunch regardless of the anchor", () => {
    const a = simulate(createSampleScenario("2026-07-01")).runway.months;
    const b = simulate(createSampleScenario("2029-11-01")).runway.months;
    for (const m of [a, b]) {
      expect(m).toBeGreaterThan(8);
      expect(m).toBeLessThan(10);
    }
    expect(Math.abs(a - b)).toBeLessThan(0.5); // only day-count drift between anchors
  });
});
