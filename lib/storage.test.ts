import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankScenario, createSampleScenario } from "./sample";
import {
  clearAllSavedData,
  clearSavedBaseline,
  getSavedBaseline,
  listSaved,
  loadLastBaseline,
  loadLastSession,
  persistWorkingState,
  saveLastBaseline,
  saveLastSession,
  saveScenario,
  setSavedBaseline,
} from "./storage";

// A minimal in-memory localStorage so the SSR-guarded storage helpers run in the
// Node test environment exactly as they do in the browser.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("persistWorkingState — example mode is ephemeral", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves the user's saved session + baseline untouched while previewing an example, and they survive on exit", () => {
    // The user has their own working scenario and a saved baseline.
    const userScenario = createBlankScenario("2026-06-01");
    userScenario.name = "My real plan";
    const userBaseline = createBlankScenario("2026-06-01");
    userBaseline.name = "My real baseline";
    saveLastSession(userScenario);
    saveLastBaseline(userBaseline);

    const sample = createSampleScenario("2026-06-01");

    // Enter example mode: the persist path runs with exampleMode = true. The
    // sample (and a preset applied on top of it) must NOT touch storage.
    persistWorkingState(sample, sample, true);
    expect(loadLastSession()).toEqual(userScenario);
    expect(loadLastBaseline()).toEqual(userBaseline);

    const presetScenario = { ...sample, name: "Example — preset applied" };
    persistWorkingState(presetScenario, sample, true);
    expect(loadLastSession()).toEqual(userScenario);
    expect(loadLastBaseline()).toEqual(userBaseline);

    // Exit example mode without keeping the example: the user's data is intact.
    expect(loadLastSession()).toEqual(userScenario);
    expect(loadLastBaseline()).toEqual(userBaseline);
  });

  it("persists normally once out of example mode", () => {
    const sample = createSampleScenario("2026-06-01");
    const blank = createBlankScenario("2026-06-01");

    persistWorkingState(sample, blank, false);
    expect(loadLastSession()).toEqual(sample);
    expect(loadLastBaseline()).toEqual(blank);
  });
});

describe("saved baseline — the dated record behind the Baseline pill", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the scenario + savedAt, and is null when nothing is saved", () => {
    expect(getSavedBaseline()).toBeNull();

    const scenario = createBlankScenario("2026-06-01");
    scenario.name = "My baseline";
    setSavedBaseline(scenario, "2026-06-27");

    const loaded = getSavedBaseline();
    expect(loaded).toEqual({ scenario, savedAt: "2026-06-27" });
  });

  it("round-trips an optional note, and omits it when blank", () => {
    const scenario = createBlankScenario("2026-06-01");
    setSavedBaseline(scenario, "2026-06-27", "post-sublet plan");
    expect(getSavedBaseline()).toEqual({ scenario, savedAt: "2026-06-27", notes: "post-sublet plan" });

    setSavedBaseline(scenario, "2026-06-28", "   ");
    expect(getSavedBaseline()?.notes).toBeUndefined();
  });

  it("clears the saved baseline without touching the working anchor", () => {
    const scenario = createBlankScenario("2026-06-01");
    setSavedBaseline(scenario, "2026-06-27");
    saveLastBaseline(scenario); // the working `runway:baseline` anchor

    clearSavedBaseline();
    expect(getSavedBaseline()).toBeNull();
    // The working anchor lingers, so VS-BASELINE stays renderable.
    expect(loadLastBaseline()).toEqual(scenario);
  });
});

describe("clearAllSavedData — the ?reset=1 full wipe", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes every persisted key — saved scenarios, baseline, session, anchor", () => {
    const scenario = createSampleScenario("2026-06-01");
    saveScenario("Plan A", scenario, "2026-06-20");
    setSavedBaseline(scenario, "2026-06-27");
    saveLastSession(scenario);
    saveLastBaseline(scenario);

    clearAllSavedData();

    expect(listSaved()).toEqual([]);
    expect(getSavedBaseline()).toBeNull();
    expect(loadLastSession()).toBeNull();
    expect(loadLastBaseline()).toBeNull();
  });
});
