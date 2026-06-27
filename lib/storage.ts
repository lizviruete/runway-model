// localStorage persistence: saved scenarios + the last working session.
// All access is SSR-guarded and tolerant of malformed/blocked storage.

import type { Scenario } from "./engine/types";

const SAVED_KEY = "runway:saved";
const LAST_KEY = "runway:last";
// `runway:baseline` = the working Δ comparison anchor (rewritten on every change);
// `runway:savedBaseline` = the dated, user-saved record that drives the Baseline pill.
const BASELINE_KEY = "runway:baseline";
const SAVED_BASELINE_KEY = "runway:savedBaseline";

export interface SavedScenario {
  key: string; // storage key (distinct from scenario.id)
  name: string;
  notes?: string; // optional free-text description
  savedAt: string; // ISO-ish label; supplied by caller (no Date in lib core)
  scenario: Scenario;
}

/** A baseline the user explicitly saved (via "Save as baseline"), with a date
 *  and optional note — distinct from the always-rewritten working anchor
 *  (`runway:baseline`). */
export interface SavedBaseline {
  scenario: Scenario;
  savedAt: string;
  notes?: string;
}

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function listSaved(): SavedScenario[] {
  return read<SavedScenario[]>(SAVED_KEY, []);
}

export function saveScenario(
  name: string,
  scenario: Scenario,
  savedAt: string,
  notes?: string,
): SavedScenario[] {
  const all = listSaved();
  // Names are unique (re-saving a name overwrites), so the name is the key.
  const entry: SavedScenario = { key: name, name, notes: notes || undefined, savedAt, scenario };
  const next = [entry, ...all.filter((s) => s.name !== name)];
  write(SAVED_KEY, next);
  return next;
}

export function deleteSaved(key: string): SavedScenario[] {
  const next = listSaved().filter((s) => s.key !== key);
  write(SAVED_KEY, next);
  return next;
}

export function saveLastSession(scenario: Scenario): void {
  write(LAST_KEY, scenario);
}

export function loadLastSession(): Scenario | null {
  return read<Scenario | null>(LAST_KEY, null);
}

/** The reference baseline is persisted too, so "Save as baseline" and the blank
 *  "Start fresh" state survive a reload (otherwise the baseline would snap back
 *  to the sample on mount and the session would read as edited again). */
export function saveLastBaseline(scenario: Scenario): void {
  write(BASELINE_KEY, scenario);
}

export function loadLastBaseline(): Scenario | null {
  return read<Scenario | null>(BASELINE_KEY, null);
}

/** Save / read / clear the dated user-saved baseline that backs the Baseline pill
 *  (independent of the working `runway:baseline` Δ anchor). */
export function setSavedBaseline(scenario: Scenario, savedAt: string, notes?: string): void {
  write(SAVED_BASELINE_KEY, { scenario, savedAt, notes: notes?.trim() || undefined });
}

export function getSavedBaseline(): SavedBaseline | null {
  return read<SavedBaseline | null>(SAVED_BASELINE_KEY, null);
}

export function clearSavedBaseline(): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(SAVED_BASELINE_KEY);
  } catch {
    /* ignore */
  }
}

/** Test-only full wipe (the `?reset=1` hook): clears every persisted key so the
 *  app starts from a pristine blank canvas. No end-user control reaches this. */
export function clearAllSavedData(): void {
  if (!available()) return;
  try {
    for (const key of [SAVED_KEY, SAVED_BASELINE_KEY, LAST_KEY, BASELINE_KEY, "runway:ui"]) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Persist the working session + its baseline — but NEVER while previewing an
 * example. Example mode is ephemeral: the sample scenario and its baseline live
 * in memory only, so the user's real saved session + baseline survive untouched
 * and are restored on exit.
 */
export function persistWorkingState(
  scenario: Scenario,
  baseline: Scenario,
  exampleMode: boolean,
): void {
  if (exampleMode) return;
  saveLastSession(scenario);
  saveLastBaseline(baseline);
}
