"use client";

import type { AccountTimeline, ProjectionPoint } from "@/lib/engine/types";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import { TYPE_COLORS } from "./ui";

interface Props {
  /** In waterfall priority order; first entry is tapped first. */
  timelines: AccountTimeline[];
  projection: ProjectionPoint[];
}

const W = 800;
const H = 280;
const PAD = { left: 60, right: 18, top: 12, bottom: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (v <= s * mag) return s * mag;
  return 10 * mag;
}

/** Stacked area of each account's remaining balance over time (assets only).
 *  The first-tapped account sits on top, so it visibly drains first. */
export function DepletionChart({ timelines, projection }: Props) {
  const assets = timelines.filter((t) => t.type !== "credit_line");
  const n = projection.length;
  if (assets.length === 0 || n === 0) return null;

  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_W);

  // total per month for the y-scale
  const totals = projection.map((_, i) =>
    assets.reduce((s, t) => s + Math.max(0, t.balances[i] ?? 0), 0),
  );
  const maxY = niceMax(Math.max(1, ...totals));
  const y = (v: number) => PAD.top + PLOT_H - (Math.max(0, v) / maxY) * PLOT_H;

  // cumulative offsets, stacking last-tapped at the bottom
  const stackOrder = [...assets].reverse(); // bottom → top = last → first tapped

  // For each account compute top edge (cumulative incl. this) and bottom edge.
  const bands = stackOrder.map((t, idx) => {
    const below = stackOrder.slice(0, idx);
    const topEdge = (i: number) =>
      below.reduce((s, b) => s + Math.max(0, b.balances[i] ?? 0), 0) +
      Math.max(0, t.balances[i] ?? 0);
    const bottomEdge = (i: number) =>
      below.reduce((s, b) => s + Math.max(0, b.balances[i] ?? 0), 0);
    const top = projection.map((_, i) => `${x(i).toFixed(1)} ${y(topEdge(i)).toFixed(1)}`);
    const bottom = projection
      .map((_, i) => `${x(i).toFixed(1)} ${y(bottomEdge(i)).toFixed(1)}`)
      .reverse();
    return {
      t,
      d: `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`,
    };
  });

  const yTicks = [0, 0.5, 1].map((f) => f * maxY);
  const labelStep = Math.max(1, Math.round(n / 6));
  const xLabels = projection
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Account depletion over time">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#f1f1f4" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-400 text-[11px]">
              {formatCurrency(v)}
            </text>
          </g>
        ))}
        {bands.map(({ t, d }) => (
          <path key={t.accountId} d={d} fill={TYPE_COLORS[t.type]} fillOpacity={0.85} stroke="white" strokeWidth={0.5} />
        ))}
        {xLabels.map(({ p, i }) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="fill-zinc-400 text-[11px]">
            {formatMonthShort(p.date)}
          </text>
        ))}
      </svg>
      {/* legend, in tap order */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {assets.map((t) => (
          <span key={t.accountId} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS[t.type] }} />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}
