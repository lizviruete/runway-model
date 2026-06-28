import { describe, expect, it } from "vitest";
import {
  formatAmount,
  percentToText,
  sanitizeAmountText,
  sanitizePercentText,
  textToPercent,
  toAmount,
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

  it("keeps one decimal point in the LIVE buffer (so 1234.56 displays while typing)", () => {
    expect(sanitizeAmountText("1234.56")).toBe("1234.56"); // dot + fraction preserved
    expect(sanitizeAmountText("1234.")).toBe("1234."); // trailing dot mid-type
    expect(sanitizeAmountText("1234.5.6")).toBe("1234.56"); // at most one dot
    expect(sanitizeAmountText("0.5")).toBe("0.5");
  });
});

describe("toAmount — commits the integer part (fraction truncated, never merged)", () => {
  it("truncates the fraction instead of 100x-ing the amount", () => {
    expect(toAmount("1234.56")).toBe(1234); // the QA bug: NOT 123456
    expect(toAmount("12.99")).toBe(12);
    expect(toAmount("0.5")).toBe(0);
  });

  it("coerces empty / invalid to the min (default 0)", () => {
    expect(toAmount("")).toBe(0);
    expect(toAmount(".")).toBe(0);
    expect(toAmount("abc")).toBe(0);
  });

  it("clamps negatives to >= 0 and passes through whole values", () => {
    expect(toAmount("-5")).toBe(0);
    expect(toAmount("5000")).toBe(5000);
    expect(toAmount("0")).toBe(0);
  });
});

describe("toClamped", () => {
  it("coerces empty / invalid to the min, clamps negatives, passes valid through", () => {
    expect(toClamped("")).toBe(0);
    expect(toClamped(".")).toBe(0);
    expect(toClamped("abc")).toBe(0);
    expect(toClamped("-5")).toBe(0);
    expect(toClamped("5000")).toBe(5000);
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

  it("converts percent text back to a clamped fraction, truncated to one decimal", () => {
    expect(textToPercent("6")).toBeCloseTo(0.06);
    expect(textToPercent("7.5")).toBeCloseTo(0.075);
    expect(textToPercent("7.55")).toBeCloseTo(0.075); // 7.55 → 7.5 (truncate, never 7.6)
    expect(textToPercent("")).toBe(0);
    expect(textToPercent("-5")).toBe(0); // never negative
  });

  it("display and stored value agree after truncation (no 7.6-vs-7.55 drift)", () => {
    const stored = textToPercent("7.55"); // 0.075
    expect(percentToText(stored)).toBe("7.5"); // shown == stored
  });
});

describe("formatAmount — comma-grouped resting display", () => {
  it("groups thousands and keeps a clean integer round-trip", () => {
    expect(formatAmount(12000)).toBe("12,000");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1234567)).toBe("1,234,567");
    // The committed value behind the display stays a clean int.
    expect(toAmount(formatAmount(12000).replace(/,/g, ""))).toBe(12000);
  });
});
