"use client";

import type { IncomeEvent, Levers as LeversType, OneTimeEvent, Scenario } from "@/lib/engine/types";
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
    </section>
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
