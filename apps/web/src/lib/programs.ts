/**
 * Program builder (C19) ↔ API program tree. The builder shows each week as day columns where day
 * `i` is weekday `i` of the Saturday-first week; each exercise row has a set count with one
 * prescription (reps · load · rest · RPE). The API stores one prescription per set.
 */
import { bandLabel } from '@baseline/core';
import type { DayTime, Exercise, ProgramWeek, Weekday } from '@/data/types';

export const WEEKDAYS: Weekday[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

export interface BuilderExercise {
  uid: string;
  exId: string;
  name: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
  rpe?: string;
  note?: string;
  /** Unit of `load`: kg / lb (weight), km / m (distance), s / min (time). */
  unit?: string;
  /** Session of the day this exercise belongs to ('' = the day's time). */
  time?: DayTime;
}

/** How the «load» of an exercise is labelled in the builder, by its unit. */
export function loadLabel(unit: string | undefined): { label: string; suffix: string } {
  switch (unit) {
    case 'km':
      return { label: 'مسافت', suffix: 'km' };
    case 'm':
      return { label: 'مسافت', suffix: 'm' };
    case 's':
      return { label: 'مدت', suffix: 'ثانیه' };
    case 'min':
      return { label: 'مدت', suffix: 'دقیقه' };
    case 'lb':
      return { label: 'وزنه', suffix: 'lb' };
    case 'rep':
      return { label: 'وزنه', suffix: '' };
    case 'band':
      return { label: 'شدت کش', suffix: '' };
    default:
      return { label: 'وزنه', suffix: 'kg' };
  }
}

/** «۶۰ kg», «۵ km» or, for band work, «کش سبز» (the load is the band level). */
export function loadText(unit: string | undefined, load: string): string {
  if (!load) return '';
  if (unit === 'band') return bandLabel(+toEn(load)) || load;
  return load + ' ' + loadLabel(unit).suffix;
}

/** Parts of the day a session can be set to (program builder, PDF, athlete app). */
export const DAY_TIMES: Array<[DayTime, string]> = [
  ['', 'بدون زمان'],
  ['morning', 'صبح'],
  ['noon', 'ظهر'],
  ['afternoon', 'عصر'],
  ['night', 'شب'],
];

const TIME_RANK: Record<string, number> = { '': -1, morning: 0, noon: 1, afternoon: 2, night: 3 };

/** The day's sessions (parts of the day) in order: the day's own time, every exercise's, and empty ones the coach added. */
export function daySections(day: { time?: DayTime; ex: BuilderExercise[] }, extra: DayTime[] = []): DayTime[] {
  const base = (day.time || '') as DayTime;
  const all = new Set<DayTime>([base, ...day.ex.map((e) => (e.time || base) as DayTime), ...extra]);
  return [...all].sort((a, b) => TIME_RANK[a] - TIME_RANK[b]);
}

export interface BuilderWeek {
  days: Array<{ focus: string; time?: DayTime; ex: BuilderExercise[] }>;
}

const toFa = (v: string | number) =>
  String(v)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])
    .replace('.', '٫');
const toEn = (v: string) =>
  String(v ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace('٫', '.');
const num = (v: string): number | null => {
  const n = parseFloat(toEn(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const uid = () => Math.random().toString(36).slice(2);

export function toBuilderWeeks(weeks: ProgramWeek[] | undefined, exercises: Exercise[]): BuilderWeek[] {
  if (!weeks?.length) return [{ days: [{ focus: 'روز ۱', ex: [] }] }];
  return weeks.map((w) => {
    const byDay = new Map(w.days.map((d) => [WEEKDAYS.indexOf(d.weekday), d]));
    const last = Math.max(0, ...[...byDay.entries()].filter(([, d]) => !d.rest && d.exercises.length).map(([i]) => i));
    return {
      days: Array.from({ length: last + 1 }, (_, i) => {
        const d = byDay.get(i);
        return {
          focus: d?.focus || '',
          time: d?.time || '',
          ex: (d?.exercises || []).map((slot) => {
            const first = slot.sets[0] || { reps: '', unit: 'kg' };
            const ex = exercises.find((e) => e.id === slot.exerciseId);
            return {
              unit: first.unit && first.unit !== 'kg' ? first.unit : ex?.unit || 'kg',
              uid: slot.id || uid(),
              exId: slot.exerciseId,
              name: exercises.find((e) => e.id === slot.exerciseId)?.name || 'حرکت',
              sets: slot.sets.length,
              reps: toFa(first.reps || ''),
              load: first.value != null ? toFa(first.value) : '',
              rest: first.restSec != null ? toFa(first.restSec) : '',
              rpe: first.rpe != null ? toFa(first.rpe) : '',
              note: slot.note || '',
              time: slot.time || '',
            };
          }),
        };
      }),
    };
  });
}

export function fromBuilderWeeks(weeks: BuilderWeek[]): ProgramWeek[] {
  return weeks.map((w, wi) => ({
    index: wi + 1,
    days: w.days.slice(0, 7).map((d, di) => ({
      weekday: WEEKDAYS[di],
      focus: d.focus || undefined,
      time: d.time || '',
      rest: d.ex.length === 0,
      exercises: d.ex.map((e) => ({
        id: e.uid,
        exerciseId: e.exId,
        note: e.note || undefined,
        time: e.time || '',
        sets: Array.from({ length: Math.max(1, +e.sets || 1) }, () => ({
          reps: toEn(e.reps || '').trim() || '—',
          value: num(e.load),
          unit: e.unit || 'kg',
          restSec: num(e.rest),
          rpe: num(e.rpe || ''),
        })),
      })),
    })),
  }));
}

/** Sessions per week = the busiest week's training days. */
export function sessionsPerWeek(weeks: BuilderWeek[]): number {
  return Math.max(0, ...weeks.map((w) => w.days.filter((d) => d.ex.length).length));
}

/** #103: copy one time section of a day (e.g. Saturday morning) into a section of another day. `replace`
 * clears what the target section had; the target day takes the section's time if it was empty. */
export function copySection(weeks: BuilderWeek[], from: { w: number; d: number; t: DayTime }, to: { w: number; d: number; t: DayTime }, mode: 'replace' | 'append'): BuilderWeek[] {
  const out: BuilderWeek[] = JSON.parse(JSON.stringify(weeks));
  const src = weeks[from.w].days[from.d];
  const base = src.time || '';
  const items = src.ex.filter((e) => (e.time || base) === from.t).map((e) => ({ ...e, uid: Math.random().toString(36).slice(2) }));
  const day = out[to.w].days[to.d];
  if (!day.ex.length && !day.time) day.time = to.t;
  const tbase = day.time || '';
  if (mode === 'replace') day.ex = day.ex.filter((e) => (e.time || tbase) !== to.t);
  day.ex.push(...items.map((e) => ({ ...e, time: (to.t === tbase ? '' : to.t) as DayTime })));
  return out;
}
