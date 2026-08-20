// =============================================================================
// Upward — the simulation engine.
//
// Pure function: simulate(scenario) -> SimulationResult. No React, no DOM, no
// `Date.now()`. Month-by-month walk of the timeline maintaining a per-account
// ledger, an auto-waterfall for shortfalls, ongoing costs, and future-dated
// tax events. This is the audit-grade core.
// =============================================================================

import { accountDisplayName, accountDisplayNames } from "./accountName";
import { isCreditType, returnCategory } from "./defaults";
import { isExcluded } from "./exclusion";
import { amountForMonth, expenseCategory, seededAmount } from "./expenses";
import {
  addDays,
  addMonths,
  compareISO,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  followingApril15,
  monthInRange,
  monthKey,
  monthStartOf,
  monthsInclusive,
  parseISO,
  sameMonth,
} from "./dates";
import type {
  Account,
  AccountMonth,
  AccountTimeline,
  LedgerAmounts,
  LedgerCategory,
  LedgerEstimates,
  MonthLedger,
  ProjectionPoint,
  ScheduledTax,
  Scenario,
  SimulationResult,
  Transaction,
} from "./types";

/** Mutable per-account state carried across the month loop. */
interface AccountState {
  account: Account;
  isCredit: boolean;
  /** Held out of the runway — every step below skips it. */
  excluded: boolean;
  /** Asset: spendable balance. Credit: irrelevant (use `drawn`). */
  balance: number;
  /** Credit only: amount currently borrowed. */
  drawn: number;
  /** Credit only: the available credit limit (from account.balance). */
  limit: number;
}

/** Per-month, per-account accumulator. */
interface MonthAccumulator {
  opening: number;
  inflows: LedgerAmounts;
  outflows: LedgerAmounts;
  estimated: LedgerEstimates;
}

/** Transaction label per return category — see `returnCategory`. */
const RETURN_LABEL = {
  interestEarned: "Interest earned",
  growth: "Growth",
} as const;

function add(amounts: LedgerAmounts, cat: LedgerCategory, value: number): void {
  if (value === 0) return;
  amounts[cat] = (amounts[cat] ?? 0) + value;
}

/**
 * Record whether a contribution to `cat` was a modeled estimate, ANDed across
 * every contribution in the month. A category stays "≈" only while everything
 * feeding it is modeled — one entered input in the mix and the marker drops,
 * because "≈ Expense" has to mean all of it.
 */
function markEstimate(
  flags: LedgerEstimates,
  cat: LedgerCategory,
  isEstimate: boolean,
): void {
  flags[cat] = (flags[cat] ?? true) && isEstimate;
}

/** Cash that can still be pulled from an account. */
function tappable(s: AccountState): number {
  return s.isCredit ? Math.max(0, s.limit - s.drawn) : Math.max(0, s.balance);
}

/** Net liquid contribution of an account: assets add, credit debt subtracts. */
function netLiquid(s: AccountState): number {
  return s.isCredit ? -s.drawn : s.balance;
}

/**
 * Is the early-withdrawal penalty waived for a withdrawal on `onDate`?
 *
 * Deliberately NOT gated on account type. The field only renders for pre-tax
 * accounts, but 59½ governs Roth earnings too — so if the month is set, the
 * engine honours it whatever the type, rather than keeping a second rule in
 * sync with the UI's.
 */
export function penaltyWaivedAt(account: Account, onDate: string): boolean {
  if (!account.penaltyFreeMonth) return false; // blank: the penalty applies throughout
  const from = monthStartOf(account.penaltyFreeMonth);
  if (!from) return false; // unparseable: fall back to blank, never to "waived"
  return compareISO(firstOfMonth(onDate), from) >= 0;
}

/**
 * A well-formed result for a scenario with no account to operate from — every
 * account excluded, or none at all.
 *
 * Runway is 0 and cash-zero is the timeline start: with nothing to spend from,
 * the money is already gone. Excluded accounts still appear in the timelines
 * and the ledger, flat at the balance they hold, so the legend keeps naming
 * them and the ledger can say "held, not counted".
 */
function emptyResult(
  scenario: Scenario,
  states: AccountState[],
  startMonth: string,
  totalMonths: number,
  nameOf: (account: Account) => string,
): SimulationResult {
  const monthStarts = Array.from({ length: totalMonths }, (_, i) => addMonths(startMonth, i));
  const accountMonth = (s: AccountState): AccountMonth => ({
    accountId: s.account.id,
    name: nameOf(s.account),
    type: s.account.type,
    opening: s.isCredit ? 0 : s.balance,
    closing: s.isCredit ? 0 : s.balance,
    drawn: s.isCredit ? 0 : undefined,
    inflows: {},
    outflows: {},
    estimated: {},
    excluded: s.excluded,
  });

  return {
    runway: {
      cashZeroDate: scenario.timeline.start,
      weeks: 0,
      months: 0,
      survivesHorizon: false,
    },
    months: monthStarts.map((date) => ({
      monthKey: monthKey(date),
      date,
      accounts: states.map(accountMonth),
      totals: { opening: 0, inflow: 0, outflow: 0, net: 0, oneTimeInflow: 0, closing: 0 },
    })),
    projection: monthStarts.map((date) => ({
      date,
      monthKey: monthKey(date),
      netLiquid: 0,
      totalAssets: 0,
      totalDrawn: 0,
    })),
    accountTimelines: states.map((s) => ({
      accountId: s.account.id,
      name: nameOf(s.account),
      type: s.account.type,
      excluded: s.excluded,
      balances: monthStarts.map(() => (s.isCredit ? 0 : s.balance)),
    })),
    transactions: [],
    scheduledTaxes: [],
    baselineMonthlySpend:
      scenario.baselineMonthlySpend ?? seededAmount(scenario.levers, "living"),
    targetMonthlySpend: seededAmount(scenario.levers, "living"),
  };
}

export function simulate(scenario: Scenario): SimulationResult {
  const { timeline, levers } = scenario;
  const startMonth = firstOfMonth(timeline.start);
  const totalMonths = Math.max(1, monthsInclusive(timeline.start, timeline.end));

  // Every account name the engine emits — timelines, ledger rows, transactions,
  // scheduled taxes — is resolved once, here. The chart legend, the ledger and
  // the CSVs all read this output, so they cannot drift apart: an account with
  // an empty name field gets its type label instead of dropping out.
  const displayNames = accountDisplayNames(scenario.accounts);
  const nameOf = (account: Account): string =>
    displayNames.get(account.id) ?? accountDisplayName(account);

  // ---- account state, ordered by waterfall priority -----------------------
  const states: AccountState[] = scenario.accounts.map((account) => {
    const isCredit = isCreditType(account.type);
    return {
      account,
      isCredit,
      excluded: isExcluded(account),
      balance: isCredit ? 0 : account.balance,
      drawn: 0,
      limit: isCredit ? account.balance : 0,
    };
  });

  /**
   * The accounts that actually take part. An excluded account is never touched
   * by ANY step below — no return accrues, no interest, no draw, no tap — so
   * its `balance` stays exactly where it started and its timeline is flat.
   *
   * That is the whole freeze mechanic: not a snapshot that gets restored, but
   * the absence of any mutation. Since the engine never writes back to the
   * stored Scenario either, re-including an account reproduces the previous
   * result by construction rather than by careful restoration.
   */
  const active = states.filter((s) => !s.excluded);
  const waterfall = [...active].sort(
    (a, b) => a.account.depletionPriority - b.account.depletionPriority,
  );
  // The operating account: first *included* asset in the waterfall. Income and
  // living costs flow through it; shortfalls cascade to later accounts.
  const operating = waterfall.find((s) => !s.isCredit);

  // Nothing to run: every account excluded, or none at all. Returns a
  // well-formed zero-runway result rather than throwing — reachable today by
  // deleting every account, which crashes the app on the spot.
  if (!operating) {
    return emptyResult(scenario, states, startMonth, totalMonths, nameOf);
  }

  const transactions: Transaction[] = [];
  const scheduledTaxes: ScheduledTax[] = [];
  const months: MonthLedger[] = [];
  const projection: ProjectionPoint[] = [];
  const timelines: Map<string, AccountTimeline> = new Map(
    states.map((s) => [
      s.account.id,
      {
        accountId: s.account.id,
        name: nameOf(s.account),
        type: s.account.type,
        excluded: s.excluded,
        balances: [],
      },
    ]),
  );

  let cashZeroDate: string | null = null;
  const livingMonthlySpend = seededAmount(levers, "living");
  const baselineMonthlySpend = scenario.baselineMonthlySpend ?? livingMonthlySpend;

  function tx(
    date: string,
    s: AccountState,
    cat: LedgerCategory,
    amount: number,
    label: string,
    isEstimate = false,
  ): void {
    transactions.push({
      date,
      monthKey: monthKey(date),
      accountId: s.account.id,
      accountName: nameOf(s.account),
      category: cat,
      amount,
      label,
      ...(isEstimate ? { isEstimate: true } : {}),
    });
  }

  /** Schedule a tax/penalty liability for a taxable withdrawal of `amount`. */
  function scheduleTax(s: AccountState, amount: number, onDate: string): void {
    const t = s.account.taxTreatment;
    const tax = amount * t.taxableFraction * t.effectiveRate;
    // The early-withdrawal penalty is decided by the month the money was TAKEN,
    // never by the month the bill falls due. A pre-tax withdrawal in Feb 2027
    // is paid the following April 2028, and it stays penalized even if the
    // holder turns 59½ in March 2027 — the penalty attaches to the withdrawal.
    // The boundary is inclusive: a withdrawal IN the crossing month is waived.
    // Blank, past, future and after-horizon all fall out of this one test.
    // Only the penalty is waived; ordinary-income tax is untouched.
    const penalty = penaltyWaivedAt(s.account, onDate)
      ? 0
      : amount * t.penalizedFraction * t.earlyPenaltyRate;
    if (tax === 0 && penalty === 0) return;
    const dueDate =
      t.timing === "immediate" ? firstOfMonth(onDate) : followingApril15(onDate);
    scheduledTaxes.push({
      sourceAccountId: s.account.id,
      sourceAccountName: nameOf(s.account),
      withdrawalDate: onDate,
      dueDate,
      tax,
      penalty,
    });
  }

  // =========================================================================
  // Month loop
  // =========================================================================
  for (let i = 0; i < totalMonths; i++) {
    const monthStart = addMonths(startMonth, i);
    const { y, m } = parseISO(monthStart);
    const mKey = monthKey(monthStart);
    const dim = daysInMonth(y, m);

    const acc: Map<string, MonthAccumulator> = new Map(
      states.map((s) => [
        s.account.id,
        { opening: netLiquid(s), inflows: {}, outflows: {}, estimated: {} },
      ]),
    );
    // Totals count INCLUDED accounts only — money held aside is not runway.
    const opening = active.reduce((sum, s) => sum + netLiquid(s), 0);

    /**
     * Pull `amount` of cash from a source into operating, recording the
     * transfer on this month's ledger and scheduling any tax. Closes over the
     * current month's `acc`/`monthStart`.
     */
    const pull = (s: AccountState, amount: number, onDate: string, label: string): void => {
      if (amount <= 0) return;
      if (s.isCredit) s.drawn += amount;
      else s.balance -= amount;
      operating.balance += amount;
      add(acc.get(s.account.id)!.outflows, "tapOut", amount);
      add(acc.get(operating.account.id)!.inflows, "tapIn", amount);
      // Transfers move real money between real accounts — never an estimate.
      markEstimate(acc.get(s.account.id)!.estimated, "tapOut", false);
      markEstimate(acc.get(operating.account.id)!.estimated, "tapIn", false);
      tx(onDate, s, "tapOut", -amount, label);
      tx(onDate, operating, "tapIn", amount, label);
      if (!s.isCredit) scheduleTax(s, amount, onDate);
    };

    let inflowTotal = 0;
    let outflowTotal = 0;
    // The part of inflow that will not recur — see MonthLedger.totals.
    let oneTimeInflow = 0;

    // ---- 1. expected return (accrues into the account) --------------------
    // Runs BEFORE any withdrawal, so it is computed on the OPENING balance —
    // the mechanic the hardcoded HYSA yield already used, unchanged.
    // `active` only: an excluded account must not grow while held aside.
    for (const s of active) {
      if (s.isCredit) continue;
      const rate = s.account.expectedReturn;
      if (rate === 0) continue;
      // A negative rate is legal (§2 allows −20%) and shrinks the balance. It
      // is capped at the balance so an asset can never go negative.
      const change = Math.max(-s.balance, s.balance * (rate / 12));
      if (change === 0) continue;
      const category = returnCategory(s.account.type);
      const a = acc.get(s.account.id)!;
      s.balance += change;
      if (change > 0) {
        inflowTotal += change;
        add(a.inflows, category, change);
      } else {
        outflowTotal += -change;
        add(a.outflows, category, -change);
      }
      // Computed from a rate — modeled by nature, not an entered figure.
      markEstimate(a.estimated, category, true);
      tx(monthStart, s, category, change, RETURN_LABEL[category], true);
    }

    // ---- 2. credit interest on balances drawn before this month ----------
    // (drawn at month start = drawn at end of previous month, so the month a
    //  draw first happens accrues nothing — interest begins the month after.)
    // Interest is paid in cash from the operating account (principal stays
    // drawn), so it is attributed to operating's ledger row in step 5d.
    const creditInterest: { name: string; interest: number }[] = [];
    for (const s of active) {
      if (!s.isCredit || s.drawn <= 0) continue;
      const interest = s.drawn * (s.account.ongoingCost.annualRate / 12);
      if (interest <= 0) continue;
      creditInterest.push({ name: nameOf(s.account), interest });
    }

    // ---- 3. manual draws scheduled this month ----------------------------
    for (const s of active) {
      const draw = s.account.manualDraw;
      if (!draw || !sameMonth(draw.date, monthStart)) continue;
      const amount = Math.min(draw.amount, tappable(s));
      if (amount <= 0) continue;
      pull(s, amount, draw.date, "Manual draw");
    }

    // ---- 4. external inflows (recurring income + one-off income/inflows) --
    for (const ev of levers.incomeEvents) {
      let amt = 0;
      if (ev.kind === "recurring") {
        if (monthInRange(monthStart, ev.startDate, ev.endDate)) amt = ev.amount;
      } else if (sameMonth(ev.startDate, monthStart)) {
        amt = ev.amount;
      }
      if (amt <= 0) continue;
      inflowTotal += amt;
      if (ev.kind === "oneoff") oneTimeInflow += amt;
      operating.balance += amt;
      add(acc.get(operating.account.id)!.inflows, "income", amt);
      // Income is entered by the user, never modeled.
      markEstimate(acc.get(operating.account.id)!.estimated, "income", false);
      tx(monthStart, operating, "income", amt, ev.label);
    }

    // ---- 4b. major asset sale lever --------------------------------------
    const sale = levers.assetSale;
    if (sale?.enabled) {
      const saleMonthStart = firstOfMonth(sale.saleDate);
      const beforeSale = compareISO(monthStart, saleMonthStart) < 0;
      const isSaleMonth = sameMonth(sale.saleDate, monthStart);

      // Associated income (e.g. rent) accrues only until the asset is sold.
      if (beforeSale && sale.associatedMonthlyIncomeToStop) {
        const amt = sale.associatedMonthlyIncomeToStop;
        inflowTotal += amt;
        operating.balance += amt;
        add(acc.get(operating.account.id)!.inflows, "income", amt);
        markEstimate(acc.get(operating.account.id)!.estimated, "income", false);
        tx(monthStart, operating, "income", amt, `${sale.label} income`);
      }

      if (isSaleMonth) {
        const tied = sale.tiedCreditAccountId
          ? states.find((s) => s.account.id === sale.tiedCreditAccountId && s.isCredit)
          : undefined;
        const tiedPayoff = tied ? tied.drawn : 0;
        const closingCosts = sale.salePrice * sale.closingCostPct;
        const net = sale.salePrice - closingCosts - sale.loanPayoff - tiedPayoff;

        // Pay off the tied credit line at close.
        if (tied && tiedPayoff > 0) {
          tied.drawn = 0;
          add(acc.get(tied.account.id)!.inflows, "assetSale", tiedPayoff);
          markEstimate(acc.get(tied.account.id)!.estimated, "assetSale", false);
          tx(sale.saleDate, tied, "assetSale", tiedPayoff, `${sale.label} — pay off ${nameOf(tied.account)}`);
        }

        // Net proceeds land in the operating account (an outflow if underwater).
        operating.balance += net;
        if (net >= 0) {
          inflowTotal += net;
          oneTimeInflow += net; // a sale happens once
          add(acc.get(operating.account.id)!.inflows, "assetSale", net);
        } else {
          outflowTotal += -net;
          add(acc.get(operating.account.id)!.outflows, "assetSale", -net);
        }
        markEstimate(acc.get(operating.account.id)!.estimated, "assetSale", false);
        tx(sale.saleDate, operating, "assetSale", net, `${sale.label} — net proceeds`);

        // Capital-gains tax on the realized gain, scheduled per its timing.
        const gain = Math.max(0, sale.salePrice - sale.costBasis);
        const capGainsTax = gain * sale.capGainsRate;
        if (capGainsTax > 0) {
          scheduledTaxes.push({
            sourceAccountId: `assetsale:${sale.label}`,
            sourceAccountName: sale.label,
            withdrawalDate: sale.saleDate,
            dueDate:
              sale.taxTiming === "immediate"
                ? firstOfMonth(sale.saleDate)
                : followingApril15(sale.saleDate),
            tax: capGainsTax,
            penalty: 0,
          });
        }
      }
    }

    // ---- 5. external outflows --------------------------------------------
    const opOut = acc.get(operating.account.id)!.outflows;
    const opEstimated = acc.get(operating.account.id)!.estimated;

    // 5a. every expense, seeded and user-added alike, in list order.
    // One loop over one primitive: the seeded housing and living lines are just
    // the first two entries, distinguished only by the ledger category they post
    // under. There is no second class of expense in here.
    for (const line of levers.expenseEvents ?? []) {
      const amt = amountForMonth(line, monthStart);
      if (amt <= 0) continue;
      const category = expenseCategory(line);
      operating.balance -= amt;
      outflowTotal += amt;
      add(opOut, category, amt);
      // The line itself says whether it is modeled — a user row can be an
      // estimate, and the seeded living line can have the flag turned off.
      markEstimate(opEstimated, category, line.isEstimate === true);
      tx(
        line.kind === "recurring" ? monthStart : line.startDate,
        operating,
        category,
        -amt,
        line.label,
        line.isEstimate === true,
      );
    }

    // 5b. asset carrying cost (e.g. property tax / HOA) — stops at sale.
    // Per ruling (p) this now posts AFTER the expense list rather than between
    // housing and the added expenses. No financial value changes; only the
    // order of `transactions[]`, and only for a scenario with an asset sale
    // carrying a monthly cost.
    if (sale?.enabled && sale.associatedMonthlyCostToStop) {
      const beforeSale = compareISO(monthStart, firstOfMonth(sale.saleDate)) < 0;
      if (beforeSale) {
        const cost = sale.associatedMonthlyCostToStop;
        operating.balance -= cost;
        outflowTotal += cost;
        add(opOut, "assetCarry", cost);
        markEstimate(opEstimated, "assetCarry", false);
        tx(monthStart, operating, "assetCarry", -cost, `${sale.label} carrying cost`);
      }
    }

    // 5d. credit interest (accrued in step 2) is paid from operating cash
    for (const ci of creditInterest) {
      operating.balance -= ci.interest;
      outflowTotal += ci.interest;
      add(opOut, "creditInterest", ci.interest);
      markEstimate(opEstimated, "creditInterest", true); // computed from an APR
      tx(monthStart, operating, "creditInterest", -ci.interest, `Interest — ${ci.name}`, true);
    }

    // 5e. scheduled taxes coming due this month
    for (const st of scheduledTaxes) {
      if (!sameMonth(st.dueDate, monthStart)) continue;
      const owed = st.tax + st.penalty;
      if (owed <= 0) continue;
      operating.balance -= owed;
      outflowTotal += owed;
      add(opOut, "tax", owed);
      markEstimate(opEstimated, "tax", true); // estimated tax/penalty
      tx(
        st.dueDate,
        operating,
        "tax",
        -owed,
        `Tax/penalty on ${st.sourceAccountName} withdrawal`,
      );
    }

    // ---- 6. cover any operating deficit via the waterfall -----------------
    // Each pull credits operating.balance, lifting it back toward zero. We
    // never force a floor: any shortfall the waterfall can't cover stays as a
    // negative balance so no money is silently created (conservation holds —
    // the ledger reconciles exactly). That negative balance is the genuine
    // unfunded shortfall; the UI clamps its display floor at zero.
    if (operating.balance < 0) {
      for (const s of waterfall) {
        if (s === operating) continue;
        if (operating.balance >= 0) break;
        const avail = tappable(s);
        if (avail <= 0) continue;
        const amount = Math.min(-operating.balance, avail);
        pull(s, amount, monthStart, "Cover shortfall");
      }
      // ---- 7. cash-zero detection (uncovered shortfall) ------------------
      if (operating.balance < -1e-6 && cashZeroDate === null) {
        const uncovered = -operating.balance;
        const covered = Math.max(0, outflowTotal - uncovered);
        const frac = outflowTotal > 0 ? covered / outflowTotal : 0;
        const daysCovered = Math.min(dim, Math.floor(frac * dim));
        cashZeroDate = addDays(monthStart, daysCovered);
      }
    }

    // ---- 8. record per-account month + closing balances -------------------
    const accountMonths: AccountMonth[] = states.map((s) => {
      const a = acc.get(s.account.id)!;
      const tl = timelines.get(s.account.id)!;
      tl.balances.push(s.isCredit ? tappable(s) : s.balance);
      return {
        accountId: s.account.id,
        name: nameOf(s.account),
        type: s.account.type,
        opening: a.opening,
        closing: netLiquid(s),
        drawn: s.isCredit ? s.drawn : undefined,
        inflows: a.inflows,
        outflows: a.outflows,
        estimated: a.estimated,
        excluded: s.excluded,
      };
    });

    const closing = active.reduce((sum, s) => sum + netLiquid(s), 0);
    months.push({
      monthKey: mKey,
      date: monthStart,
      accounts: accountMonths,
      totals: {
        opening,
        inflow: inflowTotal,
        outflow: outflowTotal,
        // The month's cash flow, computed once here so the chart tooltip and
        // the ledger's NET column read the same number.
        net: inflowTotal - outflowTotal,
        oneTimeInflow,
        closing,
      },
    });
    projection.push({
      date: monthStart,
      monthKey: mKey,
      netLiquid: closing,
      totalAssets: active.reduce((sum, s) => (s.isCredit ? sum : sum + s.balance), 0),
      totalDrawn: active.reduce((sum, s) => (s.isCredit ? sum + s.drawn : sum), 0),
    });
  }

  // -------------------------------------------------------------------------
  // runway metrics
  // -------------------------------------------------------------------------
  const survivesHorizon = cashZeroDate === null;
  const endRef = cashZeroDate ?? addMonths(startMonth, totalMonths);
  const days = Math.max(0, daysBetween(timeline.start, endRef));
  const runway = {
    cashZeroDate,
    weeks: days / 7,
    months: days / (365.25 / 12),
    survivesHorizon,
  };

  return {
    runway,
    months,
    projection,
    accountTimelines: [...timelines.values()],
    transactions,
    scheduledTaxes,
    baselineMonthlySpend,
    targetMonthlySpend: livingMonthlySpend,
  };
}

