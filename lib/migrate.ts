// =============================================================================
// Scenario schema migration.
//
// Persisted state lives in five places (a `?s=` link and four localStorage
// keys), and every one of them runs through `migrateScenario` on the way in, so
// the rest of the codebase only ever sees the current shape.
//
// THIS FILE IS THE ONLY PLACE THAT KNOWS WHAT AN OLD SCENARIO LOOKED LIKE.
// The v1 shapes below are local interfaces on purpose: `lib/engine/types.ts`
// describes the CURRENT contract and nothing else, so old shapes never
// accumulate there. When v3 arrives, the same pattern holds — add a `v2 -> v3`
// step here and leave the live types alone.
//
// It is total: it never throws, and it never half-migrates. A payload either
// validates completely and comes out as a current Scenario, or it is rejected
// with `null` and the caller falls back to whatever it does for "nothing
// stored". Producing a partly-converted scenario would mean silently wrong
// numbers, which is the worst failure this product can have.
// =============================================================================

import { seededLine } from "./engine/expenses";
import type { FlowEvent, Levers, Scenario, StepChange } from "./engine/types";

/** The shape this codebase currently writes. Bump when `Scenario` changes. */
export const SCENARIO_VERSION = 2;

/**
 * Belt-and-braces stamp, applied on every WRITE path.
 *
 * `Scenario.version` is required, so the compiler already catches a
 * construction site that forgets it. This covers the remaining hole: anything
 * that reaches a write through a cast or an `as Scenario`. The failure it
 * guards against is asymmetric — a missed stamp does not throw, it makes the
 * scenario unreadable on the next load and silently drops the user's saved
 * work — so it is worth paying for twice.
 */
export function stampVersion<T extends { version?: number }>(scenario: T): T {
  return scenario.version === SCENARIO_VERSION
    ? scenario
    : { ...scenario, version: SCENARIO_VERSION };
}

// -----------------------------------------------------------------------------
// v1 — the shape shipped before V2.1. Housing and living spend were bespoke
// lever fields; only "extra" expenses lived in a list.
// -----------------------------------------------------------------------------

interface V1HousingChange {
  date: string;
  newAmount: number;
}

interface V1HousingLever {
  monthlyAmount: number;
  change?: V1HousingChange;
}

interface V1Levers {
  housing: V1HousingLever;
  targetMonthlySpend: number;
  incomeEvents: unknown;
  expenseEvents?: unknown;
  assetSale?: unknown;
}

// -----------------------------------------------------------------------------
// guards
// -----------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** A flow event, validated. Returns null rather than a half-built line. */
function readFlowEvent(v: unknown): FlowEvent | null {
  if (!isObject(v)) return null;
  if (!isNonEmptyString(v.id)) return null;
  if (typeof v.label !== "string") return null;
  if (!isFiniteNumber(v.amount)) return null;
  if (v.kind !== "recurring" && v.kind !== "oneoff") return null;
  if (!isNonEmptyString(v.startDate)) return null;
  if (v.endDate !== undefined && typeof v.endDate !== "string") return null;
  const line: FlowEvent = {
    id: v.id,
    label: v.label,
    amount: v.amount,
    kind: v.kind,
    startDate: v.startDate,
    ...(typeof v.endDate === "string" && v.endDate ? { endDate: v.endDate } : {}),
  };
  const step = readStepChange(v.stepChange);
  if (step) line.stepChange = step;
  if (v.isEstimate === true) line.isEstimate = true;
  if (v.seeded === "housing" || v.seeded === "living") line.seeded = v.seeded;
  return line;
}

function readStepChange(v: unknown): StepChange | null {
  if (!isObject(v)) return null;
  if (!isNonEmptyString(v.date)) return null;
  if (!isFiniteNumber(v.newAmount)) return null;
  return { date: v.date, newAmount: v.newAmount };
}

/**
 * A list of flow events. A single unreadable ENTRY is dropped rather than
 * failing the whole scenario — losing one bad line is recoverable, losing the
 * scenario is not. A non-array is a structural fault and fails outright.
 */
function readFlowEvents(v: unknown): FlowEvent[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  return v.map(readFlowEvent).filter((e): e is FlowEvent => e !== null);
}

// -----------------------------------------------------------------------------
// v1 -> v2
// -----------------------------------------------------------------------------

/**
 * Collapse the bespoke housing lever and target spend onto the expense
 * primitive. The two seeded lines are pinned first, in that order.
 *
 * - `housing.monthlyAmount` -> the housing line's amount
 * - `housing.change`        -> that SAME line's `stepChange` (not a new line:
 *                              a step change is a change to housing, and
 *                              splitting it would double-count)
 * - `targetMonthlySpend`    -> the living line's amount, flagged `isEstimate`
 * - `expenseEvents[]`       -> carried through verbatim, after the seeded pair
 *
 * Both seeded lines are recurring from the timeline start with no end date,
 * because in v1 housing and living spend applied unconditionally across the
 * whole horizon.
 */
function levers1to2(raw: V1Levers, timelineStart: string): Levers | null {
  if (!isObject(raw.housing)) return null;
  if (!isFiniteNumber(raw.housing.monthlyAmount)) return null;
  if (!isFiniteNumber(raw.targetMonthlySpend)) return null;

  const incomeEvents = readFlowEvents(raw.incomeEvents);
  if (!incomeEvents) return null;
  const added = readFlowEvents(raw.expenseEvents);
  if (!added) return null;

  // A malformed `change` is dropped, not inherited as a broken step: a step
  // change we cannot read is not a step change.
  const step = raw.housing.change === undefined ? null : readStepChange(raw.housing.change);

  const housing = seededLine("housing", raw.housing.monthlyAmount, timelineStart, {
    ...(step ? { stepChange: step } : {}),
  });
  const living = seededLine("living", raw.targetMonthlySpend, timelineStart);

  return {
    incomeEvents,
    // Seeded lines are pinned first; user lines keep their order behind them.
    expenseEvents: [housing, living, ...added.filter((e) => !e.seeded)],
    ...(raw.assetSale !== undefined ? { assetSale: raw.assetSale as Levers["assetSale"] } : {}),
  };
}

// -----------------------------------------------------------------------------
// entry point
// -----------------------------------------------------------------------------

/** Fields every version shares, validated before any version-specific work. */
function readCommon(raw: Record<string, unknown>): Pick<
  Scenario,
  "id" | "name" | "createdDate" | "timeline" | "accounts" | "baselineMonthlySpend"
> | null {
  if (!Array.isArray(raw.accounts)) return null;
  if (!isObject(raw.timeline)) return null;
  if (!isNonEmptyString(raw.timeline.start)) return null;
  if (!isNonEmptyString(raw.timeline.end)) return null;
  return {
    id: typeof raw.id === "string" ? raw.id : "scenario",
    name: typeof raw.name === "string" ? raw.name : "My scenario",
    createdDate:
      typeof raw.createdDate === "string" ? raw.createdDate : raw.timeline.start,
    timeline: { start: raw.timeline.start, end: raw.timeline.end },
    accounts: raw.accounts as Scenario["accounts"],
    ...(isFiniteNumber(raw.baselineMonthlySpend)
      ? { baselineMonthlySpend: raw.baselineMonthlySpend }
      : {}),
  };
}

/**
 * Bring any persisted scenario up to the current shape.
 *
 * Version handling, per ruling (o):
 * - missing or `1` -> migrate from v1
 * - `2`            -> current, validated and passed through
 * - anything else  -> REJECTED. A version from the future is not a v1 payload,
 *                     and guessing at it is strictly worse than declining: a
 *                     later deploy will know how to read it, this one will not.
 *
 * Never throws. Returns null when the payload cannot be migrated safely.
 */
export function migrateScenario(raw: unknown): Scenario | null {
  try {
    if (!isObject(raw)) return null;

    const version = raw.version === undefined ? 1 : raw.version;
    if (version !== 1 && version !== SCENARIO_VERSION) return null;

    const common = readCommon(raw);
    if (!common) return null;
    if (!isObject(raw.levers)) return null;

    let levers: Levers | null;
    if (version === 1) {
      levers = levers1to2(raw.levers as unknown as V1Levers, common.timeline.start);
    } else {
      const incomeEvents = readFlowEvents(raw.levers.incomeEvents);
      const expenseEvents = readFlowEvents(raw.levers.expenseEvents);
      levers =
        incomeEvents && expenseEvents
          ? {
              incomeEvents,
              expenseEvents,
              ...(raw.levers.assetSale !== undefined
                ? { assetSale: raw.levers.assetSale as Levers["assetSale"] }
                : {}),
            }
          : null;
    }
    if (!levers) return null;

    return { ...common, version: SCENARIO_VERSION, levers };
  } catch {
    // Defensive: a hostile payload must degrade to "nothing stored", never throw
    // on the render path.
    return null;
  }
}
