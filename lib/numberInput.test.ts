import { describe, expect, it } from "vitest";
import {
  percentToText,
  sanitizeAmountText,
  sanitizePercentText,
  textToPercent,
  toClamped,
} from "./numberInput";

describe("sanitizeAmountText", () => {
  it("strips leading zeros so typing over a 0 is clean", () => {
    expect(sanitizeAmountText("05000")).toBe("5000");
    expect(sanitizeAmountText("000")).toBe("0");
  });

  it("keeps a lone 0 and an empty string", () => {
    expect(sanitizeAmountText("0")).toBe("0");
    expect(sanitizeAmountText("")).toBe("");
  });

  it("strips a leading minus and any non-numeric junk (no negatives)", () => {
    expect(sanitizeAmountText("-5")).toBe("5");
    expect(sanitizeAmountText("-")).toBe("");
    expect(sanitizeAmountText("1a2b3")).toBe("123");
    expect(sanitizeAmountText("$1,200")).toBe("1200");
  });

  it("drops the fractional part rather than concatenating digits", () => {
    expect(sanitizeAmountText("1234.56")).toBe("1234"); // not 123456
    expect(sanitizeAmountText("0.99")).toBe("0");
  });
});

describe("toClamped", () => {
  it("coerces empty / invalid to the min (default 0)", () => {
    expect(toClamped("")).toBe(0);
    expect(toClamped(".")).toBe(0);
    expect(toClamped("abc")).toBe(0);
  });

  it("clamps negatives to >= 0 as a defensive backstop", () => {
    expect(toClamped("-5")).toBe(0);
  });

  it("passes through a valid non-negative number", () => {
    expect(toClamped("5000")).toBe(5000);
    expect(toClamped("0")).toBe(0);
  });
});

describe("sanitizePercentText", () => {
  it("preserves one decimal of precision", () => {
    expect(sanitizePercentText("7.5")).toBe("7.5");
    expect(sanitizePercentText("7.55")).toBe("7.5"); // one decimal max
  });

  it("strips leading zeros but keeps a leading 0. and collapses extra dots", () => {
    expect(sanitizePercentText("06")).toBe("6");
    expect(sanitizePercentText("0.5")).toBe("0.5");
    expect(sanitizePercentText("7.5.5")).toBe("7.5");
  });

  it("rejects a minus and non-numeric junk (no negative percentages)", () => {
    expect(sanitizePercentText("-5")).toBe("5");
    expect(sanitizePercentText("6a%")).toBe("6");
  });
});

describe("percent ↔ fraction round-trip", () => {
  it("converts a stored fraction to its percent text", () => {
    expect(percentToText(0.06)).toBe("6");
    expect(percentToText(0.075)).toBe("7.5");
    expect(percentToText(0)).toBe("0");
  });

  it("converts percent text back to a clamped fraction", () => {
    expect(textToPercent("6")).toBeCloseTo(0.06);
    expect(textToPercent("7.5")).toBeCloseTo(0.075);
    expect(textToPercent("")).toBe(0);
    expect(textToPercent("-5")).toBe(0); // never negative
  });
});
