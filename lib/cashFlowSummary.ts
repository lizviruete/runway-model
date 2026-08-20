// =============================================================================
// Cash-flow summary — design package §6.
//
// One line above the ledger carrying the burn rate and the turnaround month.
// Every string is built here and asserted here (ruling s).
//
// THE RATE AND THE TURNAROUND DESCRIBE THE SAME QUANTITY: net cash flow, read
// from `MonthLedger.totals.net`, which the engine computed in item 2 (ruling n).
// The chart tooltip reads the same field, so the two surfaces cannot disagree.
//
// §6's own example pairs "Burning about $7,900/mo" with a row reading
// IN $3,913 · OUT −$7,900 · NET −$3,987 — i.e. it quotes the GROSS outflow next
// to a net turnaround. Built as net here: the line sits directly above a NET
// column that would otherwise contradict it, and "turns positive" is a fact
// about the net sign, so the rate has to be the same measure.
//
// NO COLOUR ANYWHERE IN THIS MODULE. The turnaround month is marked by a WORD.
// A wall of danger-coloured numbers restating a fact the user already knows, to
// someone in financial distress, fails the calm principle outright — and
// green-for-positive fails it inverted, because rewarding positive with colour
// punishes negative by its absence.
// =============================================================================

import type { MonthLedger, Scenario } from "./engine/types";
import { formatCurrency, formatMonthYear } from "./format";

/** Which direction the projection is running in, from its FIRST month. */
export type CashFlowRegime = "burning" | "adding" | "flat";

export interface CashFlowSummary {
  regime: CashFlowRegime;
  /** The summary sentence: rate clause · turnaround clause. */
  text: string;
  /** Month key of the sign change, or null. Drives the row chip. */
  turnaroundMonth: string | null;
  /** Which chip that month carries. */
  turnaroundChip: "TURNS POSITIVE" | "TURNS NEGATIVE" | null;
}

/** Show a range instead of a single figure once the spread is this fraction
 *  of the mean — §6: "range when the spread exceeds 25% of the mean". */
const RANGE_THRESHOLD = 0.25;

/** "About" is deliberate and stays: the number is a projection, and rounding
 *  it in language is more honest than a false-precision figure. */
function rateClause(regime: CashFlowRegime, values: number[]): string {
  if (regime === "flat") return "Flat about $0/mo";
  const verb = regime === "burning" ? "Burning" : "Adding";
  const magnitudes = values.map(Math.abs);
  const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const lo = Math.min(...magnitudes);
  const hi = Math.max(...magnitudes);
  if (mean > 0 && hi - lo > mean * RANGE_THRESHOLD) {
    return `${verb} ${formatCurrency(lo)}–${formatCurrency(hi)}/mo`;
  }
  return `${verb} about ${formatCurrency(mean)}/mo`;
}

/**
 * The summary line for a projection. Six states, §6's copy verbatim:
 *
 *   Burning about $7,900/mo · turns positive Mar 2027
 *   Burning about $7,900/mo · no month turns positive in this view
 *   Adding about $1,200/mo · positive every month in this view
 *   Adding about $1,200/mo · turns negative Jan 2027
 *   Burning $4,000–$9,300/mo · turns positive Mar 2027
 *   Flat about $0/mo
 */
export function cashFlowSummary(months: MonthLedger[]): CashFlowSummary | null {
  // §6: with no data the bar is hidden entirely rather than showing "$0/mo".
  if (months.length === 0) return null;

  const nets = months.map((m) => m.totals.net);
  const first = nets[0];
  const regime: CashFlowRegime = first < 0 ? "burning" : first > 0 ? "adding" : "flat";

  if (regime === "flat" && nets.every((n) => n === 0)) {
    return { regime, text: "Flat about $0/mo", turnaroundMonth: null, turnaroundChip: null };
  }

  // A projection that starts at exactly zero but moves: treat the first
  // non-zero month as the regime, so the line describes something real.
  const effective: CashFlowRegime =
    regime !== "flat" ? regime : (nets.find((n) => n !== 0) ?? 0) < 0 ? "burning" : "adding";

  const inRegime = nets.filter((n) => (effective === "burning" ? n < 0 : n > 0));
  const rate = rateClause(effective, inRegime.length ? inRegime : nets);

  // THE TURNAROUND IS A CHANGE IN THE RECURRING POSITION (ruling y), so a
  // month qualifies only if it would still oppose the regime with one-time
  // inflows excluded. A lump sum extends your RUNWAY — which the runway figure
  // and the cash-zero date already report — but it does not change what your
  // months look like, and "turns positive Sep 2026" for a one-month blip is
  // false hope handed to someone in financial distress.
  //
  // Zero is not a turnaround either: flat is not positive.
  const recurring = months.map((m) => m.totals.net - m.totals.oneTimeInflow);
  const turnIndex = recurring.findIndex((n) => (effective === "burning" ? n > 0 : n < 0));
  const turnaroundMonth = turnIndex === -1 ? null : months[turnIndex].monthKey;
  const turnaroundChip =
    turnIndex === -1 ? null : effective === "burning" ? "TURNS POSITIVE" : "TURNS NEGATIVE";

  let tail: string;
  if (turnIndex !== -1) {
    const when = formatMonthYear(months[turnIndex].date);
    tail = effective === "burning" ? `turns positive ${when}` : `turns negative ${when}`;
  } else {
    tail =
      effective === "burning"
        ? "no month turns positive in this view"
        : "positive every month in this view";
  }

  return { regime: effective, text: `${rate} · ${tail}`, turnaroundMonth, turnaroundChip };
}

/**
 * The delta clause, shown to the right of the summary.
 *
 * Compares this scenario's mean net against the baseline's. Stated in the
 * direction the user cares about: less burn is "less than baseline".
 */
export function cashFlowDelta(
  months: MonthLedger[],
  baselineMonths: MonthLedger[],
): string | null {
  if (months.length === 0 || baselineMonths.length === 0) return null;
  const mean = (m: MonthLedger[]) => m.reduce((s, x) => s + x.totals.net, 0) / m.length;
  const diff = mean(months) - mean(baselineMonths);
  // Under a dollar a month is not a difference anyone can act on.
  if (Math.abs(diff) < 1) return "Same as baseline";
  return diff > 0
    ? `${formatCurrency(Math.abs(diff))}/mo less than baseline`
    : `${formatCurrency(Math.abs(diff))}/mo more than baseline`;
}

/**
 * Month keys where a recurring income stream starts — §6's INCOME RESUMES chip.
 *
 * Chip only, no NET emphasis: emphasis exists in exactly one place, and that
 * place is the sign change.
 */
export function incomeResumesMonths(scenario: Scenario, months: MonthLedger[]): Set<string> {
  const keys = new Set<string>();
  const inView = new Set(months.map((m) => m.monthKey));
  for (const income of scenario.levers.incomeEvents ?? []) {
    if (income.kind !== "recurring" || income.amount <= 0) continue;
    const key = income.startDate.slice(0, 7);
    // The first month of the projection is not a "resumption" — it is the
    // starting state, and every stream that is already running begins there.
    if (inView.has(key) && key !== months[0]?.monthKey) keys.add(key);
  }
  return keys;
}

/**
 * The NET cell's text: sign always explicit, magnitude, no colour.
 *
 * A caret is rendered separately and is aria-hidden; this is the accessible
 * value. Zero reads "$0" with no caret and no chip.
 */
export function netCellText(net: number): string {
  if (net === 0) return formatCurrency(0);
  return net > 0 ? `+${formatCurrency(net)}` : formatCurrency(net);
}

/** The caret glyph beside a NET value, or null at zero. Decorative. */
export function netCaret(net: number): "▴" | "▾" | null {
  if (net === 0) return null;
  return net > 0 ? "▴" : "▾";
}

/** The cell's accessible name, e.g. "Net cash flow, minus 3,987 dollars". */
export function netCellLabel(net: number): string {
  if (net === 0) return "Net cash flow, zero dollars";
  const magnitude = Math.abs(net).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `Net cash flow, ${net < 0 ? "minus " : "plus "}${magnitude} dollars`;
}
