import { describe, expect, it } from "vitest";
import { decodeScenario, encodeScenario, scenarioFromSearch, shareableUrl } from "./share";
import { createSampleScenario } from "./sample";
import { getPreset } from "./presets";

describe("shareable URL codec", () => {
  it("round-trips the sample scenario exactly", () => {
    const s = createSampleScenario();
    const decoded = decodeScenario(encodeScenario(s));
    expect(decoded).toEqual(s);
  });

  it("round-trips an edited + preset-applied scenario exactly", () => {
    const edited = getPreset("both-combined")!.apply(createSampleScenario());
    const withNote = {
      ...edited,
      accounts: edited.accounts.map((a, i) => (i === 0 ? { ...a, userNote: "résumé café — ünïcode ✓" } : a)),
    };
    const decoded = decodeScenario(encodeScenario(withNote));
    expect(decoded).toEqual(withNote);
  });

  it("produces a URL-safe param (no +, /, or =)", () => {
    const enc = encodeScenario(createSampleScenario());
    expect(enc).not.toMatch(/[+/=]/);
  });

  it("reads the scenario back out of a query string", () => {
    const s = createSampleScenario();
    const url = shareableUrl(s, "https://runway.lizbuilds.ai/");
    const search = new URL(url).search;
    expect(scenarioFromSearch(search)).toEqual(s);
  });

  it("a shareable link reproduces an EDITED scenario in a fresh tab", () => {
    // Mimics: edit → copy link → open in a clean tab → parse the URL.
    const edited = {
      ...createSampleScenario(),
      name: "My situation",
      levers: { ...createSampleScenario().levers, targetMonthlySpend: 2_500 },
    };
    const url = shareableUrl(edited, "https://runway.lizbuilds.ai/");
    const reopened = scenarioFromSearch(new URL(url).search);
    expect(reopened).toEqual(edited);
    expect(reopened?.levers.targetMonthlySpend).toBe(2_500);
  });

  it("returns null for malformed or absent params", () => {
    expect(decodeScenario("not-valid-base64!!")).toBeNull();
    expect(decodeScenario(encodeScenario({ junk: true } as never))).toBeNull();
    expect(scenarioFromSearch("?other=1")).toBeNull();
  });
});
