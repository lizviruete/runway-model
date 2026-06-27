"use client";

import { useEffect, useState } from "react";
import { sanitizeAmountText, toAmount } from "@/lib/numberInput";

export interface FlowDraft {
  label: string;
  kind: "recurring" | "oneoff";
  amount: number;
  startDate: string;
  endDate?: string;
}

interface Props {
  title: string;
  noun: "income" | "expense";
  /** Existing values when editing; null when adding (empty placeholders). */
  initial: FlowDraft | null;
  /** Anchor date used as the default for a new event. */
  defaultDate: string;
  onSubmit: (draft: FlowDraft) => void;
  onClose: () => void;
}

/** Modal to add or edit a recurring/one-time income or expense. */
export function FlowModal({ title, noun, initial, defaultDate, onSubmit, onClose }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [kind, setKind] = useState<"recurring" | "oneoff">(initial?.kind ?? "recurring");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const placeholder = noun === "income" ? "e.g. Severance, rental income" : "e.g. Childcare, loan payment";

  const submit = () => {
    onSubmit({
      label: label.trim() || (noun === "income" ? "Income" : "Expense"),
      kind,
      amount: toAmount(amount),
      startDate,
      endDate: kind === "recurring" && endDate ? endDate : undefined,
    });
  };

  const fieldClass =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold text-zinc-900">{title}</h3>

        {/* timing */}
        <div className="mb-3 flex overflow-hidden rounded-lg border border-zinc-200 text-xs">
          {([["recurring", "Recurring"], ["oneoff", "One-time"]] as const).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 px-3 py-1.5 ${kind === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} className={fieldClass} />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            {kind === "recurring" ? "Monthly amount" : "Amount"}
          </span>
          <div className="flex items-center rounded-lg border border-zinc-300 focus-within:border-zinc-500">
            <span className="pl-2.5 text-sm text-zinc-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const clean = sanitizeAmountText(e.currentTarget.value);
                // Pure-junk keystroke (letter, `-`): React would bail and leave
                // it in the DOM, so reset the node directly.
                if (clean === amount) {
                  e.currentTarget.value = clean;
                  return;
                }
                setAmount(clean);
              }}
              placeholder="0"
              className="w-full bg-transparent px-2 py-1.5 text-sm tabular-nums text-zinc-900 outline-none"
            />
          </div>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">{kind === "recurring" ? "Starts" : "On"}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
          </label>
          {kind === "recurring" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Ends (optional)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">
            Cancel
          </button>
          <button onClick={submit} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
