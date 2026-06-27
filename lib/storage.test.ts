import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankScenario, createSampleScenario } from "./sample";
import {
  loadLastBaseline,
  loadLastSession,
  persistWorkingState,
  saveLastBaseline,
  saveLastSession,
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
