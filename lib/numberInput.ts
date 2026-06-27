// =============================================================================
// Shared sanitization for every free-text numeric input (amounts + percentages).
// Single source of truth so accounts, levers, income/one-time events, and the
// asset-sale fields all behave consistently:
//   - typing over a `0` is clean (leading zeros stripped)
//   - empty coerces to 0 for the engine (never NaN/blank)
//   - negatives are impossible (leading `-` and non-numeric junk stripped)
//   - amounts are whole numbers; a stray decimal drops the fraction (1234.56 →
//     1234) so it can't silently 100x a value. Percentages keep one decimal.
// =============================================================================

/** Sanitize an amount field's raw text → digits only, leading zeros stripped,
 *  any fractional part dropped. `""` stays `""` (an in-progress empty field). */
export function sanitizeAmountText(raw: string): string {
  const digits = raw.replace(/[^0-9.]/g, ""); // keep digits + dot, drop sign/junk
  const whole = digits.split(".")[0]; // drop any fractional part entirely
  return stripLeadingZeros(whole);
}

/** Sanitize a percent field's raw text → digits + at most one decimal point,
 *  leading zeros stripped (but a leading `0.` is preserved). No sign. */
export function sanitizePercentText(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const text =
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  // Keep one digit after the dot to match the field's existing precision.
  const [int, frac] = text.split(".");
  const intPart = stripLeadingZeros(int);
  if (frac === undefined) return intPart;
  return `${intPart === "" ? "0" : intPart}.${frac.slice(0, 1)}`;
}

/** Strip leading zeros while keeping a lone `0` (and `""`). */
function stripLeadingZeros(s: string): string {
  if (s === "") return "";
  const stripped = s.replace(/^0+(?=\d)/, "");
  return stripped === "" ? "0" : stripped;
}

/** Parse sanitized text → a number clamped to `>= min`. Empty/invalid → `min`. */
export function toClamped(text: string, min = 0): number {
  if (text === "" || text === ".") return min;
  const n = Number(text);
  return Number.isFinite(n) ? Math.max(min, n) : min;
}

// --- percent helpers ---------------------------------------------------------
// Percent fields model a fraction (0.06) but display a percentage (6 / 7.5),
// keeping one decimal of precision.

/** A stored fraction → its percent display string (one decimal max). */
export function percentToText(fraction: number): string {
  return String(Math.round(fraction * 1000) / 10);
}

/** Sanitized percent text → the stored fraction, clamped to `>= 0`. */
export function textToPercent(text: string): number {
  return Math.max(0, (Number(text) || 0) / 100);
}
