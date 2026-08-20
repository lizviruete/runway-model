// =============================================================================
// Account assumptions — the copy for the shared Assumptions panel (§2 + §3).
//
// Pure, so every string is unit-testable without rendering a panel (ruling a),
// and resolved ONCE so the card face and the panel cannot disagree about the
// same fact (ruling n).
// =============================================================================

import { compareISO, firstOfMonth, monthStartOf } from "./engine/dates";
import {
  ACCOUNT_TYPE_META,
  DEFAULT_EXPECTED_RETURN,
  returnVerb,
} from "./engine/defaults";
import type { Account, ScenarioTimeline } from "./engine/types";
import { formatCurrency, formatMonthYear } from "./format";

/** Valid range for an entered rate (§2). Negative is legal: a down market. */
export const RETURN_MIN = -0.2;
export const RETURN_MAX = 0.4;

export const RETURN_RANGE_ERROR = "Enter a rate between −20% and 40%.";

export function isRateInRange(rate: number): boolean {
  return Number.isFinite(rate) && rate >= RETURN_MIN && rate <= RETURN_MAX;
}

/** True when the account still carries Upward's default for its type. */
export function isDefaultRate(account: Account): boolean {
  return account.expectedReturn === DEFAULT_EXPECTED_RETURN[account.type];
}

/** The modeled monthly return at the CURRENT balance — what the face quotes. */
export function monthlyReturnAt(account: Account): number {
  return (account.balance * account.expectedReturn) / 12;
}

/** `4.2` for 0.042 — one decimal, matching the field's precision. */
function ratePct(rate: number): string {
  return String(Math.round(rate * 1000) / 10);
}

/**
 * The rate clause appended to the card's helper line.
 *
 *   assumes 6.0%/yr · grows ≈ $25/mo at this balance      (at the default)
 *   your rate: 8.5%/yr · grows ≈ $35/mo at this balance   (user-set)
 *   your rate: 0%/yr · no growth modeled                  (zero)
 *
 * "your rate" replaces "assumes" the moment the value differs from the default
 * — a user's own number is never hidden from them.
 */
export function returnFaceClause(account: Account): string {
  const lead = isDefaultRate(account)
    ? `assumes ${ratePct(account.expectedReturn)}%/yr`
    : `your rate: ${ratePct(account.expectedReturn)}%/yr`;
  if (account.expectedReturn === 0) return `${lead} · no growth modeled`;
  const verb = returnVerb(account.type);
  const monthly = monthlyReturnAt(account);
  // A negative rate shrinks the balance; say so plainly rather than printing
  // "grows ≈ −$400".
  if (monthly < 0) {
    return `${lead} · ${verb === "earns" ? "loses" : "shrinks"} ≈ ${formatCurrency(
      Math.abs(monthly),
    )}/mo at this balance`;
  }
  return `${lead} · ${verb} ≈ ${formatCurrency(monthly)}/mo at this balance`;
}

/** Panel helper under the rate field. */
export function returnHelper(account: Account): string {
  return isDefaultRate(account)
    ? `Upward's default for ${ACCOUNT_TYPE_META[account.type].label.toLowerCase()}. Change it to match your account. Applied monthly, before tax.`
    : "Your rate. Applied monthly, before tax.";
}

// -----------------------------------------------------------------------------
// Penalty-free date (§3) — the status line is the honesty mechanism
// -----------------------------------------------------------------------------

export type PenaltyState = "blank" | "past" | "future" | "afterHorizon";

/** Which of §3's four states this account is in, given the projection window. */
export function penaltyState(account: Account, timeline: ScenarioTimeline): PenaltyState {
  const from = account.penaltyFreeMonth ? monthStartOf(account.penaltyFreeMonth) : null;
  // An unparseable pasted value falls back to blank, and the status line says so.
  if (!from) return "blank";
  const start = firstOfMonth(timeline.start);
  const end = firstOfMonth(timeline.end);
  if (compareISO(from, start) <= 0) return "past";
  if (compareISO(from, end) > 0) return "afterHorizon";
  return "future";
}

const TAX_ADVICE = "Upward models the penalty only — it isn't tax advice.";

/**
 * The status line. Mandatory and ALWAYS present: it restates the consequence in
 * months, so nobody has to reason about the rule to confirm the field did what
 * they meant. The "isn't tax advice" clause rides on this line and nowhere else
 * — no banner, no asterisk, no legal block.
 *
 * Copy is verbatim from §3.
 */
export function penaltyStatusLine(account: Account, timeline: ScenarioTimeline): string {
  const state = penaltyState(account, timeline);
  switch (state) {
    case "blank":
      return "Penalty applied to every withdrawal in this projection. Add a month above if you'll turn 59½ before it ends.";
    case "past":
      return "No penalty applied — you were already past 59½ when this projection starts.";
    case "afterHorizon":
      return "Penalty applied for the whole projection; the waiver starts after it ends.";
    case "future": {
      const from = monthStartOf(account.penaltyFreeMonth!)!;
      // The penalty covers [start, the month BEFORE the waiver].
      const lastPenalized = previousMonth(from);
      return `Penalty applied ${formatMonthYear(firstOfMonth(timeline.start))} – ${formatMonthYear(
        lastPenalized,
      )}, then waived. ${TAX_ADVICE}`;
    }
  }
}

function previousMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

/** Short clause for the card FACE when a waiver month is set (§3's mockup). */
export function penaltyFaceClause(account: Account): string | null {
  if (!account.penaltyFreeMonth) return null;
  const from = monthStartOf(account.penaltyFreeMonth);
  if (!from) return null;
  return `penalty-free from ${formatMonthYear(from)}`;
}

/** Confirmation shown when a type change discards the month (§3). */
export const PENALTY_MONTH_REMOVED = "Penalty-free month removed with the type change.";
