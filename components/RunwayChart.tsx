"use client";

import { assetTimelines, chartMax, type ChartMode } from "@/lib/chart";
import { daysBetween } from "@/lib/engine/dates";
import type { AccountTimeline, ProjectionPoint } from "@/lib/engine/types";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import { TYPE_COLORS } from "./ui";

interface Props {
  current: ProjectionPoint[];
  baseline?: ProjectionPoint[] | null;
  /** Show the baseline overlay (only when the scenario differs from baseline). */
  showBaseline?: boolean;
  /** Account timelines (windowed), in waterfall priority order. */
  timelines: AccountTimeline[];
  cashZeroDate: string | null;
  startDate: string;
  mode: ChartMode;
}

const W = 820;
const H = 340;
const PAD = { left: 60, right: 18, top: 16, bottom: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Display floor: the net-liquid line is clamped at zero (the true,
 *  possibly-negative figure is preserved in the ledger data). */
function clamp(v: number): number {
  return Math.max(0, v);
}

export function RunwayChart({
  current,
  baseline,
  showBaseline,
  timelines,
  cashZeroDate,
  startDate,
  mode,
}: Props) {
  const n = current.length;
  const assets = assetTimelines(timelines);
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_W);

  const maxY = chartMax(current, baseline, assets, !!showBaseline);
  const y = (v: number) => PAD.top + PLOT_H - (clamp(v) / maxY) * PLOT_H;

  const line = (pts: ProjectionPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.netLiquid).toFixed(1)}`).join(" ");
  const area = (pts: ProjectionPoint[]) =>
    `${line(pts)} L ${x(pts.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  // Stacked asset bands — last-tapped at the bottom, first-tapped on top, so
  // the account being drawn down is the visible top band.
  const stackOrder = [...assets].reverse();
  const bands = stackOrder.map((t, idx) => {
    const below = stackOrder.slice(0, idx);
    const baseAt = (i: number) => below.reduce((s, b) => s + Math.max(0, b.balances[i] ?? 0), 0);
    const top = current.map((_, i) => `${x(i).toFixed(1)} ${y(baseAt(i) + Math.max(0, t.balances[i] ?? 0)).toFixed(1)}`);
    const bottom = current.map((_, i) => `${x(i).toFixed(1)} ${y(baseAt(i)).toFixed(1)}`).reverse();
    return { t, d: `M ${top.join(" L ")} L ${bottom.join(" L ")} Z` };
  });

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
  const labelStep = Math.max(1, Math.round(n / 6));
  const xLabels = current
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  // cash-zero marker — interpolate x by days from the anchor across the span.
  let zeroX: number | null = null;
  if (cashZeroDate && n > 1) {
    const totalDays = daysBetween(startDate, current[n - 1].date);
    const atDays = daysBetween(startDate, cashZeroDate);
    if (totalDays > 0) {
      const frac = Math.max(0, Math.min(1, atDays / totalDays));
      zeroX = PAD.left + frac * PLOT_W;
    }
  }

  const byAccount = mode === "byAccount";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Runway projection over time">
        {/* y gridlines + labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#f1f1f4" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-400 text-[11px]">
              {formatCurrency(v)}
            </text>
          </g>
        ))}

        {/* stacked asset bands (by-account view only) */}
        {byAccount
          ? bands.map(({ t, d }) => (
              <path key={t.accountId} d={d} fill={TYPE_COLORS[t.type]} fillOpacity={0.85} stroke="white" strokeWidth={0.5} />
            ))
          : <path d={area(current)} fill="#10b98122" stroke="none" />}

        {/* baseline overlay (dashed) */}
        {showBaseline && baseline ? (
          <path d={line(baseline)} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" />
        ) : null}

        {/* authoritative net-liquid line — sits on/below the stack top and
            diverges downward when a credit line is drawn */}
        <path d={line(current)} fill="none" stroke="#059669" strokeWidth={2.5} strokeLinejoin="round" />

        {/* cash-zero marker */}
        {zeroX !== null ? (
          <g>
            <line x1={zeroX} y1={PAD.top} x2={zeroX} y2={PAD.top + PLOT_H} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" />
            <circle cx={zeroX} cy={PAD.top + PLOT_H} r={3.5} fill="#dc2626" />
          </g>
        ) : null}

        {/* x labels */}
        {xLabels.map(({ p, i }) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="fill-zinc-400 text-[11px]">
            {formatMonthShort(p.date)}
          </text>
        ))}
      </svg>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {byAccount ? (
          <>
            {assets.map((t) => (
              <span key={t.accountId} className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS[t.type] }} />
                {t.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="inline-block h-0.5 w-4" style={{ background: "#059669" }} />
              Net liquid
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="inline-block h-0.5 w-4" style={{ background: "#059669" }} />
              Net liquid
            </span>
            {showBaseline ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-zinc-400" />
                Baseline
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
