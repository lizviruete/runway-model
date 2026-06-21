// =============================================================================
// Upward — engine types
//
// The engine is a pure, UI-free module: a Scenario goes in, a SimulationResult
// comes out, with zero React/DOM dependencies. These types are the contract.
// =============================================================================

/** Account types drive default tax + cost implications (all user-editable). */
export type AccountType =
  | "checking"
  | "savings"
  | "hysa"
  | "brokerage"
  | "roth"
  | "pretax"
  | "credit_line"
  | "other";

/**
 * When the cash cost of a withdrawal's tax/penalty actually hits.
 * - "immediate": paid in the month of withdrawal.
 * - "next_april": paid April 15 of the year *after* the withdrawal (the real
 *   filing deadline). Default for brokerage/retirement.
 */
export type TaxTiming = "immediate" | "next_april";

/**
 * How withdrawals from an account are taxed. Everything is an editable number
 * so the model stays honest and overridable.
 *
 * tax owed on a withdrawal of W:
 *   tax     = W * taxableFraction   * effectiveRate
 *   penalty = W * penalizedFraction * earlyPenaltyRate
 */
export interface TaxTreatment {
  /** Effective tax rate applied to the taxable portion of a withdrawal (0–1). */
  effectiveRate: number;
  /** Fraction of a withdrawal that is taxable (e.g. ~gains for brokerage). */
  taxableFraction: number;
  /** Early-withdrawal penalty rate (e.g. 0.10 for retirement) (0–1). */
  earlyPenaltyRate: number;
  /** Fraction of a withdrawal subject to the early penalty. */
  penalizedFraction: number;
  /** When the resulting tax/penalty cash outflow lands. */
  timing: TaxTiming;
}

export type OngoingCostKind = "none" | "credit_interest" | "interest_earned";

/**
 * Recurring carrying cost (or yield) of holding an account.
 * - "credit_interest": monthly interest = drawn * annualRate / 12, beginning
 *   the month after a draw (credit lines / HELOC).
 * - "interest_earned": monthly yield = balance * annualRate / 12 (HYSA).
 */
export interface OngoingCost {
  kind: OngoingCostKind;
  /** Annual rate (e.g. 0.085 = 8.5% HELOC, 0.04 = 4% HYSA). */
  annualRate: number;
}

/** A one-off forced tap of a specific account on a specific date. */
export interface ManualDraw {
  /** ISO date (YYYY-MM-DD); the tap is applied in this calendar month. */
  date: string;
  amount: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /**
   * For asset accounts: the current spendable balance.
   * For credit lines: the available credit limit (drawn starts at 0).
   */
  balance: number;
  /** Slot in the auto-waterfall; lower = tapped sooner. User-reorderable. */
  depletionPriority: number;
  /** Optional override: tap this account on this date regardless of waterfall. */
  manualDraw?: ManualDraw;
  /** Defaulted from `type`, user-editable. */
  taxTreatment: TaxTreatment;
  /** Defaulted from `type`, user-editable. */
  ongoingCost: OngoingCost;
  /** Free text — especially for the "Other" type. */
  userNote?: string;
}

/** A change to the housing cost from a given date forward (e.g. a sublet). */
export interface HousingChange {
  /** ISO date the new amount takes effect (applied from this calendar month). */
  date: string;
  newAmount: number;
}

export interface HousingLever {
  monthlyAmount: number;
  change?: HousingChange;
}

/**
 * A dated cash flow — recurring (monthly between start/end) or one-off (a single
 * dated lump). Used for both income and expenses; the sign is decided by which
 * list it lives in (`levers.incomeEvents` add, `levers.expenseEvents` subtract).
 */
export interface FlowEvent {
  id: string;
  label: string;
  /** Monthly amount (for recurring) or the lump amount (for one-off). */
  amount: number;
  kind: "recurring" | "oneoff";
  /** ISO date the stream starts (or the date of a one-off). */
  startDate: string;
  /** ISO date the recurring stream ends, inclusive by month (recurring only). */
  endDate?: string;
}

/** Back-compat alias: income streams are the same shape as any flow. */
export type IncomeEvent = FlowEvent;

/**
 * Optional major-asset-sale lever (e.g. a property). Implemented fully in
 * Phase C; the type is defined now so the engine and scenario shape are stable.
 */
export interface AssetSaleLever {
  enabled: boolean;
  label: string;
  saleDate: string; // ISO
  salePrice: number;
  closingCostPct: number; // 0–1
  loanPayoff: number; // mortgage / lien paid off at close
  costBasis: number; // for capital-gains calc
  capGainsRate: number; // 0–1
  taxTiming: TaxTiming;
  /** A credit line tied to this asset to pay off at close (e.g. HELOC). */
  tiedCreditAccountId?: string;
  /** Monthly income that stops when the asset is sold (e.g. rental income). */
  associatedMonthlyIncomeToStop?: number;
  /** Monthly carrying cost that stops when sold (separate from the housing lever). */
  associatedMonthlyCostToStop?: number;
}

export interface Levers {
  housing: HousingLever;
  /** Non-housing target monthly living spend (the V1 "trim", in dollars). */
  targetMonthlySpend: number;
  /** Income streams (salary + severance, unemployment, one-off inflows…). */
  incomeEvents: FlowEvent[];
  /** Extra expenses beyond housing + target spend (recurring or one-off). */
  expenseEvents: FlowEvent[];
  assetSale?: AssetSaleLever;
}

export interface ScenarioTimeline {
  start: string; // ISO
  end: string; // ISO
}

/** The whole state: serializes to/from a compact URL param and localStorage. */
export interface Scenario {
  id: string;
  name: string;
  createdDate: string; // ISO
  timeline: ScenarioTimeline;
  accounts: Account[];
  levers: Levers;
  /**
   * Baseline non-housing spend used only to display the "delta vs baseline"
   * helper for the spend lever. Defaults to the seeded targetMonthlySpend.
   */
  baselineMonthlySpend?: number;
}

// -----------------------------------------------------------------------------
// Simulation output
// -----------------------------------------------------------------------------

/** Ledger line-item categories — kept granular so a CSV/JSON export is trivial. */
export type LedgerCategory =
  | "income" // income streams: salary, severance, one-off inflows
  | "housing"
  | "living" // target monthly spend
  | "expense" // added expenses beyond housing/living (recurring or one-off)
  | "assetSale" // net proceeds from a major asset sale
  | "assetCarry" // recurring carrying cost of a held asset (pre-sale)
  | "tax" // scheduled tax/penalty payments coming due
  | "creditInterest" // interest paid on drawn credit
  | "interestEarned" // yield on HYSA etc.
  | "tapIn" // cash received from another account (waterfall transfer in)
  | "tapOut"; // cash sent to the operating account (waterfall transfer out)

export type LedgerAmounts = Partial<Record<LedgerCategory, number>>;

/** One account's activity within one month. */
export interface AccountMonth {
  accountId: string;
  name: string;
  type: AccountType;
  opening: number; // for credit lines, this is `drawn` (debt)
  closing: number; // for credit lines, this is `drawn` (debt)
  /** For credit lines only: drawn balance at month end. */
  drawn?: number;
  inflows: LedgerAmounts;
  outflows: LedgerAmounts;
}

/** A single dated transaction — the transaction-level ledger detail. */
export interface Transaction {
  date: string; // ISO
  monthKey: string; // YYYY-MM
  accountId: string;
  accountName: string;
  category: LedgerCategory;
  /** Signed: positive = into account / cash in, negative = out. */
  amount: number;
  label: string;
}

export interface MonthLedger {
  monthKey: string; // YYYY-MM
  date: string; // ISO first-of-month
  accounts: AccountMonth[];
  totals: {
    opening: number; // total net liquid at month start
    inflow: number; // total external inflows (excludes inter-account taps)
    outflow: number; // total external outflows (excludes inter-account taps)
    closing: number; // total net liquid at month end
  };
}

/** A scheduled future tax/penalty liability created by a taxable withdrawal. */
export interface ScheduledTax {
  sourceAccountId: string;
  sourceAccountName: string;
  withdrawalDate: string; // ISO
  dueDate: string; // ISO
  tax: number;
  penalty: number;
}

export interface RunwayResult {
  /** Null if the scenario never depletes within the timeline horizon. */
  cashZeroDate: string | null;
  /** Whole + fractional weeks of runway from timeline start. */
  weeks: number;
  /** Whole + fractional months of runway from timeline start. */
  months: number;
  /** True if funds outlast the modeled horizon. */
  survivesHorizon: boolean;
}

export interface ProjectionPoint {
  date: string; // ISO first-of-month
  monthKey: string;
  /** Net liquid position = sum(asset balances) - sum(credit drawn). */
  netLiquid: number;
  /** Sum of asset balances only (excludes credit). */
  totalAssets: number;
  /** Total credit drawn (debt). */
  totalDrawn: number;
}

/** Per-account balance over time, for the depletion visualization. */
export interface AccountTimeline {
  accountId: string;
  name: string;
  type: AccountType;
  /** Balance at each month boundary (asset balance, or remaining credit). */
  balances: number[];
}

export interface SimulationResult {
  runway: RunwayResult;
  months: MonthLedger[];
  projection: ProjectionPoint[];
  accountTimelines: AccountTimeline[];
  transactions: Transaction[];
  scheduledTaxes: ScheduledTax[];
  /** Echoed for the spend-lever delta helper. */
  baselineMonthlySpend: number;
  targetMonthlySpend: number;
}
