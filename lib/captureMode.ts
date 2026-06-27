// `?chrome=min` clean-capture mode for portfolio stills: hides the footer
// disclaimer + the explanatory sub-paragraph and freezes animations/transitions,
// while keeping the H1, tagline, toolbar, and chips/pills visible. Orthogonal to
// the scenario source — composes with any of them (e.g. `?preset=x&chrome=min`).

/** Whether the URL requests the minimal-chrome clean-capture mode. */
export function isCleanCapture(search: string): boolean {
  return new URLSearchParams(search).get("chrome") === "min";
}
