// =============================================================================
// Example-mode state machine (pure, UI-free so it's unit-testable).
//
// "Example mode" is a distinct, in-session state: it shows the fictional sample
// scenario AND reveals the built-in example preset chips. It is never persisted
// — a returning user always restores their own data with no chips.
//
//   default load   → empty canvas (blank), no chips
//   ?s=...         → that scenario, no chips        (URL always wins)
//   ?example=1     → sample + chips                 (mirrors ?s=, lower priority)
//   returning user → restore last session, no chips
// =============================================================================

import { scenarioFromSearch } from "./share";

/** Which source the app hydrates from on mount. */
export type InitSource = "url" | "example" | "restore" | "blank";

/** The example-mode-affecting user actions. */
export type ExampleAction =
  | "seeExample" // "See an Example" → enter
  | "applyPreset" // clicking an example chip → stay
  | "manualEdit" // editing any field/account/lever → soft exit
  | "startFresh" // "Start fresh" → hard exit
  | "saveAsBaseline" // locking the user's own baseline → exit
  | "loadSaved"; // loading a saved scenario → exit

/**
 * Resolve the mount hydration source. Precedence is strict:
 * `?s=` > `?example=1` > a restorable last session > a blank canvas.
 */
export function chooseInitSource(search: string, hasLastSession: boolean): InitSource {
  if (scenarioFromSearch(search)) return "url";
  if (new URLSearchParams(search).get("example") === "1") return "example";
  if (hasLastSession) return "restore";
  return "blank";
}

/** Whether a given init source lands the app in example mode. */
export function isExampleSource(source: InitSource): boolean {
  return source === "example";
}

/**
 * Next example-mode flag given the current flag and a user action. Only
 * `applyPreset` preserves the current state (so switching chips stays in
 * example mode); everything else is a definitive enter/exit.
 */
export function nextExampleMode(current: boolean, action: ExampleAction): boolean {
  switch (action) {
    case "seeExample":
      return true;
    case "applyPreset":
      return current; // selecting a preset is NOT editing into your own scenario
    case "manualEdit":
    case "startFresh":
    case "saveAsBaseline":
    case "loadSaved":
      return false;
  }
}
