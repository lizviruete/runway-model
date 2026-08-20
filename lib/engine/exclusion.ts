// =============================================================================
// Account exclusion — hold an account out of the runway without deleting it.
//
// ONE module answering "is this account excluded", per ruling (n): the card,
// the chart legend and the ledger all read these functions rather than each
// deriving their own answer.
//
// The organizing idea is that an excluded account LOSES ITS TAP-ORDER NUMBER.
// The number is the account's place in the drawdown sequence, and something not
// in the sequence cannot have one. That single fact reads on the card, in the
// legend and in the ledger without inventing any new colour.
// =============================================================================

import { isCreditType } from "./defaults";
import type { Account } from "./types";

/**
 * Whether this type can be held out of the runway at all.
 *
 * Assets only. "Excluded" would mean two different things on a liability —
 * "I won't draw on this" or "pretend this debt doesn't exist" — and the engine
 * models the second, which stops charging the carrying cost on an already-drawn
 * balance and makes the runway look BETTER by ignoring real debt. Every other
 * exclusion is conservative; that one flatters the number, which is the one
 * direction this tool must not drift.
 *
 * A V3 question, and if it returns it should be a different control with an
 * unambiguous meaning ("available to draw: yes/no"), not this toggle.
 */
export function canExclude(account: Account): boolean {
  return !isCreditType(account.type);
}

/**
 * Is this account held out of the runway?
 *
 * The single choke point. Returns false for a liability even when the flag is
 * set, so a hand-edited `?s=` payload cannot use it to hide debt — the guard
 * lives here rather than in the UI, because the UI is not what a crafted
 * payload goes through.
 */
export function isExcluded(account: Account): boolean {
  return account.excluded === true && canExclude(account);
}

/** The accounts that actually take part in the runway, in list order. */
export function includedAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !isExcluded(a));
}

/** Total held out of the runway (assets only, so it is always a real figure). */
export function excludedTotal(accounts: Account[]): number {
  return accounts.filter(isExcluded).reduce((sum, a) => sum + a.balance, 0);
}

/**
 * The single grey line an excluded card states instead of its helper text (§4,
 * final copy).
 *
 * Built as ONE string rather than assembled in JSX: interleaving text and
 * `{expressions}` across lines drops interior spaces in ways that are invisible
 * in review and only show up rendered — this exact line shipped as
 * "this $5,000isn't part of your runway" before it was caught in the browser.
 * A string is also assertable, which JSX whitespace is not.
 */
export function excludedCardLine(
  account: Account,
  formatCurrency: (n: number) => string,
): string {
  return `Excluded — this ${formatCurrency(account.balance)} isn’t part of your runway. Balance and settings are kept.`;
}

/** The ledger's line for an excluded account (§4, final copy). */
export function excludedLedgerLine(
  balance: number,
  formatCurrency: (n: number) => string,
): string {
  return `excluded · ${formatCurrency(balance)} held, not counted`;
}

/**
 * The Accounts header's summary (§4).
 *
 *   $22,000 in assets                              — nothing excluded
 *   $19,000 counted in runway · $3,000 excluded    — something excluded
 *
 * "In assets" becomes "counted in runway" only while an exclusion exists: the
 * phrase has to name what the number now means, and a total labelled "assets"
 * that omits assets would be a lie.
 */
export function accountsHeaderSummary(
  accounts: Account[],
  formatCurrency: (n: number) => string,
): string {
  const assets = accounts.filter((a) => !isCreditType(a.type));
  const held = excludedTotal(accounts);
  const counted = assets.filter((a) => !isExcluded(a)).reduce((sum, a) => sum + a.balance, 0);
  return held > 0
    ? `${formatCurrency(counted)} counted in runway · ${formatCurrency(held)} excluded`
    : `${formatCurrency(counted)} in assets`;
}

/**
 * `id → tap position`, 1-based among INCLUDED accounts in list order, and
 * `null` for an excluded one — it has no place in the sequence.
 *
 * Deliberately derived, never stored: `depletionPriority` keeps tracking array
 * order and is NOT renumbered when an account is excluded. Renumbering would be
 * a destructive write to stored state, and re-including would then have to
 * reconstruct what it clobbered instead of simply reproducing it.
 */
export function tapPositions(accounts: Account[]): Map<string, number | null> {
  const positions = new Map<string, number | null>();
  let next = 1;
  for (const account of accounts) {
    if (isExcluded(account)) positions.set(account.id, null);
    else positions.set(account.id, next++);
  }
  return positions;
}
