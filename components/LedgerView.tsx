"use client";

import { Fragment, useState } from "react";
import type { LedgerCategory, SimulationResult } from "@/lib/engine/types";
import { monthlyRowsCSV, transactionsCSV } from "@/lib/exporters";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";
import { SectionTitle } from "./ui";

/** Trigger a client-side file download of `text`. */
function download(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CATEGORY_LABELS: Record<LedgerCategory, string> = {
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
  "living", // target spend (an assumption, not a recorded transaction)
  "interestEarned", // yield, computed from a rate
  "tax", // estimated tax/penalty
  "creditInterest", // computed from an APR
]);

/** Category label, prefixed with "≈" when it's a modeled estimate. */
function catLabel(cat: LedgerCategory): string {
  return `${MODELED.has(cat) ? "≈ " : ""}${CATEGORY_LABELS[cat]}`;
}

function Amount({ value }: { value: number }) {
  const color = value < 0 ? "text-red-600" : value > 0 ? "text-zinc-700" : "text-zinc-400";
  return <span className={`tabular-nums ${color}`}>{formatCurrency(value)}</span>;
}

export function LedgerView({ result }: { result: SimulationResult }) {
  const [mode, setMode] = useState<"monthly" | "transactions">("monthly");
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <SectionTitle hint="The auditable trail behind every number">Ledger</SectionTitle>
        <div className="flex overflow-hidden rounded-lg border border-zinc-200 text-xs">
          {(["monthly", "transactions"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 ${mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
            >
              {m === "monthly" ? "Monthly" : "Transactions"}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <p className="text-xs text-zinc-500">
          A forward projection from your as-of date — not a bank statement.{" "}
          <span className="text-zinc-400">
            Lines marked “≈” are modeled estimates (spend, yield, taxes); the rest are inputs you entered.
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1 text-xs">
          <span className="text-zinc-400">Export</span>
          <button
            onClick={() => download("upward-ledger-monthly.csv", "text/csv", monthlyRowsCSV(result))}
            className="rounded border border-zinc-200 px-2 py-0.5 text-zinc-600 hover:bg-zinc-50"
          >
            Monthly CSV
          </button>
          <button
            onClick={() => download("upward-transactions.csv", "text/csv", transactionsCSV(result))}
            className="rounded border border-zinc-200 px-2 py-0.5 text-zinc-600 hover:bg-zinc-50"
          >
            Transactions CSV
          </button>
        </div>
      </div>

      {mode === "monthly" ? (
        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Opening</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {result.months.map((m) => {
                const open = openMonth === m.monthKey;
                return (
                  <Fragment key={m.monthKey}>
                    <tr
                      onClick={() => setOpenMonth(open ? null : m.monthKey)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-700">
                        <span className="mr-1 text-zinc-400">{open ? "▾" : "▸"}</span>
                        {formatMonthYear(m.date)}
                      </td>
                      <td className="px-3 py-2 text-right"><Amount value={m.totals.opening} /></td>
                      <td className="px-3 py-2 text-right text-emerald-600 tabular-nums">
                        {m.totals.inflow ? formatCurrency(m.totals.inflow) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600 tabular-nums">
                        {m.totals.outflow ? `−${formatCurrency(m.totals.outflow)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium"><Amount value={m.totals.closing} /></td>
                    </tr>
                    {open ? (
                      <tr className="bg-zinc-50/60">
                        <td colSpan={5} className="px-3 py-2">
                          <div className="space-y-1.5">
                            {m.accounts
                              .filter(
                                (a) =>
                                  Object.keys(a.inflows).length > 0 ||
                                  Object.keys(a.outflows).length > 0 ||
                                  a.opening !== 0 ||
                                  a.closing !== 0,
                              )
                              .map((a) => (
                                <div key={a.accountId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  <span className="w-40 shrink-0 font-medium text-zinc-600">{a.name}</span>
                                  <span className="text-zinc-400">open <Amount value={a.opening} /></span>
                                  {Object.entries(a.inflows).map(([cat, v]) => (
                                    <span key={cat} className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                      {catLabel(cat as LedgerCategory)} +{formatCurrency(v ?? 0)}
                                    </span>
                                  ))}
                                  {Object.entries(a.outflows).map(([cat, v]) => (
                                    <span key={cat} className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                                      {catLabel(cat as LedgerCategory)} −{formatCurrency(v ?? 0)}
                                    </span>
                                  ))}
                                  <span className="text-zinc-400">close <Amount value={a.closing} /></span>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {result.transactions.map((t, i) => (
                <tr key={i} className="hover:bg-zinc-50">
                  <td className="px-3 py-1.5 text-zinc-500">{formatDate(t.date)}</td>
                  <td className="px-3 py-1.5 text-zinc-700">{t.accountName}</td>
                  <td className="px-3 py-1.5 text-zinc-500">
                    {catLabel(t.category)} {t.label && t.label !== CATEGORY_LABELS[t.category] ? <span className="text-zinc-400">· {t.label}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right"><Amount value={t.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
