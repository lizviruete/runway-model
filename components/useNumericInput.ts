"use client";

import { useState } from "react";

/** Block keys that would form a negative or exponent in a `type="number"` field
 *  (used by the percent fields, which keep their native 0.5-step spinners). */
export function blockSignKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
    e.preventDefault();
  }
}

/**
 * Shared behavior for every free-text numeric input (amounts + percentages).
 * Holds an internal text buffer so partial/zero edits display cleanly and a
 * sanitized/clamped value can't get stuck in the DOM; selects-all on focus so
 * typing replaces a `0`; re-syncs when the model `value` changes externally.
 *
 * Returns props to spread onto a plain `<input>` (`value`, `onFocus`,
 * `onChange`, `onBlur`, `inputMode`) — the caller keeps its own styling/testid.
 */
export function useNumericInput(opts: {
  value: number;
  /** Model number → display text. */
  toText: (v: number) => string;
  /** Raw keystroke text → sanitized display text. */
  sanitize: (raw: string) => string;
  /** Sanitized display text → model number (clamped). */
  parse: (text: string) => number;
  onChange: (v: number) => void;
  inputMode?: "numeric" | "decimal";
}) {
  const { value, toText, sanitize, parse, onChange, inputMode = "numeric" } = opts;
  const [text, setText] = useState(() => toText(value));
  // "Adjust state on prop change during render" — re-sync when `value` changes
  // from outside (preset applied, scenario loaded), without an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(toText(value));
  }

  return {
    value: text,
    inputMode,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = sanitize(e.currentTarget.value);
      if (clean === text) {
        // Sanitized to no net change (a pure-junk keystroke like a letter or
        // `-`). React would bail out of the re-render and leave the junk in the
        // DOM, so reset the node directly.
        e.currentTarget.value = clean;
        return;
      }
      setText(clean);
      const next = parse(clean);
      setLastValue(next); // we own this change — don't let the sync clobber `text`
      onChange(next);
    },
    onBlur: () => setText(toText(value)),
  };
}
