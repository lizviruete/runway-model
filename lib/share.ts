// Encode/decode a full Scenario to/from a single compact URL param (`?s=`),
// so a shared link fully reproduces a scenario on load. URL-safe base64 of the
// JSON (not one query param per field). Works in both browser and Node (tests).

import type { Scenario } from "./engine/types";
import { migrateScenario, stampVersion } from "./migrate";

const PARAM = "s";

function toBase64Url(json: string): string {
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(json, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(param: string): string {
  let b64 = param.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return typeof window === "undefined"
    ? Buffer.from(b64, "base64").toString("utf-8")
    : decodeURIComponent(escape(atob(b64)));
}

export function encodeScenario(scenario: Scenario): string {
  return toBase64Url(JSON.stringify(stampVersion(scenario)));
}

/**
 * HYDRATION BOUNDARY 1 of 5 — the `?s=` share link.
 *
 * Parse, then migrate. The migration owns all validation now, so a v1 link, a
 * v2 link and a hand-edited payload are all handled in one place: anything that
 * cannot be brought to the current shape returns null, and the caller treats
 * that exactly as it treats an absent param.
 */
export function decodeScenario(param: string): Scenario | null {
  try {
    return migrateScenario(JSON.parse(fromBase64Url(param)));
  } catch {
    return null;
  }
}

/** Build a full shareable URL for the current origin + path. */
export function shareableUrl(scenario: Scenario, base: string): string {
  const url = new URL(base);
  url.searchParams.set(PARAM, encodeScenario(scenario));
  return url.toString();
}

/** Read the scenario param from a URL search string, if present. */
export function scenarioFromSearch(search: string): Scenario | null {
  const param = new URLSearchParams(search).get(PARAM);
  return param ? decodeScenario(param) : null;
}

export const SHARE_PARAM = PARAM;
