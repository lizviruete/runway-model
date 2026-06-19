"use client";

import { daysBetween } from "@/lib/engine/dates";
import type { ProjectionPoint } from "@/lib/engine/types";
import { formatCurrency, formatMonthShort } from "@/lib/format";

interface Props {
  current: ProjectionPoint[];
  baseline?: ProjectionPoint[] | null;
  /** Show the baseline overlay (only when it differs from current). */
  showBaseline?: boolean;
  cashZeroDate: string | null;
  startDate: string;
}

const W = 800;
const H = 320;
const PAD = { left: 60, right: 18, top: 16, bottom: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Display floor: net liquid is clamped at zero for the chart (the true,
 *  possibly-negative figure is preserved in the ledger data). */
function clamp(v: number): number {
  return Math.max(0, v);
}

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) {
    if (v <= s * mag) return s * mag;
  }
  return 10 * mag;
}

export function CashProjectionChart({
  current,
  baseline,
  showBaseline,
  cashZeroDate,
  startDate,
}: Props) {
  const n = current.length;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_W);

  const allValues = [
    ...current.map((p) => clamp(p.netLiquid)),
    ...(showBaseline && baseline ? baseline.map((p) => clamp(p.netLiquid)) : []),
  ];
  const maxY = niceMax(Math.max(1, ...allValues));
  const y = (v: number) => PAD.top + PLOT_H - (clamp(v) / maxY) * PLOT_H;

  const line = (pts: ProjectionPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.netLiquid).toFixed(1)}`).join(" ");

  const area = (pts: ProjectionPoint[]) =>
    `${line(pts)} L ${x(pts.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  // y gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  // x labels — about 6 evenly spaced months
  const labelStep = Math.max(1, Math.round(n / 6));
  const xLabels = current
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  // cash-zero marker — interpolate x by days from start across the full span
  let zeroX: number | null = null;
  if (cashZeroDate && n > 1) {
    const totalDays = daysBetween(startDate, current[n - 1].date);
    const atDays = daysBetween(startDate, cashZeroDate);
    if (totalDays > 0) {
      const frac = Math.max(0, Math.min(1, atDays / totalDays));
      zeroX = PAD.left + frac * PLOT_W;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Cash projection over time">
      {/* y gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#f1f1f4" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-400 text-[11px]">
            {formatCurrency(v)}
          </text>
        </g>
      ))}

      {/* baseline overlay */}
      {showBaseline && baseline ? (
        <path d={line(baseline)} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" />
      ) : null}

      {/* current area + line */}
      <path d={area(current)} fill="#10b98122" stroke="none" />
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
  );
}
