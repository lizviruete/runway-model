import { describe, expect, it } from "vitest";
import { createBlankScenario } from "./sample";
import { buildSavedPills } from "./savedPills";
import type { SavedBaseline, SavedScenario } from "./storage";

const scenario = createBlankScenario("2026-06-01");

const savedBaseline: SavedBaseline = { scenario, savedAt: "2026-06-27" };

const savedScenarios: SavedScenario[] = [
  { key: "Plan A", name: "Plan A", savedAt: "2026-06-20", notes: "moved in with family", scenario },
  { key: "Plan B", name: "Plan B", savedAt: "2026-06-21", scenario },
];

describe("buildSavedPills", () => {
  it("returns no pills when nothing is saved (so no SAVED label renders)", () => {
    expect(buildSavedPills(null, [])).toEqual([]);
  });

  it("pins a single Baseline pill first when a baseline is saved", () => {
    const pills = buildSavedPills(savedBaseline, []);
    expect(pills).toHaveLength(1);
    expect(pills[0]).toMatchObject({ kind: "baseline", key: "baseline", label: "Baseline", date: "2026-06-27" });
  });

  it("carries the baseline's optional note onto its pill", () => {
    const withNote = buildSavedPills({ ...savedBaseline, notes: "post-sublet plan" }, []);
    expect(withNote[0].notes).toBe("post-sublet plan");
  });

  it("renders one pill per saved scenario, carrying its date + notes", () => {
    const pills = buildSavedPills(null, savedScenarios);
    expect(pills.map((p) => p.kind)).toEqual(["scenario", "scenario"]);
    expect(pills[0]).toMatchObject({ key: "Plan A", label: "Plan A", date: "2026-06-20", notes: "moved in with family" });
    expect(pills[1].notes).toBeUndefined();
  });

  it("orders the baseline first, then the scenarios", () => {
    const pills = buildSavedPills(savedBaseline, savedScenarios);
    expect(pills.map((p) => p.kind)).toEqual(["baseline", "scenario", "scenario"]);
    expect(pills.map((p) => p.label)).toEqual(["Baseline", "Plan A", "Plan B"]);
  });
});
