"use client";

// =============================================================================
// The expenses section — design package §1.
//
// One row component for every expense, seeded or user-added, in one list. The
// amount input is ALWAYS VISIBLE on the face: that is the whole point of the
// item. Housing and living spend are the first two rows and cannot be deleted
// or reordered — a position, not a capability, so there is no second class of
// row to learn.
//
// The Add expense modal survives for CREATION only: creating needs six
// decisions and an atomic commit, editing needs one keystroke on an amount.
// =============================================================================

import { useRef, useState } from "react";
import { amountForMonth, SEEDED_LABELS } from "@/lib/engine/expenses";
import type { FlowEvent, Scenario } from "@/lib/engine/types";
import { expenseMeta, expensesHeadline } from "@/lib/expenseSummary";
import { formatAmount, sanitizeAmountText, toAmount } from "@/lib/numberInput";
import { useNumericInput } from "./useNumericInput";

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
  onAdd: () => void;
  /** Per-line "vs baseline" hint, or undefined when there is no baseline. */
  hintFor?: (line: FlowEvent) => string | undefined;
}

export function ExpenseList({ scenario, onChange, onAdd, hintFor }: Props) {
  const lines = scenario.levers.expenseEvents ?? [];
  const seeded = lines.filter((l) => l.seeded);
  const added = lines.filter((l) => !l.seeded);

  const setLines = (next: FlowEvent[]) =>
    onChange({ ...scenario, levers: { ...scenario.levers, expenseEvents: next } });

  const patch = (id: string, p: Partial<FlowEvent>) =>
    setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const remove = (id: string) => setLines(lines.filter((l) => l.id !== id));

  const headline = expensesHeadline(lines, scenario.timeline.start, scenario.timeline.end);

  return (
    <section data-testid="expenses">
      <div className="sticky top-0 z-10 -mt-1 mb-2 flex items-center justify-between bg-white pb-1.5 pt-1">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-900">Expenses</h3>
          <p data-testid="expenses-headline" className="mt-0.5 truncate text-xs text-zinc-500">
            {headline}
          </p>
        </div>
        <button
          data-testid="lever-add-expense"
          onClick={onAdd}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-800"
        >
          + Add expense
        </button>
      </div>

      {/* Seeded rows stay pinned above the scroll area (§1). */}
      <div className="space-y-2">
        {seeded.map((line) => (
          <ExpenseRow
            key={line.id}
            line={line}
            scenario={scenario}
            hint={hintFor?.(line)}
            onPatch={(p) => patch(line.id, p)}
          />
        ))}
      </div>

      {/* Past six rows the list scrolls internally rather than growing. */}
      <div
        className={`space-y-2 ${added.length ? "mt-2" : ""} ${
          added.length > 4 ? "max-h-[520px] overflow-y-auto pr-1" : ""
        }`}
      >
        {added.map((line) => (
          <ExpenseRow
            key={line.id}
            line={line}
            scenario={scenario}
            hint={hintFor?.(line)}
            onPatch={(p) => patch(line.id, p)}
            onRemove={() => remove(line.id)}
          />
        ))}
      </div>
    </section>
  );
}

/** The always-visible amount field. One click, one keystroke, no modal. */
function AmountField({
  line,
  onChange,
}: {
  line: FlowEvent;
  onChange: (v: number) => void;
}) {
  const input = useNumericInput({
    value: line.amount,
    toText: String,
    sanitize: sanitizeAmountText,
    parse: (t) => toAmount(t, 0),
    onChange,
    format: formatAmount,
  });
  return (
    <div className="flex h-[34px] shrink-0 items-center rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-500">
      <span className="pl-2 text-sm text-zinc-400">$</span>
      <input
        type="text"
        data-testid={line.seeded ? `expense-amount-${line.seeded}` : undefined}
        aria-label={`${line.label}${line.isEstimate ? ", estimated" : ""} monthly amount`}
        {...input}
        className="w-[116px] bg-transparent px-2 text-right text-sm tabular-nums text-zinc-900 outline-none"
      />
    </div>
  );
}

function ExpenseRow({
  line,
  scenario,
  hint,
  onPatch,
  onRemove,
}: {
  line: FlowEvent;
  scenario: Scenario;
  hint?: string;
  onPatch: (p: Partial<FlowEvent>) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const caretRef = useRef<HTMLButtonElement>(null);
  const chips = expenseMeta(line);
  const drawerId = `expense-drawer-${line.id}`;

  return (
    <div
      data-testid={line.seeded ? `expense-row-${line.seeded}` : "expense-row"}
      className={`rounded-[10px] border bg-white px-3 py-2.5 ${
        open ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      {/* face — label · amount · caret. Never changes height when the drawer opens. */}
      <div className="flex h-[34px] items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900"
          title={line.label}
        >
          {/* The glyph is decorative — the word "estimate" in the meta line and
              the input's aria-label carry the fact. Color never carries it alone. */}
          {line.isEstimate ? <span aria-hidden="true">≈ </span> : null}
          {line.label}
        </span>
        <AmountField line={line} onChange={(v) => onPatch({ amount: v })} />
        <button
          ref={caretRef}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={drawerId}
          title={`Edit schedule for ${line.label}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          {open ? "▴" : "▾"}
        </button>
      </div>

      {/* meta line */}
      <div className="mt-[7px] flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500">
        {chips.map((chip, i) => (
          <span key={chip.text} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-zinc-300">·</span> : null}
            <span
              className={
                chip.kind === "cadence"
                  ? ""
                  : chip.kind === "estimate"
                    ? "rounded-[5px] bg-zinc-100 px-1.5 py-0.5 text-[11.5px] text-emerald-700"
                    : "rounded-[5px] bg-zinc-100 px-1.5 py-0.5 text-[11.5px] text-zinc-600"
              }
            >
              {chip.text}
            </span>
          </span>
        ))}
        {hint ? <span className="text-zinc-400">· {hint}</span> : null}
      </div>

      {open ? (
        <Drawer
          id={drawerId}
          line={line}
          scenario={scenario}
          onPatch={onPatch}
          onRemove={onRemove}
          onDone={() => {
            setOpen(false);
            caretRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function Drawer({
  id,
  line,
  scenario,
  onPatch,
  onRemove,
  onDone,
}: {
  id: string;
  line: FlowEvent;
  scenario: Scenario;
  onPatch: (p: Partial<FlowEvent>) => void;
  onRemove?: () => void;
  onDone: () => void;
}) {
  const field =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500";
  const recurring = line.kind === "recurring";

  return (
    <div
      id={id}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      className="mt-3 space-y-3 border-t border-zinc-100 pt-3"
    >
      {/* cadence */}
      <div className="flex overflow-hidden rounded-lg border border-zinc-200 text-xs">
        {([["recurring", "Recurring"], ["oneoff", "One-time"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => onPatch({ kind: k, ...(k === "oneoff" ? { endDate: undefined } : {}) })}
            className={`flex-1 px-3 py-1.5 ${
              line.kind === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            {recurring ? "Starts" : "On"}
          </span>
          <input
            type="date"
            value={line.startDate}
            onChange={(e) => onPatch({ startDate: e.target.value })}
            className={field}
          />
        </label>
        {recurring ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Ends (optional)</span>
            <input
              type="date"
              value={line.endDate ?? ""}
              onChange={(e) => onPatch({ endDate: e.target.value || undefined })}
              className={field}
            />
          </label>
        ) : null}
      </div>

      {/* step change — general to every line; replaced the bespoke housing pair */}
      {recurring ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={!!line.stepChange}
              onChange={(e) =>
                onPatch({
                  stepChange: e.target.checked
                    ? { date: scenario.timeline.start, newAmount: line.amount }
                    : undefined,
                })
              }
            />
            Amount changes later
          </label>
          {line.stepChange ? (
            <div className="grid grid-cols-2 gap-3 pl-5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">From</span>
                <input
                  type="date"
                  value={line.stepChange.date}
                  onChange={(e) =>
                    onPatch({ stepChange: { ...line.stepChange!, date: e.target.value } })
                  }
                  className={field}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">New amount</span>
                <StepAmount
                  value={line.stepChange.newAmount}
                  onChange={(v) => onPatch({ stepChange: { ...line.stepChange!, newAmount: v } })}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          checked={!!line.isEstimate}
          onChange={(e) => onPatch({ isEstimate: e.target.checked || undefined })}
        />
        This is an estimate (shows as ≈)
      </label>

      {line.seeded === "living" ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Upward treats this as an estimate. Change the amount any time — it stays an estimate
          unless you say otherwise.
        </p>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        {/* Seeded rows have no Remove: the button is ABSENT, not greyed (§1). */}
        {onRemove ? (
          <button
            onClick={onRemove}
            className="text-xs text-zinc-500 underline underline-offset-2 hover:text-red-600"
          >
            Remove
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onDone}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function StepAmount({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const input = useNumericInput({
    value,
    toText: String,
    sanitize: sanitizeAmountText,
    parse: (t) => toAmount(t, 0),
    onChange,
    format: formatAmount,
  });
  return (
    <div className="flex items-center rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-500">
      <span className="pl-2 text-sm text-zinc-400">$</span>
      <input
        type="text"
        {...input}
        className="w-full bg-transparent px-2 py-1.5 text-right text-sm tabular-nums text-zinc-900 outline-none"
      />
    </div>
  );
}

/** Re-exported so the levers panel can label a seeded row consistently. */
export { SEEDED_LABELS, amountForMonth };
