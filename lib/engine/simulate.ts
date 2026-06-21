// =============================================================================
// Upward — the simulation engine.
//
// Pure function: simulate(scenario) -> SimulationResult. No React, no DOM, no
// `Date.now()`. Month-by-month walk of the timeline maintaining a per-account
// ledger, an auto-waterfall for shortfalls, ongoing costs, and future-dated
// tax events. This is the audit-grade core.
// =============================================================================

import { isCreditType } from "./defaults";
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
}

function add(amounts: LedgerAmounts, cat: LedgerCategory, value: number): void {
  if (value === 0) return;
  amounts[cat] = (amounts[cat] ?? 0) + value;
}

/** Cash that can still be pulled from an account. */
function tappable(s: AccountState): number {
  return s.isCredit ? Math.max(0, s.limit - s.drawn) : Math.max(0, s.balance);
}

/** Net liquid contribution of an account: assets add, credit debt subtracts. */
function netLiquid(s: AccountState): number {
  return s.isCredit ? -s.drawn : s.balance;
}

export function simulate(scenario: Scenario): SimulationResult {
  const { timeline, levers } = scenario;
  const startMonth = firstOfMonth(timeline.start);
  const totalMonths = Math.max(1, monthsInclusive(timeline.start, timeline.end));

  // ---- account state, ordered by waterfall priority -----------------------
  const states: AccountState[] = scenario.accounts.map((account) => {
    const isCredit = isCreditType(account.type);
    return {
      account,
      isCredit,
      balance: isCredit ? 0 : account.balance,
      drawn: 0,
      limit: isCredit ? account.balance : 0,
    };
  });
  const waterfall = [...states].sort(
    (a, b) => a.account.depletionPriority - b.account.depletionPriority,
  );
  // The operating account: first *asset* in the waterfall. Income and living
  // costs flow through it; shortfalls cascade to later accounts.
  const operating = waterfall.find((s) => !s.isCredit) ?? waterfall[0];

  const transactions: Transaction[] = [];
  const scheduledTaxes: ScheduledTax[] = [];
  const months: MonthLedger[] = [];
  const projection: ProjectionPoint[] = [];
  const timelines: Map<string, AccountTimeline> = new Map(
    states.map((s) => [
      s.account.id,
      {
        accountId: s.account.id,
        name: s.account.name,
        type: s.account.type,
        balances: [],
      },
    ]),
  );

  let cashZeroDate: string | null = null;
  const baselineMonthlySpend =
    scenario.baselineMonthlySpend ?? levers.targetMonthlySpend;

  function tx(
    date: string,
    s: AccountState,
    cat: LedgerCategory,
    amount: number,
    label: string,
  ): void {
    transactions.push({
      date,
      monthKey: monthKey(date),
      accountId: s.account.id,
      accountName: s.account.name,
      category: cat,
      amount,
      label,
    });
  }

  /** Schedule a tax/penalty liability for a taxable withdrawal of `amount`. */
  function scheduleTax(s: AccountState, amount: number, onDate: string): void {
    const t = s.account.taxTreatment;
    const tax = amount * t.taxableFraction * t.effectiveRate;
    const penalty = amount * t.penalizedFraction * t.earlyPenaltyRate;
    if (tax === 0 && penalty === 0) return;
    const dueDate =
      t.timing === "immediate" ? firstOfMonth(onDate) : followingApril15(onDate);
    scheduledTaxes.push({
      sourceAccountId: s.account.id,
      sourceAccountName: s.account.name,
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
        { opening: netLiquid(s), inflows: {}, outflows: {} },
      ]),
    );
    const opening = states.reduce((sum, s) => sum + netLiquid(s), 0);

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
      tx(onDate, s, "tapOut", -amount, label);
      tx(onDate, operating, "tapIn", amount, label);
      if (!s.isCredit) scheduleTax(s, amount, onDate);
    };

    let inflowTotal = 0;
    let outflowTotal = 0;

    // ---- 1. interest earned (yield accrues into the account) --------------
    for (const s of states) {
      if (s.isCredit || s.account.ongoingCost.kind !== "interest_earned") continue;
      const interest = s.balance * (s.account.ongoingCost.annualRate / 12);
      if (interest <= 0) continue;
      s.balance += interest;
      inflowTotal += interest;
      add(acc.get(s.account.id)!.inflows, "interestEarned", interest);
      tx(monthStart, s, "interestEarned", interest, "Interest earned");
    }

    // ---- 2. credit interest on balances drawn before this month ----------
    // (drawn at month start = drawn at end of previous month, so the month a
    //  draw first happens accrues nothing — interest begins the month after.)
    // Interest is paid in cash from the operating account (principal stays
    // drawn), so it is attributed to operating's ledger row in step 5d.
    const creditInterest: { name: string; interest: number }[] = [];
    for (const s of states) {
      if (!s.isCredit || s.drawn <= 0) continue;
      const interest = s.drawn * (s.account.ongoingCost.annualRate / 12);
      if (interest <= 0) continue;
      creditInterest.push({ name: s.account.name, interest });
    }

    // ---- 3. manual draws scheduled this month ----------------------------
    for (const s of states) {
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
      operating.balance += amt;
      add(acc.get(operating.account.id)!.inflows, "income", amt);
      tx(monthStart, operating, "income", amt, ev.label);
    }
    for (const ev of levers.oneTimeEvents) {
      if (ev.direction !== "inflow" || !sameMonth(ev.date, monthStart)) continue;
      inflowTotal += ev.amount;
      operating.balance += ev.amount;
      add(acc.get(operating.account.id)!.inflows, "oneTime", ev.amount);
      tx(ev.date, operating, "oneTime", ev.amount, ev.label);
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
          tx(sale.saleDate, tied, "assetSale", tiedPayoff, `${sale.label} — pay off ${tied.account.name}`);
        }

        // Net proceeds land in the operating account (an outflow if underwater).
        operating.balance += net;
        if (net >= 0) {
          inflowTotal += net;
          add(acc.get(operating.account.id)!.inflows, "assetSale", net);
        } else {
          outflowTotal += -net;
          add(acc.get(operating.account.id)!.outflows, "assetSale", -net);
        }
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

    // 5a. housing
    const housing = housingForMonth(scenario, monthStart);
    if (housing > 0) {
      operating.balance -= housing;
      outflowTotal += housing;
      add(opOut, "housing", housing);
      tx(monthStart, operating, "housing", -housing, "Housing");
    }

    // 5b. target monthly living spend
    const living = levers.targetMonthlySpend;
    if (living > 0) {
      operating.balance -= living;
      outflowTotal += living;
      add(opOut, "living", living);
      tx(monthStart, operating, "living", -living, "Living spend");
    }

    // 5b2. asset carrying cost (e.g. property tax / HOA) — stops at sale
    if (sale?.enabled && sale.associatedMonthlyCostToStop) {
      const beforeSale = compareISO(monthStart, firstOfMonth(sale.saleDate)) < 0;
      if (beforeSale) {
        const cost = sale.associatedMonthlyCostToStop;
        operating.balance -= cost;
        outflowTotal += cost;
        add(opOut, "assetCarry", cost);
        tx(monthStart, operating, "assetCarry", -cost, `${sale.label} carrying cost`);
      }
    }

    // 5c. dated one-time outflows
    for (const ev of levers.oneTimeEvents) {
      if (ev.direction !== "outflow" || !sameMonth(ev.date, monthStart)) continue;
      operating.balance -= ev.amount;
      outflowTotal += ev.amount;
      add(opOut, "oneTime", ev.amount);
      tx(ev.date, operating, "oneTime", -ev.amount, ev.label);
    }

    // 5d. credit interest (accrued in step 2) is paid from operating cash
    for (const ci of creditInterest) {
      operating.balance -= ci.interest;
      outflowTotal += ci.interest;
      add(opOut, "creditInterest", ci.interest);
      tx(monthStart, operating, "creditInterest", -ci.interest, `Interest — ${ci.name}`);
    }

    // 5e. scheduled taxes coming due this month
    for (const st of scheduledTaxes) {
      if (!sameMonth(st.dueDate, monthStart)) continue;
      const owed = st.tax + st.penalty;
      if (owed <= 0) continue;
      operating.balance -= owed;
      outflowTotal += owed;
      add(opOut, "tax", owed);
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
        name: s.account.name,
        type: s.account.type,
        opening: a.opening,
        closing: netLiquid(s),
        drawn: s.isCredit ? s.drawn : undefined,
        inflows: a.inflows,
        outflows: a.outflows,
      };
    });

    const closing = states.reduce((sum, s) => sum + netLiquid(s), 0);
    months.push({
      monthKey: mKey,
      date: monthStart,
      accounts: accountMonths,
      totals: { opening, inflow: inflowTotal, outflow: outflowTotal, closing },
    });
    projection.push({
      date: monthStart,
      monthKey: mKey,
      netLiquid: closing,
      totalAssets: states.reduce((sum, s) => (s.isCredit ? sum : sum + s.balance), 0),
      totalDrawn: states.reduce((sum, s) => (s.isCredit ? sum + s.drawn : sum), 0),
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
    targetMonthlySpend: levers.targetMonthlySpend,
  };
}

/** Housing cost active in the month containing `monthStart`. */
function housingForMonth(scenario: Scenario, monthStart: string): number {
  const { housing } = scenario.levers;
  if (housing.change && compareISO(monthStart, firstOfMonth(housing.change.date)) >= 0) {
    return housing.change.newAmount;
  }
  return housing.monthlyAmount;
}
