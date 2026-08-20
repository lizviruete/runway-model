// =============================================================================
// Account type → implications mapping.
//
// Picking a type pre-fills tax treatment + ongoing cost (all user-editable),
// and supplies the dropdown label + helper line. "Other" maps to no
// implications, with a free-text note as the escape hatch.
// =============================================================================

import type { AccountType, OngoingCost, TaxTreatment } from "./types";

export interface AccountTypeMeta {
  type: AccountType;
  label: string;
  /** Short helper line: what kind of account belongs here. */
  helper: string;
  taxTreatment: TaxTreatment;
  ongoingCost: OngoingCost;
  /** True for credit lines/HELOC, where `balance` means available credit. */
  isCredit: boolean;
}

const NO_TAX: TaxTreatment = {
  effectiveRate: 0,
  taxableFraction: 0,
  earlyPenaltyRate: 0,
  penalizedFraction: 0,
  timing: "immediate",
};

const NO_COST: OngoingCost = { kind: "none", annualRate: 0 };

export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMeta> = {
  checking: {
    type: "checking",
    label: "Everyday / checking",
    helper: "Operating cash you spend from day to day.",
    taxTreatment: NO_TAX,
    ongoingCost: NO_COST,
    isCredit: false,
  },
  savings: {
    type: "savings",
    label: "Savings",
    helper: "Cash savings. No tax on withdrawal, no ongoing cost.",
    taxTreatment: NO_TAX,
    ongoingCost: NO_COST,
    isCredit: false,
  },
  hysa: {
    type: "hysa",
    label: "High-yield savings",
    helper: "Savings that earns interest. No tax to withdraw; yield is modeled as a small inflow.",
    taxTreatment: NO_TAX,
    // The yield moved to `expectedReturn` in v3 — `ongoingCost` is a COST only.
    ongoingCost: NO_COST,
    isCredit: false,
  },
  brokerage: {
    type: "brokerage",
    label: "Brokerage / investment",
    helper: "Taxable investments. Capital-gains tax on the gains portion; no early-withdrawal penalty.",
    taxTreatment: {
      effectiveRate: 0.15, // long-term cap gains, editable
      taxableFraction: 0.5, // assume ~half the balance is gains, editable
      earlyPenaltyRate: 0,
      penalizedFraction: 0,
      timing: "next_april",
    },
    ongoingCost: NO_COST,
    isCredit: false,
  },
  roth: {
    type: "roth",
    label: "Roth retirement",
    helper:
      "Contributions come out tax- & penalty-free. If you'll tap earnings, raise the taxable / penalty fractions.",
    taxTreatment: {
      effectiveRate: 0.22, // ordinary rate on earnings, if tapped
      taxableFraction: 0, // default: withdrawing contributions first
      earlyPenaltyRate: 0.1,
      penalizedFraction: 0, // default: contributions aren't penalized
      timing: "next_april",
    },
    ongoingCost: NO_COST,
    isCredit: false,
  },
  pretax: {
    type: "pretax",
    label: "Pre-tax retirement (Traditional IRA / 401k)",
    helper: "Full withdrawal taxed as ordinary income, plus a 10% early-withdrawal penalty.",
    taxTreatment: {
      effectiveRate: 0.22, // ordinary income rate, editable
      taxableFraction: 1,
      earlyPenaltyRate: 0.1,
      penalizedFraction: 1,
      timing: "next_april",
    },
    ongoingCost: NO_COST,
    isCredit: false,
  },
  credit_line: {
    type: "credit_line",
    label: "Credit line / HELOC",
    helper:
      "Borrowed money. No tax, but monthly interest accrues on the drawn balance starting the month after a draw.",
    taxTreatment: NO_TAX,
    ongoingCost: { kind: "credit_interest", annualRate: 0.085 },
    isCredit: true,
  },
  other: {
    type: "other",
    label: "Other",
    helper: "Anything else. No implications by default — document specifics in the note.",
    taxTreatment: NO_TAX,
    ongoingCost: NO_COST,
    isCredit: false,
  },
};

/** Ordered list for rendering the type dropdown. */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "checking",
  "savings",
  "hysa",
  "brokerage",
  "roth",
  "pretax",
  "credit_line",
  "other",
];

export function isCreditType(type: AccountType): boolean {
  return ACCOUNT_TYPE_META[type].isCredit;
}

// -----------------------------------------------------------------------------
// Expected return (V2.1 item 3)
//
// A default is an assumption the user did not make: it must be labelled,
// reversible, and never silently changed. These are the ONE place they live.
// -----------------------------------------------------------------------------

/** Upward's default expected annual return, as a fraction, per account type. */
export const DEFAULT_EXPECTED_RETURN: Record<AccountType, number> = {
  // The repo's existing HYSA yield, carried over unchanged. (The design
  // package's 4.2% illustrates the pattern; it is not normative, and churning
  // a live value for 0.2% would move every existing scenario for nothing.)
  hysa: 0.04,
  brokerage: 0.06,
  roth: 0.06,
  pretax: 0.06,
  other: 0,
  // Ineligible — no Assumptions panel at all, rather than a disabled field.
  checking: 0,
  savings: 0,
  // A liability's rate is a COST and lives on `ongoingCost`. Untouched.
  credit_line: 0,
};

/**
 * Whether this type gets an Assumptions panel with a return field.
 * Ineligible types show NO panel rather than a greyed input — an empty
 * disabled field reads as broken.
 */
export function supportsExpectedReturn(type: AccountType): boolean {
  return type === "hysa" || type === "brokerage" || type === "roth" || type === "pretax" || type === "other";
}

/** Only pre-tax retirement carries an early-withdrawal penalty date (§3). */
export function supportsPenaltyFreeMonth(type: AccountType): boolean {
  return type === "pretax";
}

/**
 * Which ledger category this type's return posts under.
 *
 * Cash savings EARN interest; investments and retirement accounts GROW through
 * capital appreciation. Calling a brokerage's appreciation "Interest" is
 * factually wrong, and it reads as broken once returns can be negative
 * ("≈ Interest −$400"). The face copy in §2 makes the same distinction.
 */
export function returnCategory(type: AccountType): "interestEarned" | "growth" {
  return type === "hysa" || type === "savings" || type === "checking"
    ? "interestEarned"
    : "growth";
}

/** The verb the face uses for this type's return: "earns" or "grows". */
export function returnVerb(type: AccountType): "earns" | "grows" {
  return returnCategory(type) === "interestEarned" ? "earns" : "grows";
}

export function defaultExpectedReturn(type: AccountType): number {
  return DEFAULT_EXPECTED_RETURN[type];
}

/** Fresh copies of the default tax/cost for a type (safe to mutate/edit). */
export function defaultTaxTreatment(type: AccountType): TaxTreatment {
  return { ...ACCOUNT_TYPE_META[type].taxTreatment };
}

export function defaultOngoingCost(type: AccountType): OngoingCost {
  return { ...ACCOUNT_TYPE_META[type].ongoingCost };
}
