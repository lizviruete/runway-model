// =============================================================================
// Ledger label rules.
//
// Extracted from LedgerView so the decidable parts are unit-testable in the
// pure layer (V2.1 ruling (a)) rather than only through a rendered table.
// =============================================================================

import { SEEDED_LABELS } from "./engine/expenses";
import type { LedgerCategory } from "./engine/types";

export const CATEGORY_LABELS: Record<LedgerCategory, string> = {
  income: "Income",
  housing: "Housing",
  living: "Living",
  expense: "Expense",
  assetSale: "Asset sale",
  assetCarry: "Carrying cost",
  tax: "Tax/penalty",
  creditInterest: "Credit interest",
  interestEarned: "Interest",
  growth: "Growth",
  tapIn: "Transfer in",
  tapOut: "Transfer out",
};

/**
 * Category label, prefixed with "≈" when the amount behind it is modeled.
 *
 * `isEstimate` comes from the engine, which derives it PER LINE — an expense
 * line's own `isEstimate` flag, plus the engine-computed categories (yield,
 * tax, credit interest) that are modeled by nature. It is deliberately not a
 * fixed list of categories any more: §1 makes "This is an estimate" a per-line
 * control, so a user-added row marked as an estimate has to render "≈", and the
 * seeded housing line must not.
 *
 * Depends on the label not at all — renaming a line never changes whether it is
 * an estimate.
 */
export function catLabel(cat: LedgerCategory, isEstimate = false): string {
  return `${isEstimate ? "≈ " : ""}${CATEGORY_LABELS[cat]}`;
}

/**
 * True when a transaction's label adds nothing to the category already shown,
 * so the Transactions view can drop the "· label" suffix.
 *
 * A label is redundant when it is the category's own name, OR the default label
 * a seeded expense line is created with ("Housing / rent" under Housing,
 * "Living spend" under Living) — otherwise every housing row would read
 * "Housing · Housing / rent".
 *
 * The test is on the LABEL being redundant, deliberately NOT on the line being
 * seeded: rename housing to "Mortgage" and the suffix comes back as
 * "Housing · Mortgage", which is informative and is exactly what a renamed user
 * row gets. Seeded rows get no special treatment here.
 */
export function isRedundantTransactionLabel(cat: LedgerCategory, label: string): boolean {
  if (label === CATEGORY_LABELS[cat]) return true;
  if (cat === "housing" || cat === "living") return label === SEEDED_LABELS[cat];
  return false;
}
