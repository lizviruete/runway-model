import { describe, expect, it } from "vitest";
import { hasMeaningfulAmounts } from "./baseline";
import { setSeededAmount } from "./engine/expenses";
import { createBlankScenario, createSampleScenario } from "./sample";

describe("hasMeaningfulAmounts", () => {
  it("is false for the all-zeros blank canvas (hide comparatives)", () => {
    expect(hasMeaningfulAmounts(createBlankScenario())).toBe(false);
  });

  it("is true for the sample scenario (a meaningful baseline)", () => {
    expect(hasMeaningfulAmounts(createSampleScenario())).toBe(true);
  });

  it("flips true once any single amount is non-zero", () => {
    // Living spend is a seeded expense line now, so the expense sweep covers it
    // — `hasMeaningfulAmounts` no longer needs a check of its own for it.
    const s = createBlankScenario();
    expect(hasMeaningfulAmounts(s)).toBe(false);
    s.levers = setSeededAmount(s.levers, "living", 100);
    expect(hasMeaningfulAmounts(s)).toBe(true);
  });

  it("notices a non-zero account balance", () => {
    const s = createBlankScenario();
    s.accounts[0].balance = 5000;
    expect(hasMeaningfulAmounts(s)).toBe(true);
  });
});
