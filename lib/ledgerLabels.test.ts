import { describe, expect, it } from "vitest";
import { SEEDED_LABELS } from "./engine/expenses";
import type { LedgerCategory } from "./engine/types";
import { catLabel, CATEGORY_LABELS, isRedundantTransactionLabel } from "./ledgerLabels";

describe("isRedundantTransactionLabel", () => {
  it("suppresses the default seeded labels", () => {
    // Otherwise the Transactions view reads "Housing · Housing / rent".
    expect(isRedundantTransactionLabel("housing", SEEDED_LABELS.housing)).toBe(true);
    expect(isRedundantTransactionLabel("living", SEEDED_LABELS.living)).toBe(true);
    expect(isRedundantTransactionLabel("housing", "Housing / rent")).toBe(true);
    expect(isRedundantTransactionLabel("living", "Living spend")).toBe(true);
  });

  it("suppresses a label that is simply the category's own name", () => {
    expect(isRedundantTransactionLabel("housing", "Housing")).toBe(true);
    expect(isRedundantTransactionLabel("living", "Living")).toBe(true);
    expect(isRedundantTransactionLabel("income", "Income")).toBe(true);
  });

  it("SHOWS the suffix for a renamed seeded line", () => {
    // The rule is about the label being redundant, not about the row being
    // seeded: "Housing · Mortgage" is informative, and it is exactly the
    // treatment a renamed user row gets.
    expect(isRedundantTransactionLabel("housing", "Mortgage")).toBe(false);
    expect(isRedundantTransactionLabel("living", "Groceries and bills")).toBe(false);
  });

  it("suppresses a USER row whose label happens to equal its category label", () => {
    // Same rule, no seeded involvement — an expense literally named "Expense".
    expect(isRedundantTransactionLabel("expense", "Expense")).toBe(true);
  });

  it("shows the suffix for an ordinary user row", () => {
    expect(isRedundantTransactionLabel("expense", "Childcare")).toBe(false);
    expect(isRedundantTransactionLabel("income", "Severance")).toBe(false);
  });

  it("does not leak the seeded labels onto unrelated categories", () => {
    // "Living spend" under Expense is a real, user-chosen label.
    expect(isRedundantTransactionLabel("expense", "Living spend")).toBe(false);
    expect(isRedundantTransactionLabel("expense", "Housing / rent")).toBe(false);
    expect(isRedundantTransactionLabel("income", "Housing / rent")).toBe(false);
  });

  it("never suppresses an empty or unrelated label", () => {
    expect(isRedundantTransactionLabel("housing", "")).toBe(false);
    expect(isRedundantTransactionLabel("tax", "Tax/penalty")).toBe(true);
    expect(isRedundantTransactionLabel("tax", "Q3 estimated")).toBe(false);
  });
});

describe("catLabel — ≈ is driven per line, not per category", () => {
  it("always renders the category's name", () => {
    for (const cat of Object.keys(CATEGORY_LABELS) as LedgerCategory[]) {
      expect(catLabel(cat)).toContain(CATEGORY_LABELS[cat]);
      expect(catLabel(cat, true)).toContain(CATEGORY_LABELS[cat]);
    }
  });

  it("adds ≈ when and only when the amount is modeled", () => {
    expect(catLabel("living", true)).toBe("≈ Living");
    expect(catLabel("living", false)).toBe("Living");
    expect(catLabel("expense", true)).toBe("≈ Expense");
    expect(catLabel("expense", false)).toBe("Expense");
  });

  it("no longer hard-codes which categories are estimates", () => {
    // The old behaviour was a fixed MODELED set: "living" was ALWAYS ≈ and
    // "expense" never was. §1 makes it a per-line control, so both directions
    // have to be reachable.
    expect(catLabel("living")).toBe("Living"); // living, flag off
    expect(catLabel("expense", true)).toBe("≈ Expense"); // a user row, flag on
    expect(catLabel("housing", true)).toBe("≈ Housing"); // housing can be too
    expect(catLabel("housing")).toBe("Housing"); // …but is not by default
  });

  it("ignores the label entirely — renaming a line never changes ≈", () => {
    // catLabel takes no label argument at all; this pins that signature.
    expect(catLabel.length).toBeLessThanOrEqual(2);
  });
});
