"use client";

import type { Scenario } from "@/lib/engine/types";
import { formatDate } from "@/lib/format";
import { horizonEndFor, isPastAnchor } from "@/lib/timeAnchor";

interface Props {
  scenario: Scenario;
  onChange: (next: Scenario) => void;
  /** The real "today", for the past-snapshot check. */
  today: string;
}

/** The "As of" anchor: balances are current as of this date; the projection
 *  and ledger run forward from it. Editing it re-bases the 5-year horizon. */
export function TimeAnchor({ scenario, onChange, today }: Props) {
  const asOf = scenario.timeline.start;
  const setAsOf = (date: string) => {
    if (!date) return;
    onChange({ ...scenario, timeline: { start: date, end: horizonEndFor(date) } });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">As of</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        </label>
        {isPastAnchor(asOf, today) ? (
          <span className="text-xs text-zinc-400">Snapshot from {formatDate(asOf)}.</span>
        ) : null}
      </div>
      <p className="max-w-md text-xs text-zinc-500 sm:text-right">
        Your starting point — the day your income changes. Anchor to a layoff, the start of
        parental or family leave, a sabbatical, or going full-time on your own. Defaults to today.
      </p>
    </div>
  );
}
