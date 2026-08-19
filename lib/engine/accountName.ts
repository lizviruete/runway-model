// =============================================================================
// Account display names.
//
// ONE accessor, used by the engine and the UI alike, so the chart legend, the
// chart series, the ledger rows and the CSV exports can never disagree about
// what an account is called.
//
// An account whose name field is empty is not unlabeled: it falls back to its
// type label. Two unnamed accounts of the same type are told apart by a
// trailing index ("Brokerage / investment (2)") — never a generic "Account 4",
// and never omitted.
// =============================================================================

import { ACCOUNT_TYPE_META } from "./defaults";
import type { Account, AccountType } from "./types";

/** The user's own name for an account, trimmed — "" when they gave none.
 *  Tolerates a missing field: decoded URL / localStorage state is untrusted. */
function typedName(account: Account): string {
  return typeof account.name === "string" ? account.name.trim() : "";
}

/**
 * Display name for one account, with NO cross-account disambiguation.
 *
 * Prefer `accountDisplayNames` wherever the whole list is in hand (the engine,
 * every panel). Only that form can see the other accounts, and this one will
 * happily return a string another account has already claimed — an account
 * named "Savings" and an unnamed savings account both resolve to "Savings"
 * here, which is exactly the collision the list form exists to prevent.
 */
export function accountDisplayName(account: Account): string {
  return typedName(account) || ACCOUNT_TYPE_META[account.type].label;
}

/** The nth fallback label for a type: bare, then indexed from 2. */
function indexedLabel(base: string, nth: number): string {
  return nth === 1 ? base : `${base} (${nth})`;
}

/**
 * `id → display name` for a whole account list, resolved in list order.
 *
 * Unnamed accounts fall back to their type label, indexed when that label is
 * already taken. A named account NEVER takes an index — we do not rename the
 * user's account — so the burden of staying distinct falls entirely on the
 * fallbacks: an unnamed savings account alongside one the user named "Savings"
 * resolves to "Savings (2)", and a second to "Savings (3)".
 *
 * The claim set is every name a user typed anywhere in the list, plus every
 * fallback already handed out. It is deliberately NOT per-type: two accounts
 * reading the same in the legend is the defect, and the legend does not care
 * that one of them is a checking account.
 */
export function accountDisplayNames(accounts: Account[]): Map<string, string> {
  // Pass 1 — everything the user has already claimed. Collected across the
  // whole list first, so a name further down still blocks a fallback above it.
  const claimed = new Set<string>();
  for (const account of accounts) {
    const typed = typedName(account);
    if (typed) claimed.add(typed);
  }

  // Pass 2 — hand out fallbacks, skipping anything already claimed. The cursor
  // per type only moves forward, so resolving the list stays linear.
  const nextIndex = new Map<AccountType, number>();
  const names = new Map<string, string>();
  for (const account of accounts) {
    const typed = typedName(account);
    if (typed) {
      names.set(account.id, typed);
      continue;
    }
    const base = ACCOUNT_TYPE_META[account.type].label;
    let nth = nextIndex.get(account.type) ?? 1;
    while (claimed.has(indexedLabel(base, nth))) nth += 1;
    const resolved = indexedLabel(base, nth);
    nextIndex.set(account.type, nth + 1);
    claimed.add(resolved);
    names.set(account.id, resolved);
  }
  return names;
}
