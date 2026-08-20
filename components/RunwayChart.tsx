"use client";

import { useEffect, useRef, useState } from "react";
import { chartMax, legendTimelines, type ChartMode } from "@/lib/chart";
import {
  bandCenter,
  cashZeroGapX,
  COLUMN,
  columnWidth,
  drawingSeries,
  firstDepletedIndex,
  stackAt,
  stackTotalAt,
} from "@/lib/chartGeometry";
import { CAPTIONS, cashZeroLabel, legendLabel, tooltipModel } from "@/lib/chartTooltip";
import { chartTokenStyle, NET_HEX, seriesFill, seriesStroke } from "@/lib/engine/chartSeries";
import { daysBetween } from "@/lib/engine/dates";
import type { AccountTimeline, MonthLedger, ProjectionPoint, Scenario } from "@/lib/engine/types";
import { formatCurrency, formatMonthShort } from "@/lib/format";

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
  /** Legend label + tooltip for the dashed baseline overlay. */
  baselineLabel?: string;
  baselineHelp?: string;
  /** Windowed month ledgers — the tooltip reads opening/closing/net from here. */
  months: MonthLedger[];
  /** For the event line: step changes, end dates, penalty-free months. */
  scenario: Scenario;
  /** Series slot per account id — resolved once in the engine (ruling n). */
  slotOf: (accountId: string) => number | null;
  /** Tap position per account id; null for an excluded account. */
  tapOf: (accountId: string) => number | null;
}

const PAD = { left: 58, right: 16, top: 16, bottom: 28 };

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
  baselineLabel = "Baseline",
  baselineHelp,
  months,
  scenario,
  slotOf,
  tapOf,
}: Props) {
  // Hover is on the whole month BAND, not the column: a 12px-tall stack must
  // still be hoverable. Keyboard shares the same state so the chart is one tab
  // stop with arrow-key navigation.
  const [hovered, setHovered] = useState<number | null>(null);
  // Measure the plot area so the SVG fills its container exactly (1 unit = 1px,
  // no distortion): it grows wider on big monitors AND taller to match the
  // column it's paired with.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 760, h: 360 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = size.w;
  const H = size.h;
  const PLOT_W = W - PAD.left - PAD.right;
  const PLOT_H = H - PAD.top - PAD.bottom;

  const n = current.length;
  // `drawing` DRAWS (excluded + liabilities filtered out, BEFORE chartMax scales
  // the axis); `legendSeries` NAMES (excluded kept, in tap-order position).
  const drawing = drawingSeries(timelines, slotOf);
  const legendSeries = legendTimelines(timelines);
  const x = (i: number) => PAD.left + bandCenter(PLOT_W, n, i);

  const maxY = chartMax(current, baseline, drawing, !!showBaseline);
  const y = (v: number) => PAD.top + PLOT_H - (clamp(v) / maxY) * PLOT_H;

  const line = (pts: ProjectionPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.netLiquid).toFixed(1)}`).join(" ");

  const colW = columnWidth(PLOT_W, n);
  // The first fully-drained month: zero-height columns are not drawn, the
  // baseline continues as a rule, and one caption sits above the first of them.
  const depletedFrom = firstDepletedIndex(drawing, n);
  const zeroGapX = cashZeroDate ? cashZeroGapX(drawing, n, PLOT_W) : null;

  // Edge states 6 and 7 — distinct paths, distinct copy. Item 5 proved that
  // "every account excluded" and "no accounts at all" are not the same state.
  // Every string here is built in the pure layer and asserted there (ruling s).
  // The component positions them; it never assembles copy from text and
  // {expressions}, which silently drops interior spaces.
  const tip =
    hovered !== null && months[hovered]
      ? tooltipModel(months[hovered], timelines, hovered, scenario)
      : null;

  const anyAssets = legendSeries.length > 0;
  const emptyCaption = drawing.length
    ? null
    : anyAssets
      ? CAPTIONS.allExcluded
      : CAPTIONS.noAccounts;

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
    <div className="relative flex min-h-0 flex-1 flex-col" style={chartTokenStyle()}>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="application"
        aria-label="Runway chart. Use the left and right arrow keys to read each month."
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setHovered((h) => Math.min(n - 1, (h ?? -1) + 1)); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setHovered((h) => Math.max(0, (h ?? n) - 1)); }
          else if (e.key === "Home") { e.preventDefault(); setHovered(0); }
          else if (e.key === "End") { e.preventDefault(); setHovered(n - 1); }
          else if (e.key === "Escape") { setHovered(null); }
        }}
        onBlur={() => setHovered(null)}
        className="min-h-0 flex-1 overflow-hidden focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label="Runway projection over time"
        >
          {/* Hovered band wash — behind the full plot height, so a short stack
              is still obviously the thing being read. */}
          {hovered !== null && hovered < n ? (
            <rect
              x={PAD.left + (PLOT_W / n) * hovered}
              y={PAD.top}
              width={PLOT_W / n}
              height={PLOT_H}
              fill="#f7f7f8"
            />
          ) : null}

          {/* y gridlines + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#f1f1f4" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-400 text-[11px]">
                {formatCurrency(v)}
              </text>
            </g>
          ))}

          {/* STACKED COLUMNS — a column's height is the money still held at
              month END. A balance, not that month's spending: the y-axis title
              and the view subhead are what stop columns reading as flow. */}
          {byAccount ? (
            current.map((_, i) => {
              if (stackTotalAt(drawing, i) <= 0) return null; // zero columns are not drawn
              const cx = x(i);
              return (
                <g key={i} data-testid="chart-column">
                  {stackAt(drawing, i).map((seg) => {
                    const h = y(seg.from) - y(seg.to);
                    if (h <= 0) return null;
                    // The 2px surface gap separates neighbours regardless of
                    // hue — load-bearing, since eight series cannot pairwise
                    // separate (ruling u). Never eats a segment whole.
                    const gap = Math.min(COLUMN.segmentGap, Math.max(0, h - 1));
                    const stroke = seriesStroke(seg.slot);
                    return (
                      <rect
                        key={seg.accountId}
                        x={cx - colW / 2}
                        y={y(seg.to)}
                        width={colW}
                        height={h - gap}
                        fill={seriesFill(seg.slot)}
                        stroke={stroke ?? undefined}
                        strokeWidth={stroke ? 1 : undefined}
                      />
                    );
                  })}
                </g>
              );
            })
          ) : (
            <path
              d={`${line(current)} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`}
              fill="#10b98122"
              stroke="none"
            />
          )}

          {/* Flat tail: the baseline continues as a rule under the drained
              months, with ONE caption above the first of them — never a row of
              repeated zeros. */}
          {byAccount && depletedFrom !== null && depletedFrom < n ? (
            <g>
              <line
                x1={x(depletedFrom) - colW / 2}
                y1={y(0)}
                x2={W - PAD.right}
                y2={y(0)}
                stroke="#9ca3af"
                strokeWidth={2}
              />
              <text
                data-testid="chart-depleted"
                x={x(depletedFrom)}
                y={y(0) - 6}
                textAnchor="middle"
                className="fill-zinc-400 text-[10.5px]"
              >
                {CAPTIONS.depleted}
              </text>
            </g>
          ) : null}

          {/* baseline overlay (dashed) */}
          {showBaseline && baseline ? (
            <path d={line(baseline)} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" />
          ) : null}

          {/* authoritative net-liquid line — sits on/below the stack top and
              diverges downward when a credit line is drawn */}
          <path d={line(current)} fill="none" stroke={NET_HEX} strokeWidth={2} strokeLinejoin="round" />

          {/* Cash-zero marker — drawn in the GAP before the first $0 column,
              never through one, so it reads as a boundary between months. */}
          {byAccount && zeroGapX !== null && cashZeroDate ? (
            <g data-testid="chart-cash-zero">
              <line
                x1={PAD.left + zeroGapX}
                y1={PAD.top}
                x2={PAD.left + zeroGapX}
                y2={PAD.top + PLOT_H}
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left + zeroGapX}
                y={PAD.top - 4}
                textAnchor="end"
                className="fill-red-600 text-[10.5px]"
              >
                {cashZeroLabel(cashZeroDate)}
              </text>
            </g>
          ) : !byAccount && zeroX !== null ? (
            <g>
              <line x1={zeroX} y1={PAD.top} x2={zeroX} y2={PAD.top + PLOT_H} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" />
              <circle cx={zeroX} cy={PAD.top + PLOT_H} r={3.5} fill="#dc2626" />
            </g>
          ) : null}

          {/* Hit targets: the whole month band, full plot height. The mark is
              never the hit target — a 12px stack would be unhoverable. */}
          {current.map((_, i) => (
            <rect
              key={`hit-${i}`}
              data-testid="chart-hit"
              x={PAD.left + (PLOT_W / n) * i}
              y={PAD.top}
              width={PLOT_W / n}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            />
          ))}

          {/* x labels */}
          {xLabels.map(({ p, i }) => (
            <text
              key={i}
              x={x(i)}
              y={H - 9}
              textAnchor="middle"
              className={
                hovered === i
                  ? "fill-zinc-700 text-[11px] font-semibold"
                  : "fill-zinc-400 text-[11px]"
              }
            >
              {formatMonthShort(p.date)}
            </text>
          ))}
        </svg>
      </div>

      {/* Tooltip. Pinned to the side away from the hovered band so it never
          covers the column being read. */}
      {tip ? (
        <div
          data-testid="chart-tooltip"
          className={`pointer-events-none absolute top-4 z-10 w-56 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs shadow-lg ${
            hovered !== null && hovered > n / 2 ? "left-16" : "right-4"
          }`}
        >
          <div className="font-semibold text-zinc-900">{tip.heading}</div>
          <div className="mt-0.5 text-zinc-500">{tip.subheading}</div>
          <div className="mt-2 space-y-1">
            {tip.rows.map((row) => (
              <div key={row.accountId} className="flex items-baseline justify-between gap-2">
                <span
                  className={
                    row.excluded ? "truncate text-zinc-400 line-through" : "truncate text-zinc-600"
                  }
                >
                  {row.label}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    row.excluded ? "text-zinc-400" : row.zero ? "text-zinc-400" : "text-zinc-700"
                  }`}
                >
                  {row.value ?? "excluded"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-1.5">
            <span className="text-zinc-600">Net liquid</span>
            <span className="shrink-0 tabular-nums font-medium text-zinc-900">{tip.netLiquid}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-zinc-600">Cash flow</span>
            <span className="shrink-0 tabular-nums text-zinc-700">{tip.cashFlow}</span>
          </div>
          {tip.event ? <div className="mt-1.5 text-[11px] text-zinc-500">{tip.event}</div> : null}
        </div>
      ) : null}

      {/* The tooltip mirrored into a live region, so a keyboard reader hears
          the month it just arrowed onto. */}
      <p aria-live="polite" className="sr-only">
        {tip ? `${tip.heading}. ${tip.subheading}. Net liquid ${tip.netLiquid}. Cash flow ${tip.cashFlow}.` : ""}
      </p>

      {/* Edge state 5 — nothing runs out in this window. The ABSENCE of the
          red marker is the good news; §5 is explicit that no green marker is
          substituted for it. */}
      {byAccount && !emptyCaption && depletedFrom === null ? (
        <p data-testid="chart-no-cash-zero" className="mt-1 text-[10.5px] text-zinc-400">
          {CAPTIONS.noCashZero(n)}
        </p>
      ) : null}

      {/* Edge states 6 & 7 — axes stay drawn, one line of copy, no
          illustration and no dashed placeholder columns. */}
      {byAccount && emptyCaption ? (
        <p data-testid="chart-empty" className="mt-1 text-[11px] text-zinc-500">
          {emptyCaption}
        </p>
      ) : null}

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {byAccount ? (
          <>
            {/* The LEGEND lists every asset series in tap-order position,
                including excluded ones — keeping them listed is what tells a
                returning user why a band is missing. They draw no band: the
                stack is built from `assets`, which filters them out. */}
            {legendSeries.map((t) => {
              const slot = slotOf(t.accountId);
              const stroke = seriesStroke(slot);
              return (
                <span
                  key={t.accountId}
                  data-testid={t.excluded ? "legend-excluded" : "legend-series"}
                  className="flex items-center gap-1.5 text-xs text-zinc-600"
                >
                  {t.excluded ? (
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-zinc-400" />
                  ) : (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{
                        background: seriesFill(slot),
                        boxShadow: stroke ? `inset 0 0 0 1px ${stroke}` : undefined,
                      }}
                    />
                  )}
                  <span className={t.excluded ? "line-through" : undefined}>
                    {legendLabel(tapOf(t.accountId), t.name, false)}
                  </span>
                  {t.excluded ? <span className="text-zinc-400">excluded</span> : null}
                </span>
              );
            })}
                        <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="inline-block h-0.5 w-4" style={{ background: NET_HEX }} />
              Net liquid
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="inline-block h-0.5 w-4" style={{ background: NET_HEX }} />
              Net liquid
            </span>
            {showBaseline ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500" title={baselineHelp}>
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-zinc-400" />
                {baselineLabel}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
