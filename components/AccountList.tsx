"use client";

import { useState } from "react";
import { ACCOUNT_TYPE_META, ACCOUNT_TYPE_ORDER, isCreditType } from "@/lib/engine/defaults";
import type { Account, AccountType, Scenario } from "@/lib/engine/types";
import { formatCurrency } from "@/lib/format";
import {
  applyTypeDefaults,
  moveAccount,
  newAccount,
  renumber,
  updateAccount,
} from "@/lib/scenario";
import {
  percentToText,
  sanitizeAmountText,
  textToPercent,
  toAmount,
} from "@/lib/numberInput";
import { TYPE_COLORS } from "./ui";
import { blockSignKeys, useNumericInput } from "./useNumericInput";

/** $ balance field — shared sanitized numeric behavior (extracted so it can use
 *  the hook outside the account `.map`). */
function BalanceField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const input = useNumericInput({
    value,
    toText: String,
    sanitize: sanitizeAmountText,
    parse: (t) => toAmount(t, 0),
    onChange,
  });
  return (
    <div className="flex shrink-0 items-center rounded border border-zinc-200">
      <span className="pl-1.5 text-xs text-zinc-400">$</span>
      <input
        type="text"
        {...input}
        className="w-24 bg-transparent px-1 py-1 text-right text-sm tabular-nums text-zinc-900 outline-none"
      />
    </div>
  );
}

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

export function AccountList({ scenario, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const accounts = scenario.accounts;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAccounts = (next: Account[]) => onChange({ ...scenario, accounts: next });

  const reorder = (from: number, to: number) => setAccounts(moveAccount(accounts, from, to));

  const addAccount = () =>
    setAccounts([...accounts, newAccount("savings", accounts.length + 1)]);

  const deleteAccount = (id: string) =>
    setAccounts(renumber(accounts.filter((a) => a.id !== id)));

  const totalAssets = accounts
    .filter((a) => !isCreditType(a.type))
    .reduce((s, a) => s + a.balance, 0);

  return (
    <section data-testid="accounts">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Accounts</h2>
          <span className="text-xs text-zinc-400">
            {formatCurrency(totalAssets)} in assets · drag to set tap order
          </span>
        </div>
        <button
          data-testid="account-add"
          onClick={addAccount}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-800"
        >
          + Add account
        </button>
      </div>

      <div className="-mr-1 max-h-[20rem] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account, i) => {
          const meta = ACCOUNT_TYPE_META[account.type];
          const credit = isCreditType(account.type);
          const isOpen = expanded.has(account.id);
          return (
            <div
              key={account.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`rounded-lg border bg-white p-2.5 ${
                dragIndex === i ? "border-zinc-400 opacity-60" : "border-zinc-200"
              }`}
            >
              {/* line 1: priority chip · name · balance · delete */}
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-[10px] font-semibold text-white"
                  style={{ background: TYPE_COLORS[account.type] }}
                  title={`Priority ${i + 1} — drag to reorder`}
                >
                  {i + 1}
                </span>
                <input
                  value={account.name}
                  placeholder={meta.label}
                  onChange={(e) => onChange(updateAccount(scenario, account.id, { name: e.target.value }))}
                  className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-400 focus:outline-none"
                />
                <BalanceField
                  value={account.balance}
                  onChange={(v) => onChange(updateAccount(scenario, account.id, { balance: v }))}
                />
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="shrink-0 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  title="Delete account"
                >
                  ✕
                </button>
              </div>

              {/* line 2: type select · expand (drag the number chip to reorder) */}
              <div className="mt-1.5 flex items-center gap-2 pl-8">
                <select
                  value={account.type}
                  onChange={(e) =>
                    setAccounts(
                      accounts.map((a) =>
                        a.id === account.id ? applyTypeDefaults(a, e.target.value as AccountType) : a,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 truncate rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-900"
                >
                  {ACCOUNT_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => toggle(account.id)}
                  className="shrink-0 rounded px-1.5 text-xs text-zinc-400 hover:bg-zinc-100"
                  title="Edit tax / cost implications"
                >
                  {isOpen ? "▴" : "▾"}
                </button>
              </div>

              {/* helper line + computed ongoing cost */}
              <p className="mt-1 pl-8 text-[11px] text-zinc-400">
                {credit ? "Available credit · " : ""}
                {meta.helper}
                <OngoingCostNote account={account} />
              </p>

              {isOpen ? <Implications scenario={scenario} account={account} onChange={onChange} /> : null}
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}

/** Computed monthly carrying cost / yield, surfaced per account. */
function OngoingCostNote({ account }: { account: Account }) {
  const { kind, annualRate } = account.ongoingCost;
  if (annualRate <= 0) return null;
  if (kind === "interest_earned") {
    const monthly = (account.balance * annualRate) / 12;
    return (
      <span className="text-emerald-600">
        {" "}· earns ≈ {formatCurrency(monthly)}/mo at this balance
      </span>
    );
  }
  if (kind === "credit_interest") {
    const per10k = (10_000 * annualRate) / 12;
    return (
      <span className="text-amber-600">
        {" "}· ≈ {formatCurrency(per10k)}/mo interest per $10k drawn
      </span>
    );
  }
  return null;
}

function Pct({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-zinc-500">{label}</span>
      <div className="flex items-center rounded border border-zinc-200">
        <input
          type="number"
          value={percentToText(value)}
          step={0.5}
          min={0}
          onKeyDown={blockSignKeys}
          onChange={(e) => onChange(textToPercent(e.target.value))}
          className="w-full bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-zinc-900 outline-none"
        />
        <span className="pr-1.5 text-xs text-zinc-400">%</span>
      </div>
    </label>
  );
}

function Implications({
  scenario,
  account,
  onChange,
}: {
  scenario: Scenario;
  account: Account;
  onChange: (next: Scenario) => void;
}) {
  const credit = isCreditType(account.type);
  const tax = account.taxTreatment;
  const cost = account.ongoingCost;
  const patchTax = (p: Partial<typeof tax>) =>
    onChange(updateAccount(scenario, account.id, { taxTreatment: { ...tax, ...p } }));
  const patchCost = (p: Partial<typeof cost>) =>
    onChange(updateAccount(scenario, account.id, { ongoingCost: { ...cost, ...p } }));

  const isTaxable = tax.effectiveRate > 0 || tax.taxableFraction > 0 || account.type !== "other";

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 sm:grid-cols-3">
      {credit ? (
        <Pct label="Interest rate (APR)" value={cost.annualRate} onChange={(v) => patchCost({ annualRate: v })} />
      ) : null}
      {cost.kind === "interest_earned" ? (
        <Pct label="Yield (APY)" value={cost.annualRate} onChange={(v) => patchCost({ annualRate: v })} />
      ) : null}
      {!credit && isTaxable ? (
        <>
          <Pct label="Effective tax rate" value={tax.effectiveRate} onChange={(v) => patchTax({ effectiveRate: v })} />
          <Pct label="Taxable fraction" value={tax.taxableFraction} onChange={(v) => patchTax({ taxableFraction: v })} />
          <Pct label="Early penalty" value={tax.earlyPenaltyRate} onChange={(v) => patchTax({ earlyPenaltyRate: v })} />
          <Pct label="Penalized fraction" value={tax.penalizedFraction} onChange={(v) => patchTax({ penalizedFraction: v })} />
        </>
      ) : null}
      <label className="col-span-2 block sm:col-span-3">
        <span className="mb-0.5 block text-[11px] text-zinc-500">Note</span>
        <input
          value={account.userNote ?? ""}
          placeholder="Optional — document anything relevant"
          onChange={(e) => onChange(updateAccount(scenario, account.id, { userNote: e.target.value }))}
          className="w-full rounded border border-zinc-200 px-1.5 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400"
        />
      </label>
    </div>
  );
}
