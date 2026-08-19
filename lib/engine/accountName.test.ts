import { describe, expect, it } from "vitest";
import { accountDisplayName, accountDisplayNames } from "./accountName";
import { ACCOUNT_TYPE_META, defaultOngoingCost, defaultTaxTreatment } from "./defaults";
import type { Account, AccountType } from "./types";

function acct(id: string, type: AccountType, name: string): Account {
  return {
    id,
    name,
    type,
    balance: 1_000,
    depletionPriority: 1,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
  };
}

/** id → display name, as a plain object, for readable assertions. */
function names(accounts: Account[]): Record<string, string> {
  return Object.fromEntries(accountDisplayNames(accounts));
}

describe("accountDisplayName — the single-account form", () => {
  it("uses the user's name when they gave one", () => {
    expect(accountDisplayName(acct("a", "brokerage", "Fidelity"))).toBe("Fidelity");
  });

  it("falls back to the type label when the name is empty", () => {
    expect(accountDisplayName(acct("a", "brokerage", ""))).toBe("Brokerage / investment");
    expect(accountDisplayName(acct("a", "checking", ""))).toBe("Everyday / checking");
    expect(accountDisplayName(acct("a", "pretax", ""))).toBe(
      "Pre-tax retirement (Traditional IRA / 401k)",
    );
  });

  it("treats a whitespace-only name as empty", () => {
    expect(accountDisplayName(acct("a", "hysa", "   "))).toBe("High-yield savings");
    expect(accountDisplayName(acct("a", "hysa", "\t\n "))).toBe("High-yield savings");
  });

  it("trims a name the user padded", () => {
    expect(accountDisplayName(acct("a", "savings", "  Emergency fund  "))).toBe("Emergency fund");
  });

  it("survives state decoded without a name field at all", () => {
    // `?s=` and localStorage payloads are untrusted: an older or hand-edited
    // one can be missing the field entirely, which is the defect's worst case.
    const missing = { ...acct("a", "roth", "") } as Partial<Account>;
    delete missing.name;
    expect(accountDisplayName(missing as Account)).toBe("Roth retirement");
  });

  it("never produces an empty string for any supported type", () => {
    for (const type of Object.keys(ACCOUNT_TYPE_META) as AccountType[]) {
      expect(accountDisplayName(acct("a", type, ""))).not.toBe("");
    }
  });
});

describe("accountDisplayNames — disambiguation across a list", () => {
  it("indexes the second and later unnamed accounts of the same type", () => {
    expect(
      names([
        acct("a", "brokerage", ""),
        acct("b", "brokerage", ""),
        acct("c", "brokerage", ""),
      ]),
    ).toEqual({
      a: "Brokerage / investment",
      b: "Brokerage / investment (2)",
      c: "Brokerage / investment (3)",
    });
  });

  it("does not index unnamed accounts of DIFFERENT types", () => {
    expect(names([acct("a", "checking", ""), acct("b", "savings", "")])).toEqual({
      a: "Everyday / checking",
      b: "Savings",
    });
  });

  it("never indexes a named account, and never lets one advance the counter", () => {
    // The index disambiguates fallbacks, not accounts: the named brokerage in
    // the middle must not push the second unnamed one to "(3)".
    expect(
      names([
        acct("a", "brokerage", ""),
        acct("b", "brokerage", "Fidelity"),
        acct("c", "brokerage", ""),
      ]),
    ).toEqual({
      a: "Brokerage / investment",
      b: "Fidelity",
      c: "Brokerage / investment (2)",
    });
  });

  it("indexes in list order, so reordering renumbers the fallbacks", () => {
    const a = acct("a", "roth", "");
    const b = acct("b", "roth", "");
    expect(names([a, b])).toEqual({ a: "Roth retirement", b: "Roth retirement (2)" });
    expect(names([b, a])).toEqual({ b: "Roth retirement", a: "Roth retirement (2)" });
  });

  it("resolves whitespace-only names as fallbacks, indexing included", () => {
    expect(names([acct("a", "hysa", " "), acct("b", "hysa", "")])).toEqual({
      a: "High-yield savings",
      b: "High-yield savings (2)",
    });
  });

  it("never falls back to a generic 'Account N' and never omits an account", () => {
    const accounts = [
      acct("a", "checking", ""),
      acct("b", "credit_line", ""),
      acct("c", "other", "  "),
      acct("d", "other", "Coinbase"),
    ];
    const resolved = accountDisplayNames(accounts);
    expect(resolved.size).toBe(accounts.length);
    for (const account of accounts) {
      const name = resolved.get(account.id);
      expect(name).toBeTruthy();
      expect(name).not.toMatch(/^Account \d+$/);
    }
  });

  it("agrees with the single-account form whenever there is nothing to index", () => {
    const accounts = [acct("a", "checking", ""), acct("b", "savings", "Ally"), acct("c", "roth", "")];
    for (const account of accounts) {
      expect(accountDisplayNames(accounts).get(account.id)).toBe(accountDisplayName(account));
    }
  });

  it("handles an empty list", () => {
    expect(accountDisplayNames([]).size).toBe(0);
  });
});
