import { describe, expect, it } from "vitest";
import { chooseInitSource, isExampleSource, nextExampleMode, presetIdFromSearch } from "./exampleMode";
import { createSampleScenario } from "./sample";
import { shareableUrl } from "./share";

// A real `?s=...` search string for the sample scenario.
const sharedSearch = (() => {
  const url = new URL(shareableUrl(createSampleScenario(), "https://x.test/"));
  return url.search;
})();

describe("chooseInitSource — mount hydration precedence", () => {
  it("defaults a first-time visit (no params, no saved state) to the blank canvas", () => {
    expect(chooseInitSource("", false)).toBe("blank");
  });

  it("enters example mode on ?example=1", () => {
    expect(chooseInitSource("?example=1", false)).toBe("example");
    expect(isExampleSource(chooseInitSource("?example=1", false))).toBe(true);
  });

  it("restores a returning user's last session (no example chips)", () => {
    const source = chooseInitSource("", true);
    expect(source).toBe("restore");
    expect(isExampleSource(source)).toBe(false);
  });

  it("loads a shared ?s= scenario, never example mode", () => {
    const source = chooseInitSource(sharedSearch, false);
    expect(source).toBe("url");
    expect(isExampleSource(source)).toBe(false);
  });

  it("?s= takes precedence over ?example=1", () => {
    const search = `${sharedSearch}&example=1`;
    expect(chooseInitSource(search, false)).toBe("url");
  });

  it("?s= takes precedence over a restorable last session", () => {
    expect(chooseInitSource(sharedSearch, true)).toBe("url");
  });

  it("?example=1 takes precedence over a restorable last session", () => {
    expect(chooseInitSource("?example=1", true)).toBe("example");
  });

  it("enters a specific preset on a valid ?preset=<id>", () => {
    const source = chooseInitSource("?preset=zero-housing", false);
    expect(source).toBe("preset");
    expect(isExampleSource(source)).toBe(true); // preset deep-link is example mode
  });

  it("ignores an invalid ?preset=<id> and falls through the chain", () => {
    expect(chooseInitSource("?preset=not-a-preset", false)).toBe("blank");
    expect(chooseInitSource("?preset=not-a-preset", true)).toBe("restore");
  });

  it("?s= takes precedence over ?preset=", () => {
    expect(chooseInitSource(`${sharedSearch}&preset=zero-housing`, false)).toBe("url");
  });

  it("?preset= takes precedence over ?example=1", () => {
    expect(chooseInitSource("?preset=zero-housing&example=1", false)).toBe("preset");
  });

  it("?reset=1 wins over everything (the test-only wipe)", () => {
    expect(chooseInitSource("?reset=1", false)).toBe("reset");
    expect(chooseInitSource(`${sharedSearch}&reset=1`, true)).toBe("reset");
    expect(chooseInitSource("?reset=1&preset=zero-housing&example=1", true)).toBe("reset");
  });
});

describe("presetIdFromSearch", () => {
  it("returns the id for a valid example preset", () => {
    expect(presetIdFromSearch("?preset=landed-new-role")).toBe("landed-new-role");
  });

  it("returns null for a missing or unknown preset", () => {
    expect(presetIdFromSearch("")).toBeNull();
    expect(presetIdFromSearch("?preset=")).toBeNull();
    expect(presetIdFromSearch("?preset=baseline")).toBeNull(); // built-in baseline was removed
    expect(presetIdFromSearch("?preset=bogus")).toBeNull();
  });
});

describe("nextExampleMode — enter / stay / exit transitions", () => {
  it("enters on 'See an Example'", () => {
    expect(nextExampleMode(false, "seeExample")).toBe(true);
  });

  it("stays in example mode when selecting a preset chip", () => {
    expect(nextExampleMode(true, "applyPreset")).toBe(true);
  });

  it("soft-exits on a manual edit", () => {
    expect(nextExampleMode(true, "manualEdit")).toBe(false);
  });

  it("hard-exits on 'Start fresh'", () => {
    expect(nextExampleMode(true, "startFresh")).toBe(false);
  });

  it("exits when locking the user's own baseline or loading a saved scenario", () => {
    expect(nextExampleMode(true, "saveAsBaseline")).toBe(false);
    expect(nextExampleMode(true, "loadSaved")).toBe(false);
  });
});
