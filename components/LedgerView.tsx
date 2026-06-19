"use client";

import { Fragment, useState } from "react";
import type { LedgerCategory, SimulationResult } from "@/lib/engine/types";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";
import { SectionTitle } from "./ui";

const CATEGORY_LABELS: Record<LedgerCategory, string> = {
  income: "Income",
  housing: "Housing",
  living: "Living",
  oneTime: "One-time",
  assetSale: "Asset sale",
  tax: "Tax/penalty",
  creditInterest: "Credit interest",
  interestEarned: "Interest",
  tapIn: "Transfer in",
  tapOut: "Transfer out",
};

function Amount({ value }: { value: number }) {
  const color = value < 0 ? "text-red-600" : value > 0 ? "text-zinc-700" : "text-zinc-400";
  return <span className={`tabular-nums ${color}`}>{formatCurrency(value)}</span>;
}

export function LedgerView({ result }: { result: SimulationResult }) {
  const [mode, setMode] = useState<"monthly" | "transactions">("monthly");
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
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

      {mode === "monthly" ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
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
                                      {CATEGORY_LABELS[cat as LedgerCategory]} +{formatCurrency(v ?? 0)}
                                    </span>
                                  ))}
                                  {Object.entries(a.outflows).map(([cat, v]) => (
                                    <span key={cat} className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                                      {CATEGORY_LABELS[cat as LedgerCategory]} −{formatCurrency(v ?? 0)}
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
                    {CATEGORY_LABELS[t.category]} {t.label && t.label !== CATEGORY_LABELS[t.category] ? <span className="text-zinc-400">· {t.label}</span> : null}
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
