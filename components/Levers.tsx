"use client";

import { useState } from "react";
import { isCreditType } from "@/lib/engine/defaults";
import type { AssetSaleLever, FlowEvent, Levers as LeversType, Scenario } from "@/lib/engine/types";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { newExpenseId, newIncomeId } from "@/lib/scenario";
import { SALARY_ID } from "@/lib/sample";
import { targetSpendHint } from "@/lib/spendDelta";
import { FlowModal, type FlowDraft } from "./FlowModal";
import { NumberField } from "./ui";

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

interface LeversProps extends Props {
  /** The active baseline's non-housing spend — the working anchor the runway Δ
   *  and chart dashed overlay use (not the static scenario.baselineMonthlySpend). */
  baselineSpend: number;
}

type ModalState = { noun: "income" | "expense"; editing: FlowEvent | null };

export function Levers({ scenario, onChange, baselineSpend }: LeversProps) {
  const L = scenario.levers;
  const setLevers = (patch: Partial<LeversType>) =>
    onChange({ ...scenario, levers: { ...L, ...patch } });

  const [modal, setModal] = useState<ModalState | null>(null);

  const salary = L.incomeEvents.find((e) => e.id === SALARY_ID);
  const otherIncome = L.incomeEvents.filter((e) => e.id !== SALARY_ID);
  const expenses = L.expenseEvents ?? [];

  const setSalary = (amount: number) =>
    setLevers({ incomeEvents: L.incomeEvents.map((e) => (e.id === SALARY_ID ? { ...e, amount } : e)) });

  const submitFlow = (draft: FlowDraft) => {
    if (!modal) return;
    const { noun, editing } = modal;
    if (noun === "income") {
      const next = editing
        ? L.incomeEvents.map((e) => (e.id === editing.id ? { ...e, ...draft } : e))
        : [...L.incomeEvents, { id: newIncomeId(), ...draft }];
      setLevers({ incomeEvents: next });
    } else {
      const next = editing
        ? expenses.map((e) => (e.id === editing.id ? { ...e, ...draft } : e))
        : [...expenses, { id: newExpenseId(), ...draft }];
      setLevers({ expenseEvents: next });
    }
    setModal(null);
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        {/* ===== Income ===== */}
        <GroupHeader
          title="Income"
          addLabel="+ Add income"
          addTestId="lever-add-income"
          onAdd={() => setModal({ noun: "income", editing: null })}
        />

        {salary ? (
          <div className="mb-3">
            <NumberField
              label="Salary / primary income"
              value={salary.amount}
              onChange={setSalary}
              hint="Ongoing paycheck, if any — $0 if income has paused."
              testId="lever-salary"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          {otherIncome.map((e) => (
            <FlowRow
              key={e.id}
              event={e}
              onEdit={() => setModal({ noun: "income", editing: e })}
              onDelete={() => setLevers({ incomeEvents: L.incomeEvents.filter((x) => x.id !== e.id) })}
            />
          ))}
        </div>

        {/* ===== Expenses ===== */}
        <div className="mt-5">
          <GroupHeader
            title="Expenses"
            addLabel="+ Add expense"
            addTestId="lever-add-expense"
            onAdd={() => setModal({ noun: "expense", editing: null })}
          />
        </div>

        <Housing scenario={scenario} onChange={onChange} />

        <div className="mt-2">
          <NumberField
            label="Target monthly spend (non-housing)"
            value={L.targetMonthlySpend}
            onChange={(v) => setLevers({ targetMonthlySpend: v })}
            hint={targetSpendHint(L.targetMonthlySpend, baselineSpend)}
            testId="lever-target-spend"
            hintTestId="lever-target-spend-hint"
          />
        </div>

        <div className="mt-2 space-y-2">
          {expenses.map((e) => (
            <FlowRow
              key={e.id}
              event={e}
              onEdit={() => setModal({ noun: "expense", editing: e })}
              onDelete={() => setLevers({ expenseEvents: expenses.filter((x) => x.id !== e.id) })}
            />
          ))}
        </div>

        {/* ===== Major asset sale ===== */}
        <div className="mt-5">
          <AssetSale scenario={scenario} onChange={onChange} />
        </div>
      </div>

      {modal ? (
        <FlowModal
          key={modal.editing?.id ?? "new"}
          title={`${modal.editing ? "Edit" : "Add"} ${modal.noun}`}
          noun={modal.noun}
          initial={modal.editing ? { ...modal.editing } : null}
          defaultDate={scenario.timeline.start}
          onSubmit={submitFlow}
          onClose={() => setModal(null)}
        />
      ) : null}
    </section>
  );
}

function GroupHeader({
  title,
  addLabel,
  addTestId,
  onAdd,
}: {
  title: string;
  addLabel: string;
  addTestId?: string;
  onAdd: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 -mt-1 mb-2 flex items-center justify-between bg-white pb-1.5 pt-1">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <button
        data-testid={addTestId}
        onClick={onAdd}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-800"
      >
        {addLabel}
      </button>
    </div>
  );
}

/** Inline summary of an added income/expense; clicking it reopens the modal. */
function FlowRow({ event, onEdit, onDelete }: { event: FlowEvent; onEdit: () => void; onDelete: () => void }) {
  const timing =
    event.kind === "recurring"
      ? `Monthly · from ${formatMonthYear(event.startDate)}${event.endDate ? ` through ${formatMonthYear(event.endDate)}` : " (ongoing)"}`
      : `One-time · ${formatMonthYear(event.startDate)}`;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2">
      <button onClick={onEdit} className="min-w-0 flex-1 text-left" title="Edit">
        <div className="truncate text-sm font-medium text-zinc-900">{event.label}</div>
        <div className="truncate text-[11px] text-zinc-500">{timing}</div>
      </button>
      <span className="shrink-0 text-sm tabular-nums text-zinc-700">{formatCurrency(event.amount)}</span>
      <button
        onClick={onDelete}
        className="shrink-0 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function Housing({ scenario, onChange }: Props) {
  const L = scenario.levers;
  const setLevers = (patch: Partial<LeversType>) => onChange({ ...scenario, levers: { ...L, ...patch } });
  return (
    <div className="space-y-2">
      <NumberField
        label="Housing / rent (monthly)"
        value={L.housing.monthlyAmount}
        onChange={(v) => setLevers({ housing: { ...L.housing, monthlyAmount: v } })}
        testId="lever-housing"
      />
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          checked={!!L.housing.change}
          onChange={(e) =>
            setLevers({
              housing: {
                ...L.housing,
                change: e.target.checked
                  ? { date: scenario.timeline.start, newAmount: L.housing.monthlyAmount }
                  : undefined,
              },
            })
          }
        />
        Housing cost changes later (e.g. a sublet)
      </label>
      {L.housing.change ? (
        <div className="grid grid-cols-2 gap-2 pl-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">From date</span>
            <input
              type="date"
              value={L.housing.change.date}
              onChange={(e) =>
                setLevers({ housing: { ...L.housing, change: { ...L.housing.change!, date: e.target.value } } })
              }
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </label>
          <NumberField
            label="New amount"
            value={L.housing.change.newAmount}
            onChange={(v) => setLevers({ housing: { ...L.housing, change: { ...L.housing.change!, newAmount: v } } })}
          />
        </div>
      ) : null}
    </div>
  );
}

function defaultAssetSale(scenario: Scenario): AssetSaleLever {
  return {
    enabled: true,
    label: "Property sale",
    saleDate: scenario.timeline.start,
    salePrice: 500_000,
    closingCostPct: 0.06,
    loanPayoff: 300_000,
    costBasis: 350_000,
    capGainsRate: 0.15,
    taxTiming: "next_april",
  };
}

function AssetSale({ scenario, onChange }: Props) {
  const L = scenario.levers;
  const sale = L.assetSale;
  const setSale = (next: AssetSaleLever | undefined) =>
    onChange({ ...scenario, levers: { ...L, assetSale: next } });
  const patch = (p: Partial<AssetSaleLever>) => {
    if (!sale) return;
    setSale({ ...sale, ...p });
  };

  const creditAccounts = scenario.accounts.filter((a) => isCreditType(a.type));
  const netPreview = sale ? sale.salePrice - sale.salePrice * sale.closingCostPct - sale.loanPayoff : 0;
  const gainPreview = sale ? Math.max(0, sale.salePrice - sale.costBasis) * sale.capGainsRate : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-base font-semibold text-zinc-900">Major asset sale</span>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={!!sale?.enabled}
            onChange={(e) =>
              e.target.checked
                ? setSale(defaultAssetSale(scenario))
                : sale
                  ? patch({ enabled: false })
                  : undefined
            }
          />
          Model a sale (e.g. property)
        </label>
      </div>

      {sale?.enabled ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 p-2.5">
          <input
            value={sale.label}
            onChange={(e) => patch({ label: e.target.value })}
            className="w-full rounded border border-transparent px-1.5 py-1 text-sm font-medium text-zinc-900 hover:border-zinc-200 focus:border-zinc-400 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Sale date</span>
              <input
                type="date"
                value={sale.saleDate}
                onChange={(e) => patch({ saleDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>
            <NumberField label="Sale price" value={sale.salePrice} step={5000} onChange={(v) => patch({ salePrice: v })} />
            <PctField label="Closing costs" value={sale.closingCostPct} onChange={(v) => patch({ closingCostPct: v })} />
            <NumberField label="Loan / lien payoff" value={sale.loanPayoff} step={5000} onChange={(v) => patch({ loanPayoff: v })} />
            <NumberField label="Cost basis" value={sale.costBasis} step={5000} onChange={(v) => patch({ costBasis: v })} />
            <PctField label="Cap-gains rate" value={sale.capGainsRate} onChange={(v) => patch({ capGainsRate: v })} />
            <NumberField
              label="Monthly income stops"
              value={sale.associatedMonthlyIncomeToStop ?? 0}
              onChange={(v) => patch({ associatedMonthlyIncomeToStop: v || undefined })}
            />
            <NumberField
              label="Monthly carrying cost"
              value={sale.associatedMonthlyCostToStop ?? 0}
              onChange={(v) => patch({ associatedMonthlyCostToStop: v || undefined })}
            />
          </div>
          {creditAccounts.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Tied credit line to pay off</span>
              <select
                value={sale.tiedCreditAccountId ?? ""}
                onChange={(e) => patch({ tiedCreditAccountId: e.target.value || undefined })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              >
                <option value="">None</option>
                {creditAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || "Credit line"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-[11px] text-zinc-500">
            Net proceeds ≈ <span className="font-medium text-zinc-700">{formatCurrency(netPreview)}</span>
            {sale.tiedCreditAccountId ? " (less any drawn balance on the tied line)" : ""} · cap-gains tax ≈{" "}
            <span className="font-medium text-zinc-700">{formatCurrency(gainPreview)}</span> due the following April.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PctField({
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
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-zinc-500">
        <input
          type="number"
          value={Math.round(value * 1000) / 10}
          step={0.5}
          min={0}
          onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
          className="w-full bg-transparent px-2 py-1.5 text-right text-sm tabular-nums text-zinc-900 outline-none"
        />
        <span className="pr-2 text-sm text-zinc-400">%</span>
      </div>
    </label>
  );
}
