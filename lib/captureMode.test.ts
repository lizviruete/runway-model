import { describe, expect, it } from "vitest";
import { isCleanCapture } from "./captureMode";

describe("isCleanCapture — ?chrome=min", () => {
  it("is true only for chrome=min", () => {
    expect(isCleanCapture("?chrome=min")).toBe(true);
  });

  it("is false when absent or any other value", () => {
    expect(isCleanCapture("")).toBe(false);
    expect(isCleanCapture("?chrome=full")).toBe(false);
    expect(isCleanCapture("?example=1")).toBe(false);
  });

  it("composes with a scenario source (read independently)", () => {
    expect(isCleanCapture("?preset=landed-new-role&chrome=min")).toBe(true);
  });
});
