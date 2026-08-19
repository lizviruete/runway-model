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

describe("fallbacks never collide with a name the user typed", () => {
  it("indexes past a named account of the same type (the QA repro)", () => {
    // Seeded "Savings" + a blank second savings account used to render
    // "Savings · Savings" in the legend, indistinguishable from each other.
    expect(names([acct("a", "savings", "Savings"), acct("b", "savings", "")])).toEqual({
      a: "Savings",
      b: "Savings (2)",
    });
  });

  it("keeps counting past a named account for every later fallback", () => {
    expect(
      names([
        acct("a", "savings", "Savings"),
        acct("b", "savings", ""),
        acct("c", "savings", ""),
      ]),
    ).toEqual({ a: "Savings", b: "Savings (2)", c: "Savings (3)" });
  });

  it("skips a named account that already looks like an indexed fallback", () => {
    // "Savings (2)" is taken, so the second fallback jumps to (3) rather than
    // duplicating it. The named account is never renamed to make room.
    expect(
      names([
        acct("a", "savings", "Savings (2)"),
        acct("b", "savings", ""),
        acct("c", "savings", ""),
      ]),
    ).toEqual({ a: "Savings (2)", b: "Savings", c: "Savings (3)" });
  });

  it("skips a run of named accounts occupying the low indices", () => {
    expect(
      names([
        acct("a", "savings", "Savings"),
        acct("b", "savings", "Savings (2)"),
        acct("c", "savings", ""),
      ]),
    ).toEqual({ a: "Savings", b: "Savings (2)", c: "Savings (3)" });
  });

  it("blocks a fallback against a name that appears LATER in the list", () => {
    // The claim set is collected across the whole list first, so resolution
    // does not depend on where the named account happens to sit.
    expect(names([acct("b", "savings", ""), acct("a", "savings", "Savings")])).toEqual({
      b: "Savings (2)",
      a: "Savings",
    });
  });

  it("blocks a collision across DIFFERENT types", () => {
    // A checking account the user named "Savings" still collides with the
    // savings type label in the legend, which cannot see the type.
    expect(names([acct("a", "checking", "Savings"), acct("b", "savings", "")])).toEqual({
      a: "Savings",
      b: "Savings (2)",
    });
  });

  it("never renames a named account to resolve a collision", () => {
    const resolved = names([
      acct("a", "savings", "Savings"),
      acct("b", "savings", ""),
      acct("c", "hysa", "High-yield savings"),
      acct("d", "hysa", ""),
    ]);
    expect(resolved.a).toBe("Savings");
    expect(resolved.c).toBe("High-yield savings");
    expect(resolved.b).toBe("Savings (2)");
    expect(resolved.d).toBe("High-yield savings (2)");
  });

  it("hands out no duplicate display name when the typed names are distinct", () => {
    const accounts = [
      acct("a", "savings", "Savings"),
      acct("b", "savings", ""),
      acct("c", "savings", ""),
      acct("d", "checking", "Savings (3)"),
      acct("e", "checking", ""),
      acct("f", "brokerage", ""),
      acct("g", "brokerage", "  "),
    ];
    const resolved = [...accountDisplayNames(accounts).values()];
    expect(resolved).toHaveLength(accounts.length);
    expect(new Set(resolved).size).toBe(accounts.length);
  });

  it("leaves duplicate names the user typed alone", () => {
    // Two accounts genuinely named the same thing is the user's own doing, and
    // renaming either one would be worse than the ambiguity.
    expect(names([acct("a", "savings", "Joint"), acct("b", "brokerage", "Joint")])).toEqual({
      a: "Joint",
      b: "Joint",
    });
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
