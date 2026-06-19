// =============================================================================
// Pure date helpers for the engine.
//
// The engine must be deterministic and resumable, so it never calls
// `Date.now()` / `new Date()` with no args. All dates flow in from the
// Scenario as ISO `YYYY-MM-DD` strings and are manipulated arithmetically here.
// =============================================================================

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number; // 1–31
}

/** Parse an ISO `YYYY-MM-DD` (extra time component tolerated and ignored). */
export function parseISO(iso: string): YMD {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  return { y, m, d };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISO({ y, m, d }: YMD): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** `YYYY-MM` key for a date. */
export function monthKey(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${y}-${pad(m)}`;
}

export function daysInMonth(y: number, m: number): number {
  // m is 1–12; day 0 of next month = last day of this month.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** First day of the month containing `iso`, as ISO. */
export function firstOfMonth(iso: string): string {
  const { y, m } = parseISO(iso);
  return toISO({ y, m, d: 1 });
}

/** Add `n` months to a date, clamping the day to the target month's length. */
export function addMonths(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const zeroBased = (m - 1) + n;
  const ny = y + Math.floor(zeroBased / 12);
  const nm = ((zeroBased % 12) + 12) % 12; // 0–11
  const month = nm + 1;
  const day = Math.min(d, daysInMonth(ny, month));
  return toISO({ y: ny, m: month, d: day });
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const ms = Date.UTC(y, m - 1, d) + n * 86_400_000;
  const dt = new Date(ms);
  return toISO({
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  });
}

/** Whole days from `a` to `b` (b - a); negative if b is before a. */
export function daysBetween(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  const ms = Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d);
  return Math.round(ms / 86_400_000);
}

/** Compare by calendar day. -1 if a<b, 0 if equal, 1 if a>b. */
export function compareISO(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  const va = da.y * 10000 + da.m * 100 + da.d;
  const vb = db.y * 10000 + db.m * 100 + db.d;
  return va < vb ? -1 : va > vb ? 1 : 0;
}

/** True if two dates fall in the same calendar month. */
export function sameMonth(a: string, b: string): boolean {
  const da = parseISO(a);
  const db = parseISO(b);
  return da.y === db.y && da.m === db.m;
}

/** True if `target`'s month is within [start, end] inclusive by month. */
export function monthInRange(target: string, start: string, end?: string): boolean {
  const t = parseISO(target);
  const s = parseISO(start);
  const tv = t.y * 100 + t.m;
  const sv = s.y * 100 + s.m;
  if (tv < sv) return false;
  if (!end) return true;
  const e = parseISO(end);
  const ev = e.y * 100 + e.m;
  return tv <= ev;
}

/**
 * Inclusive count of month boundaries from `start` to `end`.
 * e.g. 2026-01-01 .. 2026-12-31 => 12.
 */
export function monthsInclusive(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  return (e.y - s.y) * 12 + (e.m - s.m) + 1;
}

/**
 * The tax-filing deadline for a withdrawal made on `iso`: April 15 of the
 * following calendar year (the "default following April").
 */
export function followingApril15(iso: string): string {
  const { y } = parseISO(iso);
  return toISO({ y: y + 1, m: 4, d: 15 });
}
