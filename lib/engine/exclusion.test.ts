import { describe, expect, it } from "vitest";
import {
  accountsHeaderSummary,
  canExclude,
  excludedCardLine,
  excludedLedgerLine,
  excludedTotal,
  includedAccounts,
  isExcluded,
  tapPositions,
} from "./exclusion";
import { defaultExpectedReturn, defaultOngoingCost, defaultTaxTreatment } from "./defaults";
import type { Account, AccountType } from "./types";

function acct(id: string, type: AccountType, extra?: Partial<Account>): Account {
  return {
    id,
    name: id,
    type,
    balance: 1_000,
    depletionPriority: 1,
    taxTreatment: defaultTaxTreatment(type),
    ongoingCost: defaultOngoingCost(type),
    expectedReturn: defaultExpectedReturn(type),
    ...extra,
  };
}

describe("canExclude — assets only", () => {
  it("allows every asset type", () => {
    for (const type of ["checking", "savings", "hysa", "brokerage", "roth", "pretax", "other"] as AccountType[]) {
      expect(canExclude(acct("a", type))).toBe(true);
    }
  });

  it("refuses a credit line", () => {
    expect(canExclude(acct("a", "credit_line"))).toBe(false);
  });
});

describe("isExcluded — the single choke point", () => {
  it("is false when the flag is absent or false", () => {
    expect(isExcluded(acct("a", "brokerage"))).toBe(false);
    expect(isExcluded(acct("a", "brokerage", { excluded: false }))).toBe(false);
  });

  it("is true for a flagged asset", () => {
    expect(isExcluded(acct("a", "brokerage", { excluded: true }))).toBe(true);
  });

  it("IGNORES the flag on a liability, whatever a payload says", () => {
    // Excluding a liability would stop charging carrying cost on drawn debt and
    // make the runway look BETTER by ignoring real money owed. Every other
    // exclusion is conservative; this one flatters the number. The guard lives
    // here, not in the UI, because a crafted `?s=` never goes through the UI.
    expect(isExcluded(acct("a", "credit_line", { excluded: true }))).toBe(false);
  });
});

describe("tapPositions — an excluded account loses its number", () => {
  it("numbers included accounts 1..n in list order", () => {
    const accounts = [acct("a", "checking"), acct("b", "savings"), acct("c", "brokerage")];
    expect([...tapPositions(accounts).values()]).toEqual([1, 2, 3]);
  });

  it("gives an excluded account null and renumbers the rest immediately", () => {
    const accounts = [
      acct("a", "checking"),
      acct("b", "savings", { excluded: true }),
      acct("c", "brokerage"),
      acct("d", "roth"),
    ];
    const positions = tapPositions(accounts);
    expect(positions.get("a")).toBe(1);
    expect(positions.get("b")).toBeNull();
    // c and d close up: the sequence has no gap where b was.
    expect(positions.get("c")).toBe(2);
    expect(positions.get("d")).toBe(3);
  });

  it("keeps the excluded account IN PLACE — the map is in list order", () => {
    // Ruling (i): the card stays put in its grid position. Only the number goes.
    const accounts = [
      acct("a", "checking"),
      acct("b", "savings", { excluded: true }),
      acct("c", "brokerage"),
    ];
    expect([...tapPositions(accounts).keys()]).toEqual(["a", "b", "c"]);
  });

  it("numbers a liability normally even if flagged", () => {
    const accounts = [acct("a", "checking"), acct("b", "credit_line", { excluded: true })];
    expect([...tapPositions(accounts).values()]).toEqual([1, 2]);
  });

  it("handles every account excluded, and an empty list", () => {
    const all = [acct("a", "checking", { excluded: true }), acct("b", "savings", { excluded: true })];
    expect([...tapPositions(all).values()]).toEqual([null, null]);
    expect(tapPositions([]).size).toBe(0);
  });
});

describe("includedAccounts / excludedTotal", () => {
  it("splits on the same rule isExcluded uses", () => {
    const accounts = [
      acct("a", "checking", { balance: 3_000 }),
      acct("b", "brokerage", { balance: 5_000, excluded: true }),
      acct("c", "credit_line", { balance: 2_000, excluded: true }),
    ];
    expect(includedAccounts(accounts).map((a) => a.id)).toEqual(["a", "c"]);
    // The liability's flag is ignored, so it contributes nothing to the total.
    expect(excludedTotal(accounts)).toBe(5_000);
  });

  it("totals nothing when nothing is excluded", () => {
    expect(excludedTotal([acct("a", "checking"), acct("b", "savings")])).toBe(0);
  });
});

describe("accountsHeaderSummary (§4)", () => {
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

  it("reads 'in assets' while nothing is excluded", () => {
    const accounts = [
      acct("a", "checking", { balance: 3_000 }),
      acct("b", "savings", { balance: 19_000 }),
    ];
    expect(accountsHeaderSummary(accounts, fmt)).toBe("$22,000 in assets");
  });

  it("switches to 'counted in runway' the moment something is excluded", () => {
    // A total labelled "assets" that omits assets would be a lie.
    const accounts = [
      acct("a", "checking", { balance: 3_000 }),
      acct("b", "savings", { balance: 16_000 }),
      acct("c", "brokerage", { balance: 3_000, excluded: true }),
    ];
    expect(accountsHeaderSummary(accounts, fmt)).toBe(
      "$19,000 counted in runway · $3,000 excluded",
    );
  });

  it("leaves credit lines out of both figures", () => {
    const accounts = [
      acct("a", "checking", { balance: 5_000 }),
      acct("b", "credit_line", { balance: 50_000, excluded: true }),
    ];
    // The liability's flag is ignored, so no exclusion exists at all.
    expect(accountsHeaderSummary(accounts, fmt)).toBe("$5,000 in assets");
  });

  it("handles everything excluded, and an empty list", () => {
    const all = [acct("a", "checking", { balance: 4_000, excluded: true })];
    expect(accountsHeaderSummary(all, fmt)).toBe("$0 counted in runway · $4,000 excluded");
    expect(accountsHeaderSummary([], fmt)).toBe("$0 in assets");
  });
});

describe("excluded copy (§4, final) — asserted, not eyeballed", () => {
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

  it("states the card line exactly, spaces included", () => {
    // Assembled in JSX this shipped as "this $5,000isn't part of your runway":
    // interleaving text and {expressions} across lines drops interior spaces
    // invisibly. Building the string here makes it assertable.
    expect(excludedCardLine(acct("a", "brokerage", { balance: 5_000 }), fmt)).toBe(
      "Excluded — this $5,000 isn’t part of your runway. Balance and settings are kept.",
    );
  });

  it("has no double or missing spaces at any amount", () => {
    for (const balance of [0, 7, 5_000, 1_234_567]) {
      const line = excludedCardLine(acct("a", "brokerage", { balance }), fmt);
      expect(line).not.toMatch(/\s{2}/);
      expect(line).toMatch(/this \$[\d,]+ isn’t/);
    }
  });

  it("states the ledger line exactly", () => {
    expect(excludedLedgerLine(3_000, fmt)).toBe("excluded · $3,000 held, not counted");
  });
});
