// Scenario-editing helpers shared by the UI. Pure, immutable transforms.

import {
  defaultExpectedReturn,
  defaultOngoingCost,
  defaultTaxTreatment,
  isCreditType,
} from "./engine/defaults";
import type { Account, AccountType, Scenario } from "./engine/types";

/**
 * EVERY field derived from the account TYPE, in one object.
 *
 * `applyTypeDefaults` spreads this over an existing account, and TypeScript
 * cannot see a stale field through a spread — excess-property checks do not
 * fire there. So the guard is structural: add a type-derived field HERE and a
 * type change resets it everywhere, automatically. `scenario.test.ts`
 * enumerates these keys and asserts each one resets, because the compiler
 * will not.
 */
function typeDerived(
  type: AccountType,
): Pick<Account, "taxTreatment" | "ongoingCost" | "expectedReturn" | "penaltyFreeMonth"> {
  return {
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: defaultExpectedReturn(type),
    // §3: changing the type away from pre-tax discards the penalty-free month.
    penaltyFreeMonth: undefined,
  };
}

/** The keys `typeDerived` owns — exported so a test can enumerate them. */
export const TYPE_DERIVED_KEYS = [
  "taxTreatment",
  "ongoingCost",
  "expectedReturn",
  "penaltyFreeMonth",
] as const;

let fallbackCounter = 0;
function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  fallbackCounter += 1;
  return `${prefix}-${fallbackCounter}`;
}

/** A fresh account of the given type, defaulted from the type mapping. */
export function newAccount(type: AccountType, priority: number): Account {
  const meta = isCreditType(type);
  return {
    id: newId("acc"),
    // Left empty on purpose: `accountDisplayName` resolves an unnamed account to
    // its type label, and the card's placeholder shows that same resolved name.
    // Prefilling would bake in a name that goes stale the moment the type
    // changes — and there would be nothing to distinguish it from one the user
    // typed, so we could not safely refresh it either.
    name: "",
    type,
    balance: meta ? 10_000 : 5_000,
    depletionPriority: priority,
    ...typeDerived(type),
  };
}

/** Renumber depletionPriority to match array order (1-based). */
export function renumber(accounts: Account[]): Account[] {
  return accounts.map((a, i) => ({ ...a, depletionPriority: i + 1 }));
}

/** Move an account from one index to another, renumbering priorities. */
export function moveAccount(accounts: Account[], from: number, to: number): Account[] {
  if (to < 0 || to >= accounts.length || from === to) return accounts;
  const next = [...accounts];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return renumber(next);
}

/** When an account's type changes, re-default every type-derived field.
 *  The name is left alone — a name the user typed is never overwritten, and an
 *  empty one keeps falling back to whatever the new type is called. */
export function applyTypeDefaults(account: Account, type: AccountType): Account {
  return { ...account, type, ...typeDerived(type) };
}

/** Replace one account by id within a scenario. */
export function updateAccount(scenario: Scenario, id: string, patch: Partial<Account>): Scenario {
  return {
    ...scenario,
    accounts: scenario.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function newIncomeId(): string {
  return newId("inc");
}

export function newExpenseId(): string {
  return newId("exp");
}
