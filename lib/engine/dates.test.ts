import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  compareISO,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  followingApril15,
  monthInRange,
  monthKey,
  monthsInclusive,
  parseISO,
  sameMonth,
  toISO,
} from "./dates";

describe("date helpers", () => {
  it("parses and re-serializes ISO dates", () => {
    expect(parseISO("2026-07-01")).toEqual({ y: 2026, m: 7, d: 1 });
    expect(toISO({ y: 2026, m: 7, d: 1 })).toBe("2026-07-01");
    expect(toISO({ y: 2026, m: 12, d: 9 })).toBe("2026-12-09");
  });

  it("derives month keys and first-of-month", () => {
    expect(monthKey("2026-07-15")).toBe("2026-07");
    expect(firstOfMonth("2026-07-15")).toBe("2026-07-01");
  });

  it("counts days in a month, including leap February", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 7)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("adds months across year boundaries and clamps the day", () => {
    expect(addMonths("2026-07-01", 6)).toBe("2027-01-01");
    expect(addMonths("2026-07-01", 0)).toBe("2026-07-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28"); // clamp
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("adds days and measures spans", () => {
    expect(addDays("2026-07-01", 31)).toBe("2026-08-01");
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
    expect(daysBetween("2026-07-08", "2026-07-01")).toBe(-7);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("compares dates and matches months", () => {
    expect(compareISO("2026-07-01", "2026-08-01")).toBe(-1);
    expect(compareISO("2026-08-01", "2026-08-01")).toBe(0);
    expect(compareISO("2026-09-01", "2026-08-01")).toBe(1);
    expect(sameMonth("2026-08-01", "2026-08-31")).toBe(true);
    expect(sameMonth("2026-08-01", "2026-09-01")).toBe(false);
  });

  it("tests month-in-range inclusively", () => {
    expect(monthInRange("2026-09-01", "2026-09-01", "2027-02-28")).toBe(true);
    expect(monthInRange("2027-02-15", "2026-09-01", "2027-02-28")).toBe(true);
    expect(monthInRange("2026-08-01", "2026-09-01", "2027-02-28")).toBe(false);
    expect(monthInRange("2027-03-01", "2026-09-01", "2027-02-28")).toBe(false);
    // open-ended (no end)
    expect(monthInRange("2030-01-01", "2026-12-01")).toBe(true);
  });

  it("counts inclusive months between dates", () => {
    expect(monthsInclusive("2026-01-01", "2026-12-31")).toBe(12);
    expect(monthsInclusive("2026-07-01", "2027-12-31")).toBe(18);
    expect(monthsInclusive("2026-07-01", "2026-07-31")).toBe(1);
  });

  it("schedules tax to the following April 15", () => {
    expect(followingApril15("2026-07-01")).toBe("2027-04-15");
    expect(followingApril15("2026-12-31")).toBe("2027-04-15");
    expect(followingApril15("2027-01-02")).toBe("2028-04-15");
  });
});
