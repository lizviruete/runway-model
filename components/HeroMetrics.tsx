"use client";

import type { SimulationResult } from "@/lib/engine/types";
import { formatDate, formatRunway } from "@/lib/format";
import { Card } from "./ui";

function Metric({
  label,
  value,
  sub,
  tone = "default",
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
  testId?: string;
}) {
  const valueColor =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-zinc-900";
  return (
    <Card className="p-5">
      <div data-testid={testId} className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        data-testid={testId ? `${testId}-value` : undefined}
        className={`mt-1 text-3xl font-semibold tabular-nums ${valueColor}`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-sm text-zinc-500">{sub}</div> : null}
    </Card>
  );
}

export function HeroMetrics({
  result,
  baseline,
}: {
  result: SimulationResult;
  baseline: SimulationResult;
}) {
  const { runway } = result;
  const weeks = `${Math.round(runway.weeks)} weeks`;

  const deltaMonths = runway.months - baseline.runway.months;
  const hasDelta = Math.abs(deltaMonths) >= 0.05;
  const deltaTone = deltaMonths > 0 ? "good" : deltaMonths < 0 ? "bad" : "default";
  const deltaValue = hasDelta
    ? `${deltaMonths > 0 ? "+" : "−"}${Math.abs(deltaMonths).toFixed(1)} mo`
    : "—";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Metric
        testId="metric-runway"
        label="Runway"
        value={runway.survivesHorizon ? "Beyond horizon" : formatRunway(runway.months)}
        sub={runway.survivesHorizon ? "Funds outlast the timeline" : weeks}
        tone={runway.survivesHorizon ? "good" : "default"}
      />
      <Metric
        testId="metric-cash-zero"
        label="Cash-zero date"
        value={runway.cashZeroDate ? formatDate(runway.cashZeroDate) : "—"}
        sub={runway.cashZeroDate ? "When funds run out" : "Within the modeled horizon"}
        // The date renders NEUTRAL, not red — appendix observation 2. It was the
        // largest red element in the product and, for someone in an income gap,
        // the most anxiety-loaded number on the page. Colouring it alarms
        // someone about a fact they cannot change by looking at it.
        //
        // `tone="default"` rather than a new near-black token: it is already
        // `text-zinc-900` (#18181b) in this component, and importing the spec's
        // #111827 would add a second grey family for one figure. Same call as
        // item 9's zinc-500.
        //
        // The chart's red dashed cash-zero marker STAYS RED. That is where the
        // alarm belongs — a marker on a timeline, not a headline. And per ruling
        // (j), vs-baseline keeps BOTH its colours: that red marks a state change
        // you just caused and can undo, which is the one thing emphasis is for.
        tone={runway.cashZeroDate ? "default" : "good"}
      />
      <Metric
        testId="metric-vs-baseline"
        label="vs. baseline"
        value={deltaValue}
        sub={hasDelta ? "Change in runway" : "Same as the baseline scenario"}
        tone={deltaTone}
      />
    </div>
  );
}
