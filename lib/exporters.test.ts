import { describe, expect, it } from "vitest";
import { ledgerJSON, monthlyRowsCSV, transactionsCSV } from "./exporters";
import { simulate } from "./engine/simulate";
import { createSampleScenario } from "./sample";

const res = simulate(createSampleScenario());

describe("monthly rows CSV", () => {
  it("has a header and one row per account per month", () => {
    const lines = monthlyRowsCSV(res).split("\n");
    expect(lines[0]).toBe(
      "month,account,type,opening,income,housing,living,expense,assetSale,assetCarry,tax,creditInterest,interestEarned,growth,tapIn,tapOut,closing,net",
    );
    expect(lines.length - 1).toBe(res.months.length * res.months[0].accounts.length);
  });

  it("reconciles opening + sum(categories) = closing on each row", () => {
    // Columns are looked up BY HEADER NAME, not by position. Appending `net`
    // broke the previous positional version — it silently swept `closing` into
    // the category sum — which is the class of test that stops testing what it
    // claims the moment a column is added.
    const lines = monthlyRowsCSV(res).split("\n");
    const header = lines[0].split(",");
    const at = (f: string[], name: string) => Number(f[header.indexOf(name)]);
    const catNames = header.slice(header.indexOf("income"), header.indexOf("closing"));

    for (const line of lines.slice(1)) {
      const f = line.split(",");
      const cats = catNames.reduce((s, name) => s + at(f, name), 0);
      expect(Math.abs(at(f, "opening") + cats - at(f, "closing"))).toBeLessThan(1e-3);
    }
  });

  it("carries the month's NET on every row of that month (item 7)", () => {
    // A month-level fact, repeated per account row — and the same figure the
    // summary bar and the chart tooltip read, never re-derived (ruling n).
    const lines = monthlyRowsCSV(res).split("\n");
    const header = lines[0].split(",");
    const netAt = header.indexOf("net");
    const monthAt = header.indexOf("month");
    expect(netAt).toBeGreaterThan(-1);

    for (const line of lines.slice(1)) {
      const f = line.split(",");
      const month = res.months.find((m) => m.monthKey === f[monthAt])!;
      expect(Number(f[netAt])).toBeCloseTo(month.totals.net, 6);
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
