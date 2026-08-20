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
  tapIn: "Transfer in",
  tapOut: "Transfer out",
};

/** Categories that are MODELED estimates (computed from assumptions) rather
 *  than known inputs you entered. Marked with "≈" so the audit trail is honest
 *  about what is projected vs. what is given. */
const MODELED: ReadonlySet<LedgerCategory> = new Set<LedgerCategory>([
  "living", // living spend (an assumption, not a recorded transaction)
  "interestEarned", // yield, computed from a rate
  "tax", // estimated tax/penalty
  "creditInterest", // computed from an APR
]);

/** Category label, prefixed with "≈" when it's a modeled estimate. Depends on
 *  the CATEGORY only — the monthly ledger view is unaffected by line labels. */
export function catLabel(cat: LedgerCategory): string {
  return `${MODELED.has(cat) ? "≈ " : ""}${CATEGORY_LABELS[cat]}`;
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
