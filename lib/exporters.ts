// Lightweight ledger exporters. The simulation result is already fully
// serializable, so these are pure string builders — no formatting, no deps.

import type { LedgerCategory, SimulationResult } from "./engine/types";

/** Stable category column order for the monthly CSV. */
const CATEGORIES: LedgerCategory[] = [
  "income",
  "housing",
  "living",
  "expense",
  "assetSale",
  "assetCarry",
  "tax",
  "creditInterest",
  "interestEarned",
  "tapIn",
  "tapOut",
];

/** Quote a CSV cell only when needed (comma, quote, or newline). */
function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}

/**
 * Per-account monthly rows: one line per account per month, with each category
 * as a signed net (inflow − outflow), plus opening/closing.
 */
export function monthlyRowsCSV(result: SimulationResult): string {
  const header = ["month", "account", "type", "opening", ...CATEGORIES, "closing"];
  const rows: (string | number)[][] = [header];
  for (const m of result.months) {
    for (const a of m.accounts) {
      const cats = CATEGORIES.map((c) => (a.inflows[c] ?? 0) - (a.outflows[c] ?? 0));
      rows.push([m.monthKey, a.name, a.type, a.opening, ...cats, a.closing]);
    }
  }
  return toCSV(rows);
}

/** The flat, dated transaction list. */
export function transactionsCSV(result: SimulationResult): string {
  const header = ["date", "month", "account", "category", "amount", "label"];
  const rows: (string | number)[][] = [header];
  for (const t of result.transactions) {
    rows.push([t.date, t.monthKey, t.accountName, t.category, t.amount, t.label]);
  }
  return toCSV(rows);
}

/** Everything an audit needs, as JSON: monthly ledger + transactions + taxes. */
export function ledgerJSON(result: SimulationResult): string {
  return JSON.stringify(
    {
      months: result.months,
      transactions: result.transactions,
      scheduledTaxes: result.scheduledTaxes,
    },
    null,
    2,
  );
}
