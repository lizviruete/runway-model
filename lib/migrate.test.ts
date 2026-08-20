// =============================================================================
// Schema migration — v1 -> v2, and the five hydration boundaries.
//
// The highest-consequence code in V2.1: if any boundary bypasses the migration,
// a user with saved state gets silently wrong numbers or loses their work.
// Ruling (g) asks for one test per boundary; the acceptance bar is at the
// bottom — a REAL v1 link, frozen before the migration existed, producing the
// runway it produced then.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simulate } from "./engine/simulate";
import { SEEDED_IDS } from "./engine/expenses";
import type { Scenario } from "./engine/types";
import { migrateScenario, SCENARIO_VERSION, stampVersion } from "./migrate";
import { createBlankScenario, createSampleScenario } from "./sample";
import { decodeScenario, encodeScenario } from "./share";
import {
  getSavedBaseline,
  listSaved,
  loadLastBaseline,
  loadLastSession,
  saveScenario,
} from "./storage";

// ---- v1 builders -------------------------------------------------------------

/** A minimal, VALID v1 scenario — the shape shipped before V2.1. */
function v1(levers?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "s1",
    name: "Old scenario",
    createdDate: "2026-07-01",
    timeline: { start: "2026-07-01", end: "2027-06-30" },
    accounts: [
      {
        id: "acc-1",
        name: "Checking",
        type: "checking",
        balance: 10_000,
        depletionPriority: 1,
        taxTreatment: {
          effectiveRate: 0,
          taxableFraction: 0,
          earlyPenaltyRate: 0,
          penalizedFraction: 0,
          timing: "immediate",
        },
        ongoingCost: { kind: "none", annualRate: 0 },
      },
    ],
    levers: {
      housing: { monthlyAmount: 2_000 },
      targetMonthlySpend: 3_000,
      incomeEvents: [],
      expenseEvents: [],
      ...levers,
    },
  };
}

const lines = (s: Scenario) => s.levers.expenseEvents;
const seeded = (s: Scenario, which: "housing" | "living") =>
  s.levers.expenseEvents.find((e) => e.seeded === which)!;

/**
 * Encode a payload the way v1 did — plain base64url of the JSON, with NO
 * version stamp. `encodeScenario` cannot stand in here: it stamps the current
 * version, so a v1 payload pushed through it would come back mislabelled as v2
 * and skip the collapse entirely. (That stamp is safe in the app because
 * `Scenario` requires `version`, so nothing unstamped can reach it — but this
 * test deliberately works with raw pre-V2.1 payloads.)
 */
function encodeV1(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** In-memory localStorage, matching the pattern in storage.test.ts. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

// =============================================================================
// v1 -> v2 mapping
// =============================================================================

describe("v1 -> v2 mapping", () => {
  it("collapses plain housing and target spend onto two seeded lines, pinned first", () => {
    const s = migrateScenario(v1())!;
    expect(s.version).toBe(SCENARIO_VERSION);
    expect(lines(s)).toHaveLength(2);
    expect(lines(s)[0].seeded).toBe("housing");
    expect(lines(s)[1].seeded).toBe("living");

    const housing = seeded(s, "housing");
    expect(housing.id).toBe(SEEDED_IDS.housing);
    expect(housing.amount).toBe(2_000);
    expect(housing.kind).toBe("recurring");
    expect(housing.startDate).toBe("2026-07-01"); // the timeline start
    expect(housing.endDate).toBeUndefined(); // runs the whole horizon
    expect(housing.stepChange).toBeUndefined();
    expect(housing.isEstimate).toBeUndefined(); // housing is entered, not modeled

    const living = seeded(s, "living");
    expect(living.id).toBe(SEEDED_IDS.living);
    expect(living.amount).toBe(3_000);
    expect(living.isEstimate).toBe(true); // this is what carries the "≈"
  });

  it("maps the housing 'changes later' pair onto that SAME line's stepChange", () => {
    const s = migrateScenario(
      v1({ housing: { monthlyAmount: 2_800, change: { date: "2026-09-01", newAmount: 1_400 } } }),
    )!;
    // Not a second line: a step change is a change TO housing.
    expect(lines(s)).toHaveLength(2);
    expect(seeded(s, "housing").stepChange).toEqual({ date: "2026-09-01", newAmount: 1_400 });
  });

  it("keeps housing at $0 as a real line rather than dropping it", () => {
    // Seeded lines are always present — the expenses section is never empty.
    const s = migrateScenario(v1({ housing: { monthlyAmount: 0 }, targetMonthlySpend: 0 }))!;
    expect(lines(s)).toHaveLength(2);
    expect(seeded(s, "housing").amount).toBe(0);
    expect(seeded(s, "living").amount).toBe(0);
  });

  it("migrates target spend with no housing amount at all", () => {
    const s = migrateScenario(v1({ housing: { monthlyAmount: 0 }, targetMonthlySpend: 4_200 }))!;
    expect(seeded(s, "housing").amount).toBe(0);
    expect(seeded(s, "living").amount).toBe(4_200);
  });

  it("carries zero added expenses", () => {
    expect(lines(migrateScenario(v1())!)).toHaveLength(2);
  });

  it("carries a dozen added expenses verbatim, behind the seeded pair", () => {
    const dozen = Array.from({ length: 12 }, (_, i) => ({
      id: `exp-${i}`,
      label: `Expense ${i}`,
      amount: 100 + i,
      kind: "recurring" as const,
      startDate: "2026-07-01",
    }));
    const s = migrateScenario(v1({ expenseEvents: dozen }))!;
    expect(lines(s)).toHaveLength(14);
    expect(lines(s).slice(0, 2).map((e) => e.seeded)).toEqual(["housing", "living"]);
    expect(lines(s).slice(2).map((e) => e.id)).toEqual(dozen.map((e) => e.id));
    expect(lines(s)[5].amount).toBe(103);
  });

  it("leaves income events untouched", () => {
    const income = [
      { id: "inc-1", label: "Severance", amount: 9_000, kind: "recurring", startDate: "2026-07-01" },
    ];
    const s = migrateScenario(v1({ incomeEvents: income }))!;
    expect(s.levers.incomeEvents).toEqual(income);
    // …and never gains the expense-only fields.
    expect(s.levers.incomeEvents[0]).not.toHaveProperty("seeded");
    expect(s.levers.incomeEvents[0]).not.toHaveProperty("isEstimate");
  });
});

// =============================================================================
// version handling — ruling (o)
// =============================================================================

describe("version handling", () => {
  it("treats a missing version as v1", () => {
    expect(migrateScenario(v1())!.version).toBe(SCENARIO_VERSION);
  });

  it("treats an explicit version 1 as v1", () => {
    expect(migrateScenario({ ...v1(), version: 1 })!.version).toBe(SCENARIO_VERSION);
  });

  it("passes a v2 payload through untouched", () => {
    const v2 = createSampleScenario("2026-07-01");
    const out = migrateScenario(structuredClone(v2))!;
    expect(out.levers.expenseEvents).toEqual(v2.levers.expenseEvents);
    expect(out.levers.incomeEvents).toEqual(v2.levers.incomeEvents);
    expect(out.timeline).toEqual(v2.timeline);
    expect(out.version).toBe(SCENARIO_VERSION);
  });

  it("REJECTS a version from the future rather than guessing", () => {
    // Ruling (o): a later deploy will know how to read it; this one must not
    // attempt a v1 migration on it.
    expect(migrateScenario({ ...createSampleScenario(), version: 3 })).toBeNull();
    expect(migrateScenario({ ...createSampleScenario(), version: 99 })).toBeNull();
  });

  it("rejects an unparseable version", () => {
    for (const version of ["2", null, NaN, {}, [], true]) {
      expect(migrateScenario({ ...v1(), version })).toBeNull();
    }
  });

  it("is idempotent — migrating twice is stable", () => {
    const once = migrateScenario(v1({ housing: { monthlyAmount: 2_800, change: { date: "2026-09-01", newAmount: 1_400 } } }))!;
    const twice = migrateScenario(structuredClone(once))!;
    expect(twice).toEqual(once);
    expect(migrateScenario(structuredClone(twice))).toEqual(once);
  });
});

// =============================================================================
// fail-safe — never half-migrate
// =============================================================================

describe("malformed payloads fail safe", () => {
  it("rejects structurally broken input instead of throwing", () => {
    for (const bad of [null, undefined, 42, "nope", [], {}, { accounts: [] }]) {
      expect(() => migrateScenario(bad)).not.toThrow();
      expect(migrateScenario(bad)).toBeNull();
    }
  });

  it("rejects a v1 scenario missing the housing lever, rather than half-migrating", () => {
    const broken = v1();
    delete (broken.levers as Record<string, unknown>).housing;
    expect(migrateScenario(broken)).toBeNull();
  });

  it("rejects non-numeric amounts on the collapsing fields", () => {
    expect(migrateScenario(v1({ housing: { monthlyAmount: "2000" } }))).toBeNull();
    expect(migrateScenario(v1({ targetMonthlySpend: null }))).toBeNull();
    expect(migrateScenario(v1({ housing: { monthlyAmount: NaN } }))).toBeNull();
  });

  it("rejects a missing or malformed timeline", () => {
    const noTimeline = v1();
    delete noTimeline.timeline;
    expect(migrateScenario(noTimeline)).toBeNull();
    expect(migrateScenario({ ...v1(), timeline: { start: "2026-07-01" } })).toBeNull();
  });

  it("drops one unreadable expense entry but keeps the scenario", () => {
    // Losing a line is recoverable; losing the scenario is not.
    const s = migrateScenario(
      v1({
        expenseEvents: [
          { id: "ok", label: "Childcare", amount: 1_400, kind: "recurring", startDate: "2026-07-01" },
          { id: "bad", label: "Broken", amount: "lots", kind: "recurring", startDate: "2026-07-01" },
        ],
      }),
    )!;
    expect(s).not.toBeNull();
    expect(lines(s).map((e) => e.id)).toEqual([SEEDED_IDS.housing, SEEDED_IDS.living, "ok"]);
  });

  it("drops a malformed housing step change rather than inheriting a broken one", () => {
    const s = migrateScenario(
      v1({ housing: { monthlyAmount: 2_000, change: { date: "2026-09-01" } } }),
    )!;
    expect(seeded(s, "housing").amount).toBe(2_000);
    expect(seeded(s, "housing").stepChange).toBeUndefined();
  });
});

// =============================================================================
// the five hydration boundaries — ruling (g)
// =============================================================================

describe("hydration boundaries", () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal("window", { localStorage: store });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("1/5 · decodeScenario migrates a v1 ?s= link", () => {
    const s = decodeScenario(encodeV1(v1()))!;
    expect(s).not.toBeNull();
    expect(s.version).toBe(SCENARIO_VERSION);
    expect(seeded(s, "housing").amount).toBe(2_000);
    expect(seeded(s, "living").amount).toBe(3_000);
  });

  it("1/5 · decodeScenario returns null for a payload it cannot migrate", () => {
    const broken = v1();
    delete (broken.levers as Record<string, unknown>).housing;
    expect(decodeScenario(encodeV1(broken))).toBeNull();
    expect(decodeScenario("not-base64!!")).toBeNull();
  });

  it("2/5 · listSaved migrates every entry and drops ONLY the corrupt one", () => {
    store.setItem(
      "runway:saved",
      JSON.stringify([
        { key: "a", name: "A", savedAt: "2026-07-01", scenario: v1() },
        { key: "bad", name: "Bad", savedAt: "2026-07-02", scenario: { nope: true } },
        { key: "c", name: "C", savedAt: "2026-07-03", scenario: v1({ targetMonthlySpend: 999 }) },
      ]),
    );
    const saved = listSaved();
    // The bad entry is gone; the other two survive with their wrappers intact.
    expect(saved.map((e) => e.key)).toEqual(["a", "c"]);
    expect(saved[0].savedAt).toBe("2026-07-01");
    expect(seeded(saved[0].scenario, "living").amount).toBe(3_000);
    expect(seeded(saved[1].scenario, "living").amount).toBe(999);
  });

  it("3/5 · loadLastSession migrates runway:last", () => {
    store.setItem("runway:last", JSON.stringify(v1()));
    const s = loadLastSession()!;
    expect(s.version).toBe(SCENARIO_VERSION);
    expect(seeded(s, "housing").amount).toBe(2_000);
  });

  it("4/5 · loadLastBaseline migrates runway:baseline", () => {
    store.setItem("runway:baseline", JSON.stringify(v1({ targetMonthlySpend: 1_234 })));
    const s = loadLastBaseline()!;
    expect(s.version).toBe(SCENARIO_VERSION);
    expect(seeded(s, "living").amount).toBe(1_234);
  });

  it("5/5 · getSavedBaseline migrates inside its wrapper, preserving savedAt and notes", () => {
    store.setItem(
      "runway:savedBaseline",
      JSON.stringify({ scenario: v1(), savedAt: "2026-07-04", notes: "before the move" }),
    );
    const b = getSavedBaseline()!;
    expect(b.savedAt).toBe("2026-07-04");
    expect(b.notes).toBe("before the move");
    expect(b.scenario.version).toBe(SCENARIO_VERSION);
    expect(seeded(b.scenario, "housing").amount).toBe(2_000);
  });

  it("5/5 · getSavedBaseline nulls the whole record when its scenario is unmigratable", () => {
    store.setItem(
      "runway:savedBaseline",
      JSON.stringify({ scenario: { nope: true }, savedAt: "2026-07-04" }),
    );
    expect(getSavedBaseline()).toBeNull();
  });
});

// =============================================================================
// a freshly created scenario must survive a round trip
// =============================================================================

describe("newly created scenarios are stamped", () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    store = fakeStorage();
    vi.stubGlobal("window", { localStorage: store });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stamps every construction site", () => {
    expect(createSampleScenario().version).toBe(SCENARIO_VERSION);
    expect(createBlankScenario().version).toBe(SCENARIO_VERSION);
  });

  it("a fresh scenario persisted and hydrated comes back intact, NOT null", () => {
    // The silent-data-loss case: an unstamped v2 scenario would read back as v1,
    // fail v1 validation, and be dropped — deleting the user's work.
    const fresh = createBlankScenario("2026-07-01");
    saveScenario("My plan", fresh, "2026-07-01");
    const back = listSaved()[0];
    expect(back).toBeDefined();
    expect(back.scenario).not.toBeNull();
    expect(back.scenario.version).toBe(SCENARIO_VERSION);
    expect(back.scenario.levers.expenseEvents).toHaveLength(2);
  });

  it("stampVersion rescues a scenario that reached a write path unstamped", () => {
    const unstamped = { ...createBlankScenario("2026-07-01") } as Partial<Scenario>;
    delete unstamped.version;
    expect(migrateScenario(structuredClone(unstamped))).toBeNull(); // would be lost…
    expect(migrateScenario(stampVersion(unstamped) as Scenario)).not.toBeNull(); // …but isn't
  });

  it("a fresh scenario survives an encode/decode round trip", () => {
    const fresh = createSampleScenario("2026-07-01");
    const back = decodeScenario(encodeScenario(fresh))!;
    expect(back).not.toBeNull();
    expect(back.levers.expenseEvents).toEqual(fresh.levers.expenseEvents);
  });
});

// =============================================================================
// ACCEPTANCE — a real v1 link produces the runway it produced before
// =============================================================================

describe("acceptance: a real v1 ?s= link is unchanged by the migration", () => {
  /**
   * A genuine `?s=` payload, generated from the shipped v1 code and frozen
   * BEFORE the migration existed: the example scenario plus a housing step
   * change and three added expenses. 3,951 bytes.
   *
   * The runway below was captured from the same pre-migration build. If this
   * test ever fails, a shared link has silently changed someone's numbers.
   */
  const V1_LINK =
    "eyJpZCI6InNhbXBsZSIsIm5hbWUiOiJTYW1wbGUgVXNlciDigJQgcmVjZW50IHRyYW5zaXRpb24iLCJjcmVhdGVkRGF0ZSI6" +
    "IjIwMjYtMDctMDEiLCJ0aW1lbGluZSI6eyJzdGFydCI6IjIwMjYtMDctMDEiLCJlbmQiOiIyMDMxLTA2LTMwIn0sImFjY291" +
    "bnRzIjpbeyJpZCI6ImFjYy1jaGVja2luZyIsIm5hbWUiOiJFdmVyeWRheSBDaGVja2luZyIsInR5cGUiOiJjaGVja2luZyIs" +
    "ImJhbGFuY2UiOjMwMDAsImRlcGxldGlvblByaW9yaXR5IjoxLCJ0YXhUcmVhdG1lbnQiOnsiZWZmZWN0aXZlUmF0ZSI6MCwi" +
    "dGF4YWJsZUZyYWN0aW9uIjowLCJlYXJseVBlbmFsdHlSYXRlIjowLCJwZW5hbGl6ZWRGcmFjdGlvbiI6MCwidGltaW5nIjoi" +
    "aW1tZWRpYXRlIn0sIm9uZ29pbmdDb3N0Ijp7ImtpbmQiOiJub25lIiwiYW5udWFsUmF0ZSI6MH19LHsiaWQiOiJhY2Mtc2F2" +
    "aW5ncyIsIm5hbWUiOiJTYXZpbmdzIiwidHlwZSI6InNhdmluZ3MiLCJiYWxhbmNlIjo0MDAwLCJkZXBsZXRpb25Qcmlvcml0" +
    "eSI6MiwidGF4VHJlYXRtZW50Ijp7ImVmZmVjdGl2ZVJhdGUiOjAsInRheGFibGVGcmFjdGlvbiI6MCwiZWFybHlQZW5hbHR5" +
    "UmF0ZSI6MCwicGVuYWxpemVkRnJhY3Rpb24iOjAsInRpbWluZyI6ImltbWVkaWF0ZSJ9LCJvbmdvaW5nQ29zdCI6eyJraW5k" +
    "Ijoibm9uZSIsImFubnVhbFJhdGUiOjB9fSx7ImlkIjoiYWNjLWh5c2EiLCJuYW1lIjoiSGlnaC1ZaWVsZCBTYXZpbmdzIiwi" +
    "dHlwZSI6Imh5c2EiLCJiYWxhbmNlIjo0MDAwLCJkZXBsZXRpb25Qcmlvcml0eSI6MywidGF4VHJlYXRtZW50Ijp7ImVmZmVj" +
    "dGl2ZVJhdGUiOjAsInRheGFibGVGcmFjdGlvbiI6MCwiZWFybHlQZW5hbHR5UmF0ZSI6MCwicGVuYWxpemVkRnJhY3Rpb24i" +
    "OjAsInRpbWluZyI6ImltbWVkaWF0ZSJ9LCJvbmdvaW5nQ29zdCI6eyJraW5kIjoiaW50ZXJlc3RfZWFybmVkIiwiYW5udWFs" +
    "UmF0ZSI6MC4wNH19LHsiaWQiOiJhY2MtYnJva2VyYWdlIiwibmFtZSI6IkJyb2tlcmFnZSIsInR5cGUiOiJicm9rZXJhZ2Ui" +
    "LCJiYWxhbmNlIjo1MDAwLCJkZXBsZXRpb25Qcmlvcml0eSI6NCwidGF4VHJlYXRtZW50Ijp7ImVmZmVjdGl2ZVJhdGUiOjAu" +
    "MTUsInRheGFibGVGcmFjdGlvbiI6MC41LCJlYXJseVBlbmFsdHlSYXRlIjowLCJwZW5hbGl6ZWRGcmFjdGlvbiI6MCwidGlt" +
    "aW5nIjoibmV4dF9hcHJpbCJ9LCJvbmdvaW5nQ29zdCI6eyJraW5kIjoibm9uZSIsImFubnVhbFJhdGUiOjB9fSx7ImlkIjoi" +
    "YWNjLXJvdGgiLCJuYW1lIjoiUm90aCBJUkEiLCJ0eXBlIjoicm90aCIsImJhbGFuY2UiOjMwMDAsImRlcGxldGlvblByaW9y" +
    "aXR5Ijo1LCJ0YXhUcmVhdG1lbnQiOnsiZWZmZWN0aXZlUmF0ZSI6MC4yMiwidGF4YWJsZUZyYWN0aW9uIjowLCJlYXJseVBl" +
    "bmFsdHlSYXRlIjowLjEsInBlbmFsaXplZEZyYWN0aW9uIjowLCJ0aW1pbmciOiJuZXh0X2FwcmlsIn0sIm9uZ29pbmdDb3N0" +
    "Ijp7ImtpbmQiOiJub25lIiwiYW5udWFsUmF0ZSI6MH19LHsiaWQiOiJhY2MtcHJldGF4IiwibmFtZSI6IlByZS10YXggSVJB" +
    "IiwidHlwZSI6InByZXRheCIsImJhbGFuY2UiOjMwMDAsImRlcGxldGlvblByaW9yaXR5Ijo2LCJ0YXhUcmVhdG1lbnQiOnsi" +
    "ZWZmZWN0aXZlUmF0ZSI6MC4yMiwidGF4YWJsZUZyYWN0aW9uIjoxLCJlYXJseVBlbmFsdHlSYXRlIjowLjEsInBlbmFsaXpl" +
    "ZEZyYWN0aW9uIjoxLCJ0aW1pbmciOiJuZXh0X2FwcmlsIn0sIm9uZ29pbmdDb3N0Ijp7ImtpbmQiOiJub25lIiwiYW5udWFs" +
    "UmF0ZSI6MH19LHsiaWQiOiJhY2MtaGVsb2MiLCJuYW1lIjoiSEVMT0MiLCJ0eXBlIjoiY3JlZGl0X2xpbmUiLCJiYWxhbmNl" +
    "IjoyMDAwLCJkZXBsZXRpb25Qcmlvcml0eSI6NywidGF4VHJlYXRtZW50Ijp7ImVmZmVjdGl2ZVJhdGUiOjAsInRheGFibGVG" +
    "cmFjdGlvbiI6MCwiZWFybHlQZW5hbHR5UmF0ZSI6MCwicGVuYWxpemVkRnJhY3Rpb24iOjAsInRpbWluZyI6ImltbWVkaWF0" +
    "ZSJ9LCJvbmdvaW5nQ29zdCI6eyJraW5kIjoiY3JlZGl0X2ludGVyZXN0IiwiYW5udWFsUmF0ZSI6MC4wODV9fV0sImxldmVy" +
    "cyI6eyJob3VzaW5nIjp7Im1vbnRobHlBbW91bnQiOjI4MDAsImNoYW5nZSI6eyJkYXRlIjoiMjAyNi0wOS0wMSIsIm5ld0Ft" +
    "b3VudCI6MTQwMH19LCJ0YXJnZXRNb250aGx5U3BlbmQiOjY1MDAsImluY29tZUV2ZW50cyI6W3siaWQiOiJpbmMtc2FsYXJ5" +
    "IiwibGFiZWwiOiJTYWxhcnkgLyBwcmltYXJ5IGluY29tZSIsImtpbmQiOiJyZWN1cnJpbmciLCJhbW91bnQiOjAsInN0YXJ0" +
    "RGF0ZSI6IjIwMjYtMDctMDEifSx7ImlkIjoiaW5jLXNldmVyYW5jZSIsImxhYmVsIjoiU2V2ZXJhbmNlIiwia2luZCI6InJl" +
    "Y3VycmluZyIsImFtb3VudCI6OTAwMCwic3RhcnREYXRlIjoiMjAyNi0wNy0wMSIsImVuZERhdGUiOiIyMDI2LTA4LTMxIn0s" +
    "eyJpZCI6ImluYy11bmVtcGxveW1lbnQiLCJsYWJlbCI6IlVuZW1wbG95bWVudCBiZW5lZml0Iiwia2luZCI6InJlY3Vycmlu" +
    "ZyIsImFtb3VudCI6MzkwMCwic3RhcnREYXRlIjoiMjAyNi0wOS0wMSIsImVuZERhdGUiOiIyMDI3LTAyLTI4In0seyJpZCI6" +
    "Im9uZS1hc3NldC1zYWxlIiwibGFiZWwiOiJBc3NldCBzYWxlIiwia2luZCI6Im9uZW9mZiIsImFtb3VudCI6ODAwMCwic3Rh" +
    "cnREYXRlIjoiMjAyNi0wOC0wMSJ9XSwiZXhwZW5zZUV2ZW50cyI6W3siaWQiOiJleHAtMSIsImxhYmVsIjoiQ2hpbGRjYXJl" +
    "IiwiYW1vdW50IjoxNDAwLCJraW5kIjoicmVjdXJyaW5nIiwic3RhcnREYXRlIjoiMjAyNi0wNy0wMSIsImVuZERhdGUiOiIy" +
    "MDI2LTEyLTMxIn0seyJpZCI6ImV4cC0yIiwibGFiZWwiOiJDT0JSQSIsImFtb3VudCI6MTg1MCwia2luZCI6InJlY3Vycmlu" +
    "ZyIsInN0YXJ0RGF0ZSI6IjIwMjYtMDctMDEifSx7ImlkIjoiZXhwLTMiLCJsYWJlbCI6IlF1YXJ0ZXJseSB0YXhlcyIsImFt" +
    "b3VudCI6MzIwMCwia2luZCI6Im9uZW9mZiIsInN0YXJ0RGF0ZSI6IjIwMjYtMDktMTUifV19LCJiYXNlbGluZU1vbnRobHlT" +
    "cGVuZCI6NjUwMH0";

  it("decodes, migrates, and produces the identical runway", () => {
    const s = decodeScenario(V1_LINK);
    expect(s).not.toBeNull();

    const r = simulate(s!).runway;
    expect(r.cashZeroDate).toBe("2026-11-30");
    expect(r.months).toBeCloseTo(4.993839835728953, 10);
    expect(r.weeks).toBeCloseTo(21.714285714285715, 10);
    expect(r.survivesHorizon).toBe(false);
  });

  it("lands the old lever values on the right lines", () => {
    const s = decodeScenario(V1_LINK)!;
    expect(seeded(s, "housing").amount).toBe(2_800);
    expect(seeded(s, "housing").stepChange).toEqual({ date: "2026-09-01", newAmount: 1_400 });
    expect(seeded(s, "living").amount).toBe(6_500);
    expect(seeded(s, "living").isEstimate).toBe(true);
    // three added expenses, still behind the seeded pair, in order
    expect(lines(s).map((e) => e.id)).toEqual([
      SEEDED_IDS.housing,
      SEEDED_IDS.living,
      "exp-1",
      "exp-2",
      "exp-3",
    ]);
  });

  it("preserves the monthly housing and living outflows month by month", () => {
    const s = decodeScenario(V1_LINK)!;
    const res = simulate(s);
    const out = (mk: string, cat: "housing" | "living") =>
      res.months.find((m) => m.monthKey === mk)!.accounts.reduce(
        (t, a) => t + (a.outflows[cat] ?? 0),
        0,
      );
    // housing steps down from Sep 2026, living is flat — exactly as in v1
    expect(out("2026-07", "housing")).toBe(2_800);
    expect(out("2026-08", "housing")).toBe(2_800);
    expect(out("2026-09", "housing")).toBe(1_400);
    expect(out("2026-07", "living")).toBe(6_500);
    expect(out("2026-09", "living")).toBe(6_500);
  });
});
