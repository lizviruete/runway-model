// Small shared presentational primitives.
"use client";
import type { ReactNode } from "react";
import type { AccountType } from "@/lib/engine/types";
import { formatAmount, sanitizeAmountText, toAmount } from "@/lib/numberInput";
import { useNumericInput } from "./useNumericInput";

/** Consistent per-account-type accent colors across chart + list. */
export const TYPE_COLORS: Record<AccountType, string> = {
  checking: "#34d399",
  savings: "#22d3ee",
  hysa: "#38bdf8",
  brokerage: "#818cf8",
  roth: "#c084fc",
  pretax: "#f472b6",
  credit_line: "#fb923c",
  other: "#a3a3a3",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {children}
      </h2>
      {hint ? <span className="text-xs text-zinc-400">{hint}</span> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  prefix = "$",
  min = 0,
  hint,
  testId,
  hintTestId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  min?: number;
  hint?: ReactNode;
  testId?: string;
  hintTestId?: string;
}) {
  const input = useNumericInput({
    value,
    toText: String,
    sanitize: sanitizeAmountText,
    parse: (t) => toAmount(t, min),
    onChange,
    format: formatAmount,
  });

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex items-center rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
        {prefix ? <span className="pl-2.5 text-sm text-zinc-400">{prefix}</span> : null}
        <input
          type="text"
          data-testid={testId}
          {...input}
          className="w-full bg-transparent px-2 py-1.5 text-sm tabular-nums text-zinc-900 outline-none"
        />
      </div>
      {hint ? (
        <span data-testid={hintTestId} className="mt-1 block text-xs text-zinc-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
