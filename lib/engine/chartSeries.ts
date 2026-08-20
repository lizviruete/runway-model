// =============================================================================
// Chart series assignment — design package §5.
//
// Which colour slot each account draws in, resolved ONCE (ruling n) so the
// card's number chip, the chart band and the legend swatch cannot disagree.
//
// Two rules decide everything here:
//
//   1. LIABILITIES ARE OUT OF THE ROTATION. A credit line always draws slate,
//      and consumes no series slot. Without that, a HELOC sitting at tap
//      position 1 — which item 5 made reachable, by excluding every asset —
//      would either waste series 1 or shunt every asset by one, putting two
//      adjacent bands in the same colour. That off-by-one is exactly what the
//      alternating palette exists to prevent.
//
//   2. AN EXCLUDED ASSET KEEPS ITS SLOT. Colour follows the account, never its
//      rank among survivors: excluding one account must not repaint the others.
//      The cost is that excluding a middle account puts two non-consecutive
//      series side by side — see ruling (u) — which is why the 2px surface gap
//      and the legend's tap number are load-bearing rather than decorative.
// =============================================================================

import { isCreditType } from "./defaults";
import { isExcluded } from "./exclusion";
import type { Account, AccountType } from "./types";

/** How many distinct asset slots the palette defines before it repeats. */
export const SERIES_SLOTS = 8;

/**
 * THE PALETTE — the single source of truth, in slot order.
 *
 * Defined here rather than in globals.css because Tailwind v4 strips custom
 * properties that no CSS rule references, and these are only ever read from
 * TypeScript. The chart root projects them back into real `--chart-*` custom
 * properties (see `chartTokenStyle`), so the ten tokens exist at runtime and
 * anything downstream can still use `var(--chart-series-N)` — but they are
 * declared once, here.
 *
 * Alternating dark/light by tap position: adjacent bands differ in luminance
 * as well as hue. Per ruling (u) eight series cannot pairwise separate, so
 * colour is the SECONDARY channel — the legend's tap number, the 2px surface
 * gap and the named legend/tooltip rows carry identity.
 */
export const SERIES_HEX = [
  "#0f766e", // tap 1 · dark  · teal
  "#7dd3fc", // tap 2 · light · sky
  "#4338ca", // tap 3 · dark  · indigo
  "#f0abfc", // tap 4 · light · fuchsia
  "#be123c", // tap 5 · dark  · rose
  "#fdba74", // tap 6 · light · orange
  "#065f46", // tap 7 · dark  · emerald
  "#86efac", // tap 8 · light · green
] as const;

/** A liability is not a peer of an asset; slate is the one hue absent from
 *  the asset rotation. */
export const LIABILITY_HEX = "#475569";

/** Near-black on purpose: against adjacent colour bands, an overlay line has
 *  to read as "not a series". */
export const NET_HEX = "#111827";

/** CSS custom property names, in slot order. */
export const SERIES_VARS = Array.from(
  { length: SERIES_SLOTS },
  (_, i) => `--chart-series-${i + 1}`,
);

export const LIABILITY_VAR = "--chart-liability";
export const NET_VAR = "--chart-net";

/**
 * The ten tokens as inline custom properties, for the chart's root element.
 *
 * Spread onto a `style` prop. This is what makes `--chart-*` real in the DOM
 * without a stylesheet declaration Tailwind would drop.
 */
export function chartTokenStyle(): Record<string, string> {
  const style: Record<string, string> = {};
  SERIES_VARS.forEach((name, i) => (style[name] = SERIES_HEX[i]));
  style[LIABILITY_VAR] = LIABILITY_HEX;
  style[NET_VAR] = NET_HEX;
  return style;
}

/**
 * The 1px stroke a LIGHT fill carries — its dark partner's hue.
 *
 * Load-bearing, not decoration: a thin light band would otherwise disappear
 * against white. Keyed by slot; dark slots need no stroke.
 */
export const SERIES_STROKE: Record<number, string> = {
  2: "#0284c7",
  4: "#c026d3",
  6: "#ea580c",
  8: "#16a34a",
};

/**
 * `id → series slot` (0-based) for every ASSET, in tap order. Liabilities map
 * to `null` — they are out of the rotation and always draw slate.
 *
 * Excluded assets are counted, so the survivors' colours never shift.
 *
 * Beyond 8 assets the rotation repeats from slot 0. A ninth account is rare
 * enough that repetition beats inventing indistinguishable hues — and per
 * ruling (u) there are no distinguishable hues left to invent.
 */
export function seriesIndex(accounts: Account[]): Map<string, number | null> {
  const slots = new Map<string, number | null>();
  let next = 0;
  for (const account of accounts) {
    if (isCreditType(account.type)) {
      slots.set(account.id, null);
      continue;
    }
    slots.set(account.id, next % SERIES_SLOTS);
    next += 1;
  }
  return slots;
}

/**
 * The colour an account's mark is filled with.
 *
 * Returns a literal hex, NOT `var(--chart-series-N)`: SVG presentation
 * attributes do not parse `var()`, so `fill="var(…)"` silently renders black.
 * The tokens still exist on the chart root for anything that wants them.
 */
export function seriesFill(slot: number | null): string {
  return slot === null ? LIABILITY_HEX : SERIES_HEX[slot];
}

/** The stroke a slot's fill carries, or null for dark slots and liabilities. */
export function seriesStroke(slot: number | null): string | null {
  return slot === null ? null : (SERIES_STROKE[slot + 1] ?? null);
}

/** True when this account draws a band at all: an included asset. */
export function drawsBand(account: Account): boolean {
  return !isCreditType(account.type) && !isExcluded(account);
}

/** Convenience for the card chip, which shares the band's colour (ruling c). */
export function accountFill(accounts: Account[], id: string): string {
  return seriesFill(seriesIndex(accounts).get(id) ?? null);
}

/** Types that draw slate rather than taking a rotation slot. */
export function isOutOfRotation(type: AccountType): boolean {
  return isCreditType(type);
}
