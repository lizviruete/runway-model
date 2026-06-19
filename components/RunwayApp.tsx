"use client";

import { useMemo, useState } from "react";
import { visibleMonthCount } from "@/lib/chartWindow";
import { simulate } from "@/lib/engine/simulate";
import type { Scenario } from "@/lib/engine/types";
import { createSampleScenario } from "@/lib/sample";
import { AccountList } from "./AccountList";
import { CashProjectionChart } from "./CashProjectionChart";
import { DepletionChart } from "./DepletionChart";
import { HeroMetrics } from "./HeroMetrics";
import { LedgerView } from "./LedgerView";
import { Levers } from "./Levers";
import { Card, SectionTitle } from "./ui";

export function RunwayApp() {
  // The pristine sample is the baseline reference for the overlay + delta.
  const [baselineScenario] = useState<Scenario>(() => createSampleScenario());
  const [scenario, setScenario] = useState<Scenario>(() => createSampleScenario());

  const result = useMemo(() => simulate(scenario), [scenario]);
  const baseline = useMemo(() => simulate(baselineScenario), [baselineScenario]);

  // Only overlay the baseline once the user has changed something.
  const isEdited = scenario !== baselineScenario && JSON.stringify(scenario) !== JSON.stringify(baselineScenario);

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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Runway Model</h1>
        <p className="mt-1 text-sm text-zinc-500">
          How long does your cash last — and how does that change if you pull any single lever?
          Editing the pre-loaded sample; nothing is saved yet.
        </p>
      </header>

      <HeroMetrics result={result} baseline={baseline} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Outputs */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="p-5">
            <SectionTitle hint={isEdited ? "Current — dashed = baseline" : "Net liquid cash"}>
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
            <AccountList scenario={scenario} onChange={setScenario} />
          </Card>
          <Card className="p-5">
            <Levers scenario={scenario} onChange={setScenario} />
          </Card>
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-zinc-400">
        Sample data is fictional. Not financial advice.
      </footer>
    </div>
  );
}
