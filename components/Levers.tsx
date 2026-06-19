"use client";

import { isCreditType } from "@/lib/engine/defaults";
import type {
  AssetSaleLever,
  IncomeEvent,
  Levers as LeversType,
  OneTimeEvent,
  Scenario,
} from "@/lib/engine/types";
import { formatCurrency } from "@/lib/format";
import { newEventId, newIncomeId } from "@/lib/scenario";
import { NumberField, SectionTitle } from "./ui";

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}

export function Levers({ scenario, onChange }: Props) {
  const L = scenario.levers;
  const setLevers = (patch: Partial<LeversType>) =>
    onChange({ ...scenario, levers: { ...L, ...patch } });

  const baseline = scenario.baselineMonthlySpend ?? L.targetMonthlySpend;
  const spendDelta = L.targetMonthlySpend - baseline;

  return (
    <section className="space-y-5">
      <SectionTitle>Levers</SectionTitle>

      {/* Housing */}
      <div className="space-y-2">
        <NumberField
          label="Housing / rent (monthly)"
          value={L.housing.monthlyAmount}
          onChange={(v) => setLevers({ housing: { ...L.housing, monthlyAmount: v } })}
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
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
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

      {/* Target spend */}
      <NumberField
        label="Target monthly spend (non-housing)"
        value={L.targetMonthlySpend}
        onChange={(v) => setLevers({ targetMonthlySpend: v })}
        hint={
          spendDelta === 0
            ? "Same as baseline"
            : `${formatCurrency(spendDelta, { sign: true })}/mo vs. baseline (${formatCurrency(baseline)})`
        }
      />

      {/* Income streams */}
      <IncomeEvents scenario={scenario} onChange={onChange} />

      {/* One-time events */}
      <OneTimeEvents scenario={scenario} onChange={onChange} />

      {/* Major asset sale */}
      <AssetSale scenario={scenario} onChange={onChange} />
    </section>
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
  const netPreview = sale
    ? sale.salePrice - sale.salePrice * sale.closingCostPct - sale.loanPayoff
    : 0;
  const gainPreview = sale ? Math.max(0, sale.salePrice - sale.costBasis) * sale.capGainsRate : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">Major asset sale</span>
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
            className="w-full rounded border border-transparent px-1.5 py-1 text-sm font-medium hover:border-zinc-200 focus:border-zinc-400 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Sale date</span>
              <input
                type="date"
                value={sale.saleDate}
                onChange={(e) => patch({ saleDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
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
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
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
          className="w-full bg-transparent px-2 py-1.5 text-right text-sm tabular-nums outline-none"
        />
        <span className="pr-2 text-sm text-zinc-400">%</span>
      </div>
    </label>
  );
}

function IncomeEvents({ scenario, onChange }: Props) {
  const L = scenario.levers;
  const setEvents = (incomeEvents: IncomeEvent[]) =>
    onChange({ ...scenario, levers: { ...L, incomeEvents } });

  const update = (id: string, patch: Partial<IncomeEvent>) =>
    setEvents(L.incomeEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = () =>
    setEvents([
      ...L.incomeEvents,
      {
        id: newIncomeId(),
        label: "Income",
        kind: "recurring",
        amount: 3000,
        startDate: scenario.timeline.start,
      },
    ]);

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-zinc-600">Income</div>
      <div className="space-y-2">
        {L.incomeEvents.map((e) => (
          <div key={e.id} className="rounded-lg border border-zinc-200 p-2">
            <div className="flex items-center gap-2">
              <input
                value={e.label}
                onChange={(ev) => update(e.id, { label: ev.target.value })}
                className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-sm font-medium hover:border-zinc-200 focus:border-zinc-400 focus:outline-none"
              />
              <select
                value={e.kind}
                onChange={(ev) => update(e.id, { kind: ev.target.value as IncomeEvent["kind"] })}
                className="rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-600"
              >
                <option value="recurring">Monthly</option>
                <option value="oneoff">One-off</option>
              </select>
              <div className="flex items-center rounded border border-zinc-200">
                <span className="pl-1.5 text-xs text-zinc-400">$</span>
                <input
                  type="number"
                  value={e.amount}
                  step={100}
                  onChange={(ev) => update(e.id, { amount: Number(ev.target.value) || 0 })}
                  className="w-20 bg-transparent px-1 py-1 text-right text-sm tabular-nums outline-none"
                />
              </div>
              <button
                onClick={() => setEvents(L.incomeEvents.filter((x) => x.id !== e.id))}
                className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 pl-1 text-[11px] text-zinc-500">
              <span>{e.kind === "recurring" ? "From" : "On"}</span>
              <input
                type="date"
                value={e.startDate}
                onChange={(ev) => update(e.id, { startDate: ev.target.value })}
                className="rounded border border-zinc-200 px-1 py-0.5 text-[11px] outline-none focus:border-zinc-400"
              />
              {e.kind === "recurring" ? (
                <>
                  <span>through</span>
                  <input
                    type="date"
                    value={e.endDate ?? ""}
                    onChange={(ev) => update(e.id, { endDate: ev.target.value || undefined })}
                    className="rounded border border-zinc-200 px-1 py-0.5 text-[11px] outline-none focus:border-zinc-400"
                  />
                  {!e.endDate ? <span className="text-zinc-400">(ongoing)</span> : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        + Add income
      </button>
    </div>
  );
}

function OneTimeEvents({ scenario, onChange }: Props) {
  const L = scenario.levers;
  const setEvents = (oneTimeEvents: OneTimeEvent[]) =>
    onChange({ ...scenario, levers: { ...L, oneTimeEvents } });

  const update = (id: string, patch: Partial<OneTimeEvent>) =>
    setEvents(L.oneTimeEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = () =>
    setEvents([
      ...L.oneTimeEvents,
      { id: newEventId(), label: "One-time", date: scenario.timeline.start, amount: 1000, direction: "inflow" },
    ]);

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-zinc-600">One-time inflows / outflows</div>
      <div className="space-y-2">
        {L.oneTimeEvents.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2">
            <input
              value={e.label}
              onChange={(ev) => update(e.id, { label: ev.target.value })}
              className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-sm hover:border-zinc-200 focus:border-zinc-400 focus:outline-none"
            />
            <select
              value={e.direction}
              onChange={(ev) => update(e.id, { direction: ev.target.value as OneTimeEvent["direction"] })}
              className="rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-600"
            >
              <option value="inflow">In</option>
              <option value="outflow">Out</option>
            </select>
            <input
              type="date"
              value={e.date}
              onChange={(ev) => update(e.id, { date: ev.target.value })}
              className="rounded border border-zinc-200 px-1 py-1 text-[11px] outline-none focus:border-zinc-400"
            />
            <div className="flex items-center rounded border border-zinc-200">
              <span className="pl-1.5 text-xs text-zinc-400">$</span>
              <input
                type="number"
                value={e.amount}
                step={100}
                onChange={(ev) => update(e.id, { amount: Number(ev.target.value) || 0 })}
                className="w-20 bg-transparent px-1 py-1 text-right text-sm tabular-nums outline-none"
              />
            </div>
            <button
              onClick={() => setEvents(L.oneTimeEvents.filter((x) => x.id !== e.id))}
              className="rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
      >
        + Add one-time event
      </button>
    </div>
  );
}
