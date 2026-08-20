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

describe("catLabel — the MONTHLY view is unaffected by line labels", () => {
  it("depends on the category alone", () => {
    // The monthly ledger renders catLabel(category) and never sees a label, so
    // nothing in item 2's expense-primitive work can change it.
    for (const cat of Object.keys(CATEGORY_LABELS) as LedgerCategory[]) {
      expect(catLabel(cat)).toContain(CATEGORY_LABELS[cat]);
    }
  });

  it("keeps the ≈ marker on modeled categories only", () => {
    expect(catLabel("living")).toBe("≈ Living");
    expect(catLabel("interestEarned")).toBe("≈ Interest");
    expect(catLabel("tax")).toBe("≈ Tax/penalty");
    expect(catLabel("creditInterest")).toBe("≈ Credit interest");
    // entered inputs carry no marker
    expect(catLabel("housing")).toBe("Housing");
    expect(catLabel("expense")).toBe("Expense");
    expect(catLabel("income")).toBe("Income");
  });
});
