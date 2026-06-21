import { describe, expect, it } from "vitest";
import { horizonEndFor, isPastAnchor } from "./timeAnchor";
import { monthsInclusive } from "./engine/dates";

describe("horizonEndFor", () => {
  it("gives a 60-month (5-year) horizon ending last-day-of-month", () => {
    expect(horizonEndFor("2026-07-01")).toBe("2031-06-30");
    expect(monthsInclusive("2026-07-01", horizonEndFor("2026-07-01"))).toBe(60);
  });

  it("re-bases the horizon for a mid-month anchor", () => {
    const end = horizonEndFor("2026-06-21");
    expect(end).toBe("2031-05-31"); // 59 months out from June 2026, end of month
    expect(monthsInclusive("2026-06-21", end)).toBe(60);
  });
});

describe("isPastAnchor", () => {
  it("is true only when the anchor's month precedes today's month", () => {
    expect(isPastAnchor("2026-05-01", "2026-06-21")).toBe(true);
    expect(isPastAnchor("2025-12-31", "2026-06-21")).toBe(true);
  });

  it("is false for the current month or a future anchor", () => {
    expect(isPastAnchor("2026-06-01", "2026-06-30")).toBe(false); // same month
    expect(isPastAnchor("2026-06-21", "2026-06-21")).toBe(false); // exactly today
    expect(isPastAnchor("2026-08-01", "2026-06-21")).toBe(false); // future
  });
});
