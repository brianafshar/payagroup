/**
 * Grouping dated points for the progress charts (web and app): by day, week (Saturday → Friday) or
 * Persian calendar month. Volumes are summed, everything else averaged; empty periods stay in the axis
 * (null for averages, 0 for sums) so time keeps its scale.
 */
import { toJalali } from './jalali';
import { faDigits, JALALI_MONTHS } from './persian';

export type Granularity = 'day' | 'week' | 'month';
export type Agg = 'sum' | 'avg' | 'max';
export interface DatedPoint {
  date: string; // ISO yyyy-mm-dd
  value: number | null;
}
export interface Bucket {
  key: string;
  start: Date;
  label: string;
}

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const at = (s: string) => new Date(s + 'T12:00:00');

function bucketOf(d: Date, g: Granularity): { key: string; start: Date } {
  if (g === 'day') return { key: iso(d), start: d };
  if (g === 'week') {
    const s = new Date(d);
    s.setDate(d.getDate() - ((d.getDay() + 1) % 7)); // back to Saturday
    return { key: iso(s), start: s };
  }
  const j = toJalali(d);
  const s = new Date(d);
  s.setDate(d.getDate() - (j.jd - 1));
  return { key: j.jy + '-' + j.jm, start: s };
}

function next(start: Date, g: Granularity): Date {
  const d = new Date(start);
  if (g === 'day') d.setDate(d.getDate() + 1);
  else if (g === 'week') d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 32); // lands in the next Persian month; bucketOf() snaps to its start
  return d;
}

export function bucketLabel(start: Date, g: Granularity, withYear = false): string {
  const j = toJalali(start);
  if (g === 'month') return JALALI_MONTHS[j.jm - 1] + (withYear ? ' ' + faDigits(String(j.jy).slice(2)) : '');
  return faDigits(j.jd) + ' ' + JALALI_MONTHS[j.jm - 1];
}

/** Every period from `from` to `to` (ISO dates), oldest first. */
export function buckets(from: string, to: string, g: Granularity): Bucket[] {
  const out: Bucket[] = [];
  let b = bucketOf(at(from), g);
  const end = bucketOf(at(to), g).key;
  for (let guard = 0; guard < 5000; guard++) {
    out.push({ ...b, label: '' });
    if (b.key === end) break;
    b = bucketOf(next(b.start, g), g);
  }
  const years = new Set(out.map((x) => toJalali(x.start).jy)).size > 1;
  return out.map((x) => ({ ...x, label: bucketLabel(x.start, g, years) }));
}

/** Values of `points` per bucket. */
export function groupPoints(points: DatedPoint[], bs: Bucket[], g: Granularity, agg: Agg): Array<number | null> {
  const acc = new Map<string, number[]>();
  for (const p of points) {
    if (p.value == null) continue;
    const k = bucketOf(at(p.date), g).key;
    (acc.get(k) || acc.set(k, []).get(k)!).push(p.value);
  }
  return bs.map((b) => {
    const v = acc.get(b.key);
    if (!v?.length) return agg === 'sum' ? 0 : null;
    if (agg === 'sum') return +v.reduce((a, x) => a + x, 0).toFixed(2);
    if (agg === 'max') return Math.max(...v);
    return +(v.reduce((a, x) => a + x, 0) / v.length).toFixed(2);
  });
}

/** How many periods fit on screen at once before the axis scrolls. */
export const WINDOW: Record<Granularity, number> = { day: 14, week: 12, month: 12 };

/** Muscle group names (exercise categories) for the strength volume charts. */
export const MUSCLE_GROUPS: Record<string, string> = {
  chest: 'سینه',
  back: 'پشت',
  legs: 'پا',
  arms: 'بازو',
  shoulders: 'سرشانه',
  core: 'میان‌تنه',
  conditioning: 'هوازی',
  power: 'توان',
};

export interface VolumeGroup {
  category: string;
  kg: number;
  points: DatedPoint[];
}

/**
 * Strength volume split for a stacked chart: the `n` biggest muscle groups, the rest summed as «سایر».
 * Each part has its share of the whole range (0–100).
 */
export function volumeParts(groups: VolumeGroup[], n = 3): Array<{ name: string; kg: number; share: number; points: DatedPoint[] }> {
  const total = groups.reduce((a, g) => a + g.kg, 0) || 1;
  const head = groups.slice(0, groups.length > n + 1 ? n : n + 1);
  const rest = groups.slice(head.length);
  const parts = head.map((g) => ({ name: MUSCLE_GROUPS[g.category] || g.category, kg: g.kg, points: g.points }));
  if (rest.length) {
    const byDay = new Map<string, number>();
    rest.forEach((g) => g.points.forEach((p) => byDay.set(p.date, (byDay.get(p.date) || 0) + (p.value || 0))));
    parts.push({
      name: 'سایر',
      kg: rest.reduce((a, g) => a + g.kg, 0),
      points: [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value })),
    });
  }
  return parts.map((p) => ({ ...p, share: Math.round((p.kg / total) * 100) }));
}
