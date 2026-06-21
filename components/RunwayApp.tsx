"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CHART_MODE, type ChartMode } from "@/lib/chart";
import { visibleMonthCount } from "@/lib/chartWindow";
import { simulate } from "@/lib/engine/simulate";
import type { Scenario } from "@/lib/engine/types";
import { PRESETS, type Preset } from "@/lib/presets";
import { createSampleScenario, SAMPLE_AS_OF } from "@/lib/sample";
import { encodeScenario, scenarioFromSearch, shareableUrl } from "@/lib/share";
import {
  deleteSaved,
  listSaved,
  loadLastSession,
  saveLastSession,
  saveScenario,
  type SavedScenario,
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

export function RunwayApp() {
  // SSR + first render use the canonical anchor so the markup is deterministic;
  // the mount effect re-anchors everything to the real "today".
  const [today, setToday] = useState<string>(SAMPLE_AS_OF);
  const [baselineScenario, setBaselineScenario] = useState<Scenario>(() => createSampleScenario());
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario());
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [copied, setCopied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>("baseline");
  const [mode, setMode] = useState<ChartMode>(DEFAULT_CHART_MODE);
  const [mounted, setMounted] = useState(false);

  const encodedBaseline = useMemo(() => encodeScenario(baselineScenario), [baselineScenario]);

  // On mount, anchor the sample to the real "today", then hydrate in priority
  // order: a shared `?s=` link > the returning user's last localStorage session
  // > the (today-anchored) sample. We render the deterministic SSR sample first
  // and sync from these client-only sources after mount (reading them during
  // render would cause a hydration mismatch), so the post-mount setState is
  // intentional here. `mounted` is a STATE flag (not a ref) so the persist
  // effect below reliably sees `false` on the first commit and can't clobber
  // storage with the pre-hydration sample.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const now = todayISO();
    const sample = createSampleScenario(now);
    setToday(now);
    setBaselineScenario(sample);

    const fromUrl = scenarioFromSearch(window.location.search);
    if (fromUrl) {
      setScenario(fromUrl);
      setActivePresetId(null);
    } else {
      const last = loadLastSession();
      if (last) {
        setScenario(last);
        setActivePresetId(null);
      } else {
        setScenario(sample);
      }
    }
    setSaved(listSaved());
    setMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist on EVERY change: localStorage (returning-user last session) + a
  // `?s=` URL param (so a refresh or shared link reproduces the exact scenario).
  // The URL param is written only when the scenario differs from the sample, so
  // the first-visit / embed URL and a post-reset URL stay clean.
  useEffect(() => {
    if (!mounted) return;
    saveLastSession(scenario);
    const path = window.location.origin + window.location.pathname;
    const edited = encodeScenario(scenario) !== encodedBaseline;
    window.history.replaceState(null, "", edited ? shareableUrl(scenario, path) : path);
  }, [scenario, mounted, encodedBaseline]);

  const result = useMemo(() => simulate(scenario), [scenario]);
  const baseline = useMemo(() => simulate(baselineScenario), [baselineScenario]);

  const isEdited = encodeScenario(scenario) !== encodedBaseline;

  const update = (next: Scenario) => {
    setScenario(next);
    setActivePresetId(null);
    setCopied(false);
  };

  const applyPreset = (preset: Preset) => {
    setScenario(preset.apply(baselineScenario));
    setActivePresetId(preset.id);
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

  const onSave = (name: string) => setSaved(saveScenario(name, scenario, todayISO()));
  const onLoad = (entry: SavedScenario) => {
    setScenario(entry.scenario);
    setActivePresetId(null);
  };
  const onDelete = (key: string) => setSaved(deleteSaved(key));
  const onReset = () => {
    // Restore the pristine, today-anchored sample. The persist effect then
    // clears the `?s=` param since this equals the baseline.
    setScenario(baselineScenario);
    setActivePresetId("baseline");
    setCopied(false);
  };

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Upward</h1>
        <p className="mt-1 text-sm font-medium text-zinc-700">
          See where you stand. Build your runway. Steer it upward.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          How long does your cash last — and how does that change if you pull any single lever?
          Pick a preset, adjust the levers, then save or share a link.
        </p>
      </header>

      <Toolbar
        presets={PRESETS}
        activePresetId={activePresetId}
        onApplyPreset={applyPreset}
        onCopyLink={copyLink}
        copied={copied}
        onSave={onSave}
        saved={saved}
        onLoad={onLoad}
        onDelete={onDelete}
        onReset={onReset}
      />

      <div className="mt-4">
        <TimeAnchor scenario={scenario} onChange={update} today={today} />
      </div>

      <div className="mt-6">
        <HeroMetrics result={result} baseline={baseline} />
      </div>

      {/* Merged runway chart — net-liquid line + baseline (Total), or stacked
          account bands with the authoritative net-liquid line (By account). */}
      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle hint={isEdited ? "Solid = current · dashed = baseline" : "Net liquid over time"}>
            Runway
          </SectionTitle>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-zinc-200 text-xs">
            {(["total", "byAccount"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 ${mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
              >
                {m === "total" ? "Total" : "By account"}
              </button>
            ))}
          </div>
        </div>
        <RunwayChart
          current={currentProjection}
          baseline={baselineProjection}
          showBaseline={isEdited}
          timelines={windowTimelines}
          cashZeroDate={result.runway.cashZeroDate}
          startDate={scenario.timeline.start}
          mode={mode}
        />
      </Card>

      {/* Controls — side-by-side on wide screens, stacked on narrow/embed. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <AccountList scenario={scenario} onChange={update} />
        </Card>
        <Card className="p-5">
          <Levers scenario={scenario} onChange={update} />
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <LedgerView result={result} />
      </Card>

      <footer className="mt-10 text-center text-xs text-zinc-400">
        Sample data is fictional. Not financial advice.
      </footer>
    </div>
  );
}
