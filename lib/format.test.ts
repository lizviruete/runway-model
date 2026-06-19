import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatMonthYear, formatRunway } from "./format";

describe("formatCurrency", () => {
  it("formats whole dollars with grouping", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency(0)).toBe("$0");
  });
  it("uses a real minus sign for negatives", () => {
    expect(formatCurrency(-500)).toBe("−$500");
  });
  it("adds a plus sign when requested", () => {
    expect(formatCurrency(500, { sign: true })).toBe("+$500");
    expect(formatCurrency(-500, { sign: true })).toBe("−$500");
  });
  it("shows cents when asked", () => {
    expect(formatCurrency(70.83, { cents: true })).toBe("$70.83");
  });
});

describe("date + runway formatting", () => {
  it("formats month/year and full date from ISO", () => {
    expect(formatMonthYear("2026-07-01")).toBe("Jul 2026");
    expect(formatDate("2027-03-30")).toBe("Mar 30, 2027");
  });
  it("describes runway in months or weeks", () => {
    expect(formatRunway(8.9)).toBe("8.9 months");
    expect(formatRunway(0.5)).toMatch(/weeks$/);
  });
});
