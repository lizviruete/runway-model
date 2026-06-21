"use client";

import { useEffect, useMemo, useState } from "react";
import { visibleMonthCount } from "@/lib/chartWindow";
import { simulate } from "@/lib/engine/simulate";
import type { Scenario } from "@/lib/engine/types";
import { PRESETS, type Preset } from "@/lib/presets";
import { createSampleScenario } from "@/lib/sample";
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
import { CashProjectionChart } from "./CashProjectionChart";
import { DepletionChart } from "./DepletionChart";
import { HeroMetrics } from "./HeroMetrics";
import { LedgerView } from "./LedgerView";
import { Levers } from "./Levers";
import { Toolbar } from "./Toolbar";
import { Card, SectionTitle } from "./ui";

function todayLabel(): string {
  // App-side only; fine to read the clock here (not the pure engine).
  return new Date().toISOString().slice(0, 10);
}

export function RunwayApp() {
  // Baseline reference (for the overlay + Δ) is always the pristine sample.
  const [baselineScenario] = useState<Scenario>(() => createSampleScenario());
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario());
  const [encodedBaseline] = useState(() => encodeScenario(createSampleScenario()));
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [copied, setCopied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>("baseline");
  const [mounted, setMounted] = useState(false);

  // On mount, hydrate in priority order: a shared `?s=` link > the returning
  // user's last localStorage session > the default sample. We render the sample
  // for SSR and sync from these client-only sources after mount (reading them
  // during render would cause a hydration mismatch), so the post-mount setState
  // is intentional here. `mounted` is a STATE flag (not a ref) so the persist
  // effect below reliably sees `false` on the first commit and can't clobber
  // storage with the pre-hydration sample.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const fromUrl = scenarioFromSearch(window.location.search);
    if (fromUrl) {
      setScenario(fromUrl);
      setActivePresetId(null);
    } else {
      const last = loadLastSession();
      if (last) {
        setScenario(last);
        setActivePresetId(null);
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

  const onSave = (name: string) => setSaved(saveScenario(name, scenario, todayLabel()));
  const onLoad = (entry: SavedScenario) => {
    setScenario(entry.scenario);
    setActivePresetId(null);
  };
  const onDelete = (key: string) => setSaved(deleteSaved(key));
  const onReset = () => {
    // Persist effect clears the `?s=` param since this equals the sample.
    setScenario(createSampleScenario());
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

      <HeroMetrics result={result} baseline={baseline} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Outputs */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5">
            <SectionTitle hint={isEdited ? "Solid = current · dashed = baseline" : "Net liquid cash"}>
              Cash projection
            </SectionTitle>
            <CashProjectionChart
              current={currentProjection}
              baseline={baselineProjection}
              showBaseline={isEdited}
              cashZeroDate={result.runway.cashZeroDate}
              startDate={scenario.timeline.start}
            />
          </Card>

          <Card className="p-5">
            <SectionTitle hint="Which account drains, in what order">Account depletion</SectionTitle>
            <DepletionChart timelines={windowTimelines} projection={currentProjection} />
          </Card>

          <Card className="p-5">
            <LedgerView result={result} />
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <AccountList scenario={scenario} onChange={update} />
          </Card>
          <Card className="p-5">
            <Levers scenario={scenario} onChange={update} />
          </Card>
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-zinc-400">
        Sample data is fictional. Not financial advice.
      </footer>
    </div>
  );
}
