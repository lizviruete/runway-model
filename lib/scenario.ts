// Scenario-editing helpers shared by the UI. Pure, immutable transforms.

import { defaultOngoingCost, defaultTaxTreatment, isCreditType } from "./engine/defaults";
import type { Account, AccountType, Scenario } from "./engine/types";

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
    name: type === "other" ? "New account" : "",
    type,
    balance: meta ? 10_000 : 5_000,
    depletionPriority: priority,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
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

/** When an account's type changes, re-default its tax/cost implications. */
export function applyTypeDefaults(account: Account, type: AccountType): Account {
  return {
    ...account,
    type,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
  };
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

export function newEventId(): string {
  return newId("one");
}
