// =============================================================================
// Pure model for the inline SAVED pills (baseline + saved scenarios). UI-free so
// it's unit-testable; the Toolbar renders straight from this list.
//
// The Baseline pill (the user's dated, saved baseline) is pinned first and
// styled distinctly; each saved scenario follows as its own pill.
// =============================================================================

import type { SavedBaseline, SavedScenario } from "./storage";

export interface SavedPill {
  kind: "baseline" | "scenario";
  key: string; // "baseline" for the baseline pill, else the saved-scenario key
  label: string; // pill text (scenario name, or "Baseline")
  date: string; // savedAt — shown beneath the pill
  notes?: string; // saved-scenario notes, when present
}

/** Build the ordered pill list: the saved baseline first (if any), then each
 *  saved scenario. Returns [] when nothing is saved (no SAVED label either). */
export function buildSavedPills(
  savedBaseline: SavedBaseline | null,
  saved: SavedScenario[],
): SavedPill[] {
  const pills: SavedPill[] = [];
  if (savedBaseline) {
    pills.push({
      kind: "baseline",
      key: "baseline",
      label: "Baseline",
      date: savedBaseline.savedAt,
      notes: savedBaseline.notes,
    });
  }
  for (const s of saved) {
    pills.push({ kind: "scenario", key: s.key, label: s.name, date: s.savedAt, notes: s.notes });
  }
  return pills;
}
