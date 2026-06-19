"use client";

import type { SimulationResult } from "@/lib/engine/types";
import { formatDate, formatRunway } from "@/lib/format";
import { Card } from "./ui";

function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueColor =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-zinc-900";
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
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
        label="Runway"
        value={runway.survivesHorizon ? "Beyond horizon" : formatRunway(runway.months)}
        sub={runway.survivesHorizon ? "Funds outlast the timeline" : weeks}
        tone={runway.survivesHorizon ? "good" : "default"}
      />
      <Metric
        label="Cash-zero date"
        value={runway.cashZeroDate ? formatDate(runway.cashZeroDate) : "—"}
        sub={runway.cashZeroDate ? "When funds run out" : "Within the modeled horizon"}
        tone={runway.cashZeroDate ? "bad" : "good"}
      />
      <Metric
        label="vs. baseline"
        value={deltaValue}
        sub={hasDelta ? "Change in runway" : "Same as the baseline scenario"}
        tone={deltaTone}
      />
    </div>
  );
}
