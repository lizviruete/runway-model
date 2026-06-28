"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CHART_MODE, type ChartMode } from "@/lib/chart";
import { visibleMonthCount } from "@/lib/chartWindow";
import { simulate } from "@/lib/engine/simulate";
import type { Scenario } from "@/lib/engine/types";
import { hasMeaningfulAmounts } from "@/lib/baseline";
import { isCleanCapture } from "@/lib/captureMode";
import { chooseInitSource, nextExampleMode, presetIdFromSearch } from "@/lib/exampleMode";
import { getPreset, PRESETS, type Preset } from "@/lib/presets";
import { createBlankScenario, createSampleScenario, SAMPLE_AS_OF } from "@/lib/sample";
import { encodeScenario, scenarioFromSearch, shareableUrl } from "@/lib/share";
import {
  clearAllSavedData,
  clearSavedBaseline,
  deleteSaved,
  getSavedBaseline,
  listSaved,
  loadLastBaseline,
  loadLastSession,
  persistWorkingState,
  type SavedBaseline,
  type SavedScenario,
  saveScenario,
  setSavedBaseline,
} from "@/lib/storage";
import { AccountList } from "./AccountList";
import { HeroMetrics } from "./HeroMetrics";
import { LedgerView } from "./LedgerView";
import { Levers } from "./Levers";
import { RunwayChart } from "./RunwayChart";
import { TimeAnchor } from "./TimeAnchor";
import { Toolbar } from "./Toolbar";
import { Card, SectionTitle } from "./ui";

function todayISO(): string {
  // App-side only; fine to read the clock here (not the pure engine).
  return new Date().toISOString().slice(0, 10);
}

const BASELINE_LABEL = "Baseline — your plan, carried forward, no changes.";
const BASELINE_HELP =
  "Your financial picture heading into a major life transition — a layoff, leave, sabbatical, or going out on your own — projected forward as if everything stays the same. Every scenario you build is measured against it.";

export function RunwayApp() {
  // SSR + first render use the canonical anchor so the markup is deterministic;
  // the mount effect re-anchors everything to the real "today". The default is
  // the empty canvas (a blank scenario), so a first-time visitor lands on a
  // clean slate with no sample data and no example chips.
  const [today, setToday] = useState<string>(SAMPLE_AS_OF);
  const [baselineScenario, setBaselineScenario] = useState<Scenario>(() => createBlankScenario());
  const [scenario, setScenario] = useState<Scenario>(() => createBlankScenario());
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [savedBaseline, setSavedBaselineState] = useState<SavedBaseline | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>(DEFAULT_CHART_MODE);
  const [mounted, setMounted] = useState(false);
  // `?chrome=min` clean-capture mode for portfolio stills (hide footer + sub-copy,
  // freeze animations). Read from the URL on mount; orthogonal to the source.
  const [chromeMin, setChromeMin] = useState(false);
  // Example mode (the fictional sample + the built-in example preset chips) is a
  // distinct, in-session state, reached via "See an Example" or `?example=1`. It
  // is never persisted — a returning user always restores their own data, with
  // no chips. Off by default → the empty canvas.
  const [exampleMode, setExampleMode] = useState(false);

  const encodedBaseline = useMemo(() => encodeScenario(baselineScenario), [baselineScenario]);

  // On mount, anchor the sample to the real "today", then hydrate by source in
  // strict precedence (see `chooseInitSource`): `?reset=1` (test-only wipe) >
  // `?s=` > a valid `?preset=<id>` > `?example=1` > the returning user's last
  // localStorage session > a blank canvas. We render the deterministic SSR blank
  // first and sync from these client-only sources after mount (reading them
  // during render would cause a hydration mismatch), so the post-mount setState
  // is intentional here. `mounted` is a STATE flag (not a ref) so the persist
  // effect below reliably sees `false` on the first commit and can't clobber
  // storage with the pre-hydration blank.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const now = todayISO();
    const search = window.location.search;
    const sample = createSampleScenario(now);
    const blank = createBlankScenario(now);
    setToday(now);
    setChromeMin(isCleanCapture(search));

    const last = loadLastSession();
    const source = chooseInitSource(search, !!last);
    if (source === "reset") {
      // Test-only full wipe: clear every persisted key, then the empty canvas.
      // The `?reset=1` param strips itself below (blank == baseline → clean path).
      clearAllSavedData();
      setScenario(blank);
      setBaselineScenario(blank);
    } else if (source === "url") {
      // A shared link is self-contained: its scenario vs. the default sample.
      setScenario(scenarioFromSearch(search) ?? sample);
      setBaselineScenario(sample);
    } else if (source === "preset") {
      // Deep-link a specific example preset: sample baseline + that preset applied,
      // in example mode with its chip active.
      const id = presetIdFromSearch(search);
      const preset = id ? getPreset(id) : undefined;
      setScenario(preset ? preset.apply(sample) : sample);
      setBaselineScenario(sample);
      setExampleMode(true);
      setActivePresetId(id);
    } else if (source === "example") {
      // Deep-link straight into example mode: sample + example chips.
      setScenario(sample);
      setBaselineScenario(sample);
      setExampleMode(true);
    } else if (source === "restore" && last) {
      // Returning user: restore scenario + its baseline (so "Save as baseline"
      // and the blank "Start fresh" state persist). Never any example chips.
      setScenario(last);
      setBaselineScenario(loadLastBaseline() ?? blank);
    } else {
      // First-time visitor: the empty canvas.
      setScenario(blank);
      setBaselineScenario(blank);
    }
    setSaved(source === "reset" ? [] : listSaved());
    setSavedBaselineState(source === "reset" ? null : getSavedBaseline());
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist on EVERY change: localStorage (returning-user last session) + a
  // `?s=` URL param (so a refresh or shared link reproduces the exact scenario).
  // The URL param is written only when the scenario differs from the sample, so
  // the first-visit / embed URL and a post-reset URL stay clean.
  useEffect(() => {
    if (!mounted) return;
    // While previewing an example, suppress writes to the user's saved session +
    // baseline — the example data is in-memory only. The URL still reflects the
    // current scenario (shareable), but never the user's persisted storage.
    persistWorkingState(scenario, baselineScenario, exampleMode);
    const path = window.location.origin + window.location.pathname;
    const edited = encodeScenario(scenario) !== encodedBaseline;
    window.history.replaceState(null, "", edited ? shareableUrl(scenario, path) : path);
  }, [scenario, baselineScenario, exampleMode, mounted, encodedBaseline]);

  const result = useMemo(() => simulate(scenario), [scenario]);
  const baseline = useMemo(() => simulate(baselineScenario), [baselineScenario]);

  const isEdited = encodeScenario(scenario) !== encodedBaseline;

  const update = (next: Scenario) => {
    // A manual edit is a soft exit from example mode — keep the numbers as the
    // user's own working scenario, but drop the example chips.
    setScenario(next);
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "manualEdit"));
    setCopied(false);
  };

  const applyPreset = (preset: Preset) => {
    // Selecting an example chip switches scenarios but STAYS in example mode.
    setScenario(preset.apply(baselineScenario));
    setActivePresetId(preset.id);
    setExampleMode((m) => nextExampleMode(m, "applyPreset"));
    setCopied(false);
  };

  const copyLink = async () => {
    const url = shareableUrl(scenario, window.location.origin + window.location.pathname);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked — still update the address bar below */
    }
    window.history.replaceState(null, "", url);
    setCopied(true);
  };

  const onSave = (name: string, notes: string) =>
    setSaved(saveScenario(name, scenario, todayISO(), notes));
  const onLoad = (entry: SavedScenario) => {
    // Loading a saved scenario is the user's own data — exit example mode.
    setScenario(entry.scenario);
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "loadSaved"));
    setCopied(false);
  };
  const onDelete = (key: string) => setSaved(deleteSaved(key));
  const onSeeExample = () => {
    // Enter example mode: load the pristine, today-anchored sample as both the
    // scenario and its baseline, and reveal the example preset chips.
    const sample = createSampleScenario(today);
    setBaselineScenario(sample);
    setScenario(sample);
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "seeExample"));
    setCopied(false);
  };
  const onStartFresh = () => {
    // Full reset to a blank slate (all inputs $0). The blank scenario is ALSO
    // made the baseline so `edited` is false — the persist effect then clears
    // the `?s=` param (and overwrites the last-session with the blank state),
    // and the "vs baseline" delta reads neutral instead of comparing the blank
    // against the old sample. Hard exit from example mode.
    const blank = createBlankScenario(today);
    setBaselineScenario(blank);
    setScenario(blank);
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "startFresh"));
    setCopied(false);
  };
  const onSaveAsBaseline = (notes: string) => {
    // Lock the current inputs as the reference for the dashed line + Δ (the
    // working `runway:baseline` anchor), AND store a dated saved-baseline record
    // (`runway:savedBaseline`) with an optional note, backing the Baseline pill.
    // Replaces the single existing baseline. Exit example mode.
    const savedAt = todayISO();
    const trimmed = notes.trim() || undefined;
    setBaselineScenario(scenario);
    setSavedBaseline(scenario, savedAt, trimmed);
    setSavedBaselineState({ scenario, savedAt, notes: trimmed });
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "saveAsBaseline"));
    setCopied(false);
  };
  const onLoadBaseline = () => {
    if (!savedBaseline) return;
    // Loading the saved baseline restores it as BOTH the working scenario and
    // the Δ comparison anchor, so the dashed line reads neutral. Exit example mode.
    setScenario(savedBaseline.scenario);
    setBaselineScenario(savedBaseline.scenario);
    setActivePresetId(null);
    setExampleMode((m) => nextExampleMode(m, "loadSaved"));
    setCopied(false);
  };
  const onDeleteBaseline = () => {
    // Clear only the dated saved record (the Baseline pill). The working
    // `runway:baseline` anchor lingers, so VS-BASELINE keeps rendering sanely —
    // the dashed line still compares against the current anchor (Δ = 0 / hidden
    // when the scenario equals it), never an empty/broken state.
    clearSavedBaseline();
    setSavedBaselineState(null);
  };

  const activeScenarioName = activePresetId
    ? (PRESETS.find((p) => p.id === activePresetId)?.name ?? "Custom scenario")
    : exampleMode
      ? "Example scenario"
      : "Custom scenario";

  // Auto-scale the chart x-axis to the meaningful window.
  const windowMonths = useMemo(
    () => visibleMonthCount(result, baseline, isEdited),
    [result, baseline, isEdited],
  );
  const currentProjection = result.projection.slice(0, windowMonths);
  const baselineProjection = baseline.projection.slice(0, windowMonths);
  const windowTimelines = result.accountTimelines.map((t) => ({
    ...t,
    balances: t.balances.slice(0, windowMonths),
  }));

  return (
    <div
      className={`mx-auto max-w-[1560px] px-4 py-8 sm:px-6${chromeMin ? " chrome-min" : ""}`}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Upward</h1>
        <p className="mt-1 text-sm font-medium text-zinc-700">
          See where you stand. Build your runway. Steer it upward.
        </p>
        <p data-chrome className="mt-1 text-sm text-zinc-500">
          How long does your cash last — and how does that change if you pull any single lever?
          Enter your accounts and levers, then save or share a link — or see an example to explore.
        </p>
      </header>

      <Toolbar
        presets={PRESETS}
        exampleMode={exampleMode}
        activePresetId={activePresetId}
        onApplyPreset={applyPreset}
        onCopyLink={copyLink}
        copied={copied}
        onSave={onSave}
        onSaveAsBaseline={onSaveAsBaseline}
        saved={saved}
        savedBaseline={savedBaseline}
        onLoad={onLoad}
        onDelete={onDelete}
        onLoadBaseline={onLoadBaseline}
        onDeleteBaseline={onDeleteBaseline}
        onSeeExample={onSeeExample}
        onStartFresh={onStartFresh}
      />

      <div className="mt-4">
        <TimeAnchor scenario={scenario} onChange={update} today={today} />
      </div>

      <div className="mt-6">
        <HeroMetrics result={result} baseline={baseline} />
      </div>

      {/* Main loop — Levers (left, clamped) paired with the Runway chart
          (right), which grows to fill the remaining width AND stretches to the
          height of the Levers column. Below lg / in the narrow embed it
          collapses to a single column, chart first. */}
      {/* Both cards share ONE fixed height (no stretch/match logic) so the row
          stays balanced and each panel scrolls internally instead of growing. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        {/* Levers — left */}
        <Card className="order-2 flex h-[580px] flex-col p-5 lg:order-none">
          <Levers
            scenario={scenario}
            onChange={update}
            baseline={hasMeaningfulAmounts(baselineScenario) ? baselineScenario.levers : null}
          />
        </Card>

        {/* Merged runway chart — right; fills its cell. Net-liquid line +
            baseline (Total), or stacked account bands + the authoritative
            net-liquid line (By account). */}
        <Card className="order-1 flex h-[580px] flex-col p-5 lg:order-none">
          <div className="mb-1 flex items-center justify-between gap-3">
            <SectionTitle hint={activeScenarioName}>Runway</SectionTitle>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-zinc-200 text-xs">
              {(["total", "byAccount"] as const).map((m) => (
                <button
                  key={m}
                  data-testid={m === "total" ? "chart-mode-total" : "chart-mode-by-account"}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 ${mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {m === "total" ? "Total" : "By account"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2 cursor-help text-xs text-zinc-400" title={BASELINE_HELP}>
            {BASELINE_LABEL}
          </p>
          <div data-testid="runway-chart" className="flex min-h-0 flex-1 flex-col">
            <RunwayChart
              current={currentProjection}
              baseline={baselineProjection}
              showBaseline={isEdited}
              timelines={windowTimelines}
              cashZeroDate={result.runway.cashZeroDate}
              startDate={scenario.timeline.start}
              mode={mode}
              baselineLabel={BASELINE_LABEL}
              baselineHelp={BASELINE_HELP}
            />
          </div>
        </Card>
      </div>

      {/* Accounts — full-width responsive grid (2–3 per row wide, 1 narrow). */}
      <Card className="mt-6 p-5">
        <AccountList scenario={scenario} onChange={update} />
      </Card>

      {/* Ledger — full width at the bottom. */}
      <Card className="mt-6 p-5">
        <LedgerView result={result} />
      </Card>

      <footer data-chrome className="mt-10 text-center text-xs text-zinc-400">
        Sample data is fictional. Not financial advice.
      </footer>
    </div>
  );
}
