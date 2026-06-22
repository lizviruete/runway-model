// localStorage persistence: saved scenarios + the last working session.
// All access is SSR-guarded and tolerant of malformed/blocked storage.

import type { Scenario } from "./engine/types";

const SAVED_KEY = "runway:saved";
const LAST_KEY = "runway:last";
const BASELINE_KEY = "runway:baseline";
const UI_KEY = "runway:ui";

/** Small slice of UI state worth surviving a reload (e.g. the blank fresh state). */
export interface UiState {
  showLibrary: boolean;
}

export interface SavedScenario {
  key: string; // storage key (distinct from scenario.id)
  name: string;
  notes?: string; // optional free-text description
  savedAt: string; // ISO-ish label; supplied by caller (no Date in lib core)
  scenario: Scenario;
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

export function saveUiState(ui: UiState): void {
  write(UI_KEY, ui);
}

export function loadUiState(): UiState | null {
  return read<UiState | null>(UI_KEY, null);
}
