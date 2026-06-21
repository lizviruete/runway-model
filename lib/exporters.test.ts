import { describe, expect, it } from "vitest";
import { ledgerJSON, monthlyRowsCSV, transactionsCSV } from "./exporters";
import { simulate } from "./engine/simulate";
import { createSampleScenario } from "./sample";

const res = simulate(createSampleScenario());

describe("monthly rows CSV", () => {
  it("has a header and one row per account per month", () => {
    const lines = monthlyRowsCSV(res).split("\n");
    expect(lines[0]).toBe(
      "month,account,type,opening,income,housing,living,expense,assetSale,assetCarry,tax,creditInterest,interestEarned,tapIn,tapOut,closing",
    );
    expect(lines.length - 1).toBe(res.months.length * res.months[0].accounts.length);
  });

  it("reconciles opening + sum(categories) = closing on each row", () => {
    const lines = monthlyRowsCSV(res).split("\n").slice(1);
    for (const line of lines) {
      const f = line.split(",");
      const opening = Number(f[3]);
      const closing = Number(f[f.length - 1]);
      const cats = f.slice(4, f.length - 1).reduce((s, v) => s + Number(v), 0);
      expect(Math.abs(opening + cats - closing)).toBeLessThan(1e-3);
    }
  });
});

describe("transactions CSV", () => {
  it("has a header and one row per transaction", () => {
    const lines = transactionsCSV(res).split("\n");
    expect(lines[0]).toBe("date,month,account,category,amount,label");
    expect(lines.length - 1).toBe(res.transactions.length);
  });

  it("escapes cells containing commas", () => {
    const tricky = simulate({
      ...createSampleScenario(),
      levers: {
        ...createSampleScenario().levers,
        expenseEvents: [
          { id: "x", label: "Furniture, lamps, rugs", kind: "oneoff", amount: 200, startDate: "2026-08-01" },
        ],
      },
    });
    expect(transactionsCSV(tricky)).toContain('"Furniture, lamps, rugs"');
  });
});

describe("ledger JSON", () => {
  it("round-trips the months, transactions, and scheduled taxes", () => {
    const parsed = JSON.parse(ledgerJSON(res));
    expect(parsed.months).toHaveLength(res.months.length);
    expect(parsed.transactions).toHaveLength(res.transactions.length);
    expect(parsed.scheduledTaxes).toHaveLength(res.scheduledTaxes.length);
  });
});
