// =============================================================================
// Chart tooltip + caption copy — design package §5.
//
// EVERY string the chart renders is built here and asserted here (ruling s).
// The component positions these; it never assembles them from text and
// {expressions}, which silently drops interior spaces and is invisible below
// the browser.
//
// Per ruling (n) the month's NET is read from `MonthLedger.totals.net`, which
// the engine computed in item 2 — the tooltip never re-derives it.
// =============================================================================

import { amountForMonth } from "./engine/expenses";
import type { AccountTimeline, MonthLedger, Scenario } from "./engine/types";
import { formatCurrency, formatMonthYear } from "./format";

/** One series row in the tooltip. */
export interface TooltipRow {
  accountId: string;
  label: string;
  /** Formatted balance, or null when the row states "excluded" instead. */
  value: string | null;
  excluded: boolean;
  /** True for a $0 balance — shown greyed, never dropped. */
  zero: boolean;
  /** Set on the two RECONCILING rows, which are not accounts. */
  kind?: "notCovered" | "creditDrawn";
}

/**
 * The numeric value behind every tooltip row, in render order.
 *
 * THE ROWS MUST SUM TO NET LIQUID. The tooltip is a reconciliation, not a
 * list: a panel where every account reads $0 while the footer reads −$66,775,
 * with no row holding that number, reads as internally inconsistent even
 * though the arithmetic is right.
 *
 * Two rows close the gap, and they are deliberately separate:
 *
 * - **Not covered** — the shortfall the accounts could not fund. The engine
 *   carries it forward rather than silently stopping, which is the honest
 *   model; this row is where it becomes visible.
 * - **Credit drawn** — borrowed money. It is part of net liquid and was
 *   otherwise invisible here, and it is NOT "not covered": it was covered, by
 *   borrowing. Folding it into the shortfall would mislabel real debt.
 */
export function tooltipRowValues(
  month: MonthLedger,
  timelines: AccountTimeline[],
  monthIndex: number,
): { accounts: number[]; notCovered: number; creditDrawn: number } {
  const assets = timelines.filter((t) => t.type !== "credit_line");
  const accounts = assets.map((t) =>
    t.excluded ? 0 : Math.max(0, t.balances[monthIndex] ?? 0),
  );
  // Everything the account rows cannot show: negative asset balances, and debt.
  const notCovered = assets
    .filter((t) => !t.excluded)
    .reduce((sum, t) => sum + Math.min(0, t.balances[monthIndex] ?? 0), 0);
  const creditDrawn = -month.accounts.reduce((sum, a) => sum + (a.drawn ?? 0), 0);
  return { accounts, notCovered, creditDrawn };
}

export interface TooltipModel {
  heading: string;
  /** "opening $12,500 · closing $7,500" */
  subheading: string;
  rows: TooltipRow[];
  netLiquid: string;
  /** "Cash flow  −$7,900" — the month's net, read from the engine. */
  cashFlow: string;
  /** A single line naming an event in this month, or null. */
  event: string | null;
}

/**
 * Build the tooltip for one month.
 *
 * A $0 balance is SHOWN, greyed, rather than dropped: its absence would be
 * information the reader does not get. An excluded series keeps its row too,
 * stating "excluded" in place of a figure.
 */
export function tooltipModel(
  month: MonthLedger,
  timelines: AccountTimeline[],
  monthIndex: number,
  scenario: Scenario,
): TooltipModel {
  const values = tooltipRowValues(month, timelines, monthIndex);
  const assets = timelines.filter((t) => t.type !== "credit_line");

  const rows: TooltipRow[] = assets.map((t, i) => ({
    accountId: t.accountId,
    label: t.name,
    value: t.excluded ? null : formatCurrency(values.accounts[i]),
    excluded: t.excluded,
    zero: !t.excluded && values.accounts[i] === 0,
  }));

  // The reconciling rows, appended only when they carry something. §5b already
  // uses "Not covered" for the unfunded portion — same term, same meaning.
  if (values.creditDrawn !== 0) {
    rows.push({
      accountId: "__credit-drawn",
      label: "Credit drawn",
      value: formatCurrency(values.creditDrawn),
      excluded: false,
      zero: false,
      kind: "creditDrawn",
    });
  }
  if (values.notCovered !== 0) {
    rows.push({
      accountId: "__not-covered",
      label: "Not covered",
      value: formatCurrency(values.notCovered),
      excluded: false,
      zero: false,
      kind: "notCovered",
    });
  }

  return {
    heading: formatMonthYear(month.date),
    subheading: `opening ${formatCurrency(month.totals.opening)} · closing ${formatCurrency(month.totals.closing)}`,
    rows,
    netLiquid: formatCurrency(month.totals.closing),
    // Read, never re-derived — items 6 and 7 share this one figure (ruling n).
    cashFlow: formatSigned(month.totals.net),
    event: eventLine(scenario, month.date),
  };
}

/** `−$7,900` / `+$1,200` / `$0` — sign always explicit except at zero. */
export function formatSigned(value: number): string {
  if (value === 0) return formatCurrency(0);
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

/**
 * The one line naming an event that lands in this month, or null.
 *
 * §5 gives three shapes: a step change taking effect, a line ending, and a
 * penalty-free month being reached. The FIRST match wins — one line, not a list.
 */
export function eventLine(scenario: Scenario, monthStart: string): string | null {
  const month = monthStart.slice(0, 7);

  for (const line of scenario.levers.expenseEvents ?? []) {
    if (line.stepChange && line.stepChange.date.slice(0, 7) === month) {
      return `${line.label} → ${formatCurrency(line.stepChange.newAmount)} from this month`;
    }
  }
  for (const line of scenario.levers.expenseEvents ?? []) {
    if (line.endDate && line.endDate.slice(0, 7) === month) {
      return `${line.label} ends this month`;
    }
  }
  for (const account of scenario.accounts) {
    if (account.penaltyFreeMonth === month) return "Penalty-free from this month";
  }
  return null;
}

/** True when a month carries an event dot beneath its axis label. */
export function hasEvent(scenario: Scenario, monthStart: string): boolean {
  return eventLine(scenario, monthStart) !== null;
}

// -----------------------------------------------------------------------------
// Captions — §5's edge states. Every one is a string built here.
// -----------------------------------------------------------------------------

export const CAPTIONS = {
  /** Marks the first fully-depleted month, once — never a row of zeros. */
  depleted: "depleted",
  /** Shown INSTEAD of a cash-zero marker when nothing runs out in the window.
   *  The absence of the marker is the good news; no green marker replaces it. */
  noCashZero: (months: number) => `No cash-zero within this ${months}-month view.`,
  /** Every asset held out of the runway. */
  allExcluded: "Every account is excluded. Include one to see a runway.",
  /** No accounts at all — reachable by deleting the last one. */
  noAccounts: "Add an account to see a runway.",
  /** The y-axis title. Not optional: columns invite the flow reading, and this
   *  is the cost of moving off an area chart. */
  yAxisTitle: "Balance at month end",
} as const;

/** The subhead under each view's title. Also not optional, same reason. */
export const VIEW_SUBHEAD = {
  total: "What you have left at the end of each month, all accounts combined.",
  byAccount: "What you have left at the end of each month, split by account in tap order.",
} as const;

/** The toggle's two segment labels — the quantity, then the split. */
export const VIEW_LABEL = {
  total: "Balances · total",
  byAccount: "Balances · by account",
} as const;

/** The cash-zero marker's own label, e.g. "cash-zero · Apr 29". */
export function cashZeroLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `cash-zero · ${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** Legend entry text. The tap NUMBER is the primary channel, not the colour —
 *  see ruling (u): eight series cannot pairwise separate, so a hue collision
 *  must degrade to "harder to scan", never "cannot tell which band is which". */
export function legendLabel(tapPosition: number | null, name: string, excluded: boolean): string {
  const numbered = tapPosition === null ? name : `${tapPosition}. ${name}`;
  return excluded ? `${numbered} — excluded` : numbered;
}

/** Unused-amount guard: the amount an expense line costs in a given month. */
export { amountForMonth };
