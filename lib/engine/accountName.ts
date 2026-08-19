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
 * Display name for one account, with no cross-account disambiguation.
 *
 * Prefer `accountDisplayNames` wherever the whole list is in hand (the engine,
 * every panel): only that form can add the trailing index that keeps two
 * unnamed accounts of the same type apart.
 */
export function accountDisplayName(account: Account): string {
  return typedName(account) || ACCOUNT_TYPE_META[account.type].label;
}

/**
 * `id → display name` for a whole account list, resolved in list order.
 *
 * Unnamed accounts fall back to their type label; the second and later unnamed
 * accounts of a type carry a trailing index. A named account never takes an
 * index and never advances the counter — the index disambiguates fallbacks,
 * not accounts.
 */
export function accountDisplayNames(accounts: Account[]): Map<string, string> {
  const fallbacksSoFar = new Map<AccountType, number>();
  const names = new Map<string, string>();
  for (const account of accounts) {
    const typed = typedName(account);
    if (typed) {
      names.set(account.id, typed);
      continue;
    }
    const label = ACCOUNT_TYPE_META[account.type].label;
    const nth = (fallbacksSoFar.get(account.type) ?? 0) + 1;
    fallbacksSoFar.set(account.type, nth);
    names.set(account.id, nth === 1 ? label : `${label} (${nth})`);
  }
  return names;
}
