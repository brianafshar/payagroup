import { LIVE } from '../api/config';
import type { MealStatus } from '../ui/domain';
import { createStore } from './store';

/** In live mode the API is the source of truth, so nothing is persisted locally. */
const keep = { persist: !LIVE };

/** Signed-in athlete & coach (sample data; live mode fills it in from the API — see `live.ts`). */
export const ATHLETE = {
  name: 'علی رستمی',
  first: 'علی',
  email: 'ali.rostami@gmail.com',
  age: 27,
  heightCm: 181,
  goal: 'عضله‌سازی',
  coach: 'علی احمدی',
  program: 'عضله‌سازی ۸ هفته',
  programWeek: 4,
  programWeeks: 8,
  /** ISO birth date and the goal code (gain · loss · str · gen) — editable in the profile. */
  birthDate: '1998-08-03' as string | null,
  goalKey: 'gain',
};

/** `mustChangePassword`: signed in with a temporary password (forgot password) — only the password screen opens. */
export const session = createStore('session', { signedIn: false, onboarded: false, restoring: LIVE, mustChangePassword: false }, keep);

/* ---------------- nutrition (M40) ---------------- */

export interface PlanMeal {
  /** Live: API meal id. */
  id?: number;
  meal: string;
  time: string;
  items: string;
  /** kcal, protein g, carbs g, fat g */
  k: [number, number, number, number];
}

export const MEALS: PlanMeal[] = [
  { meal: 'صبحانه', time: '۰۷:۳۰', items: '۳ تخم‌مرغ · ۲ برش نان سبوس‌دار · ۲۵۰ میلی‌لیتر شیر', k: [620, 38, 52, 26] },
  { meal: 'ناهار', time: '۱۳:۰۰', items: 'سینه مرغ ۲۰۰ گرم · برنج پخته ۲۰۰ گرم · سالاد با روغن زیتون', k: [780, 62, 88, 18] },
  { meal: 'میان‌وعده', time: '۱۶:۳۰', items: 'ماست یونانی ۲۰۰ گرم · موز · ۳۰ گرم آجیل', k: [480, 24, 50, 20] },
  { meal: 'شام', time: '۲۰:۳۰', items: 'ماهی سالمون ۱۸۰ گرم · سیب‌زمینی ۲۵۰ گرم · سبزیجات', k: [720, 42, 60, 30] },
];
export const TARGETS = { kcal: 2600, protein: 160, carbs: 300, fat: 75, waterL: 2.5 };

/** #47: the coach's menu per weekday (sat … fri) — meal names and planned kcal — for the week preview. */
export interface WeekDayMenu {
  day: string;
  meals: { meal: string; time: string; kcal: number; protein?: number; foods?: { name: string; grams: number; kcal: number; label?: string }[] }[];
}

/** A supplement the coach prescribes (name, dose, when). */
export interface Supplement {
  name: string;
  dose: string;
  timing: string;
}

export const nutrition = createStore<{ st: MealStatus[]; water: number; week?: WeekDayMenu[]; updated?: string | null; supps?: Supplement[] }>(
  'nutrition',
  { st: ['followed', 'partial', 'unlogged', 'unlogged'], water: 1.5 },
  keep,
);

/** Totals counted from logged meals: followed = 100%, partial = 50%, skipped/unlogged = 0. */
export function nutritionTotals(st: MealStatus[]): number[] {
  const f: Record<MealStatus, number> = { followed: 1, partial: 0.5, skipped: 0, unlogged: 0 };
  return [0, 1, 2, 3].map((j) => Math.round(MEALS.reduce((a, m, i) => a + m.k[j] * f[st[i]], 0)));
}

/* ---------------- recovery (M41) ---------------- */

export type RecoveryKey = 'q' | 'e' | 't' | 'o' | 'f';
/** A coach-defined check-in question (#53). */
export interface CustomField {
  key: string;
  label: string;
  kind: 'scale' | 'number' | 'yesno' | 'text';
  unit?: string;
}
/** The coach's recovery plan as the check-in needs it (live mode). */
export interface RecoveryPlanInfo {
  sleepHours: number;
  waterL: number;
  stretchMin: number;
  restDays: string[];
  checks: string[];
  customFields: CustomField[];
}
export const recovery = createStore<{
  sleep: number;
  v: Record<RecoveryKey, number | null>;
  saved: boolean;
  plan: RecoveryPlanInfo | null;
  /** Watch numbers as typed (rhr, hrv, sleep_score, body_battery, spo2, steps). */
  watch: Record<string, string>;
  /** Answers to the coach's own questions, by key. */
  extra: Record<string, number | boolean | string | null>;
}>(
  'recovery',
  {
    sleep: 7.5,
    v: { q: 7, e: 8, t: 3, o: null, f: null },
    saved: false,
    plan: null,
    watch: {},
    extra: {},
  },
  keep,
);

/* ---------------- measurements (M42) ---------------- */

export type MetricKey = 'h' | 'w' | 'f' | 'm' | 'ch' | 'wa' | 'ar' | 'th' | 'hi' | 'ca' | 'ne';
/** [key, label, unit, last value] — height lives here (not in the profile). */
export const METRICS: Array<[MetricKey, string, string, number]> = [
  ['h', 'قد', 'cm', 181],
  ['w', 'وزن', 'kg', 82.4],
  ['f', 'چربی بدن', '٪', 14.8],
  ['m', 'توده عضلانی', 'kg', 39.6],
  ['ch', 'سینه', 'cm', 104],
  ['wa', 'دور کمر', 'cm', 82],
  ['ar', 'بازو', 'cm', 37.5],
  ['th', 'ران', 'cm', 60],
  ['hi', 'باسن', 'cm', 98],
  ['ca', 'ساق', 'cm', 38.5],
  ['ne', 'گردن', 'cm', 39],
];

export interface MeasureEntry {
  date: string;
  /** Live: ISO date for sorting. */
  iso?: string;
  /** Recorded by the athlete (primary source) or the coach. */
  by: 'a' | 'c';
  v: Partial<Record<MetricKey, number>>;
  n: number;
}

export const MEASURE_HISTORY: MeasureEntry[] = [
  { date: '۳۰ شهریور', by: 'a', v: { w: 82.4, f: 14.8, wa: 82 }, n: 9 },
  { date: '۲۲ شهریور', by: 'c', v: { w: 81.9, f: 15.3, wa: 82.5 }, n: 10 },
  { date: '۸ شهریور', by: 'a', v: { w: 81.2, f: 15.5, wa: 82.5 }, n: 10 },
  { date: '۱۱ مرداد', by: 'a', v: { w: 80.4, f: 15.7, wa: 82.5 }, n: 10 },
  { date: '۲۸ تیر', by: 'c', v: { w: 79.8, f: 16.0, wa: 82.5 }, n: 10 },
];

export const measures = createStore<{ extra: MeasureEntry[] }>('measures', { extra: [] }, keep);

export function addMeasurement(v: Partial<Record<MetricKey, number>>): void {
  const n = Object.keys(v).length;
  if (!n) return;
  measures.set((s) => ({ extra: [{ date: 'امروز', by: 'a', v, n }, ...s.extra] }));
}

/* ---------------- health profile (M46) ---------------- */

export type HealthKey = 'cond' | 'inj' | 'med' | 'alg' | 'res' | 'hist' | 'note';
export const HEALTH_FIELDS: Array<[HealthKey, string, string]> = [
  ['cond', 'بیماری‌ها', 'مثلاً آسم، دیابت'],
  ['inj', 'آسیب‌دیدگی‌ها', 'آسیب فعلی یا قبلی'],
  ['med', 'داروها', 'داروهای مصرفی'],
  ['alg', 'حساسیت‌ها', 'غذایی یا دارویی'],
  ['res', 'محدودیت‌های حرکتی', 'حرکاتی که نباید انجام دهی'],
  ['hist', 'سابقه پزشکی', 'جراحی یا بستری'],
  ['note', 'یادداشت', 'هر چیز دیگری برای مربی'],
];
export const health = createStore<{ v: Record<HealthKey, string>; updated: string }>(
  'health',
  {
    v: { cond: 'گزارش نشده', inj: 'گیرافتادگی شانه چپ (۱۴۰۳) · الان درد ندارد', med: 'هیچ', alg: '', res: 'پرس پشت گردن ممنوع', hist: 'آرتروسکوپی زانوی راست، ۱۳۹۸', note: '' },
    updated: '۱۱ شهریور ۱۴۰۵',
  },
  keep,
);

/* ---------------- chat (M47) ---------------- */

export type ChatItem =
  { d: string } | { from: 'a' | 'c'; t: string; at: string; file?: string; voice?: { uri: string; sec: number }; ref?: string; id?: number; edited?: boolean; deleted?: boolean };
export const chat = createStore<{ msgs: ChatItem[] }>(
  'chat',
  {
    msgs: [
      { d: 'دیروز' },
      { from: 'c', t: 'سلام علی، برنامه هفته ۴ آپدیت شد. پرس سینه ست آخر رو ۶۷٫۵ بزن.', at: '۲۱:۰۴' },
      { from: 'a', t: 'چشم مربی 💪', at: '۲۱:۱۲' },
      { d: 'امروز' },
      { from: 'c', t: 'امروز چک‌این صبح یادت نره. کوفتگی پا رو هم بنویس.', at: '۰۷:۰۵' },
    ],
  },
  keep,
);

/* ---------------- profile (M45) ---------------- */

export const profile = createStore<{ photo: string | null; phone: string; notif: boolean; metric: boolean }>(
  'profile',
  {
    photo: null,
    phone: '۰۹۱۲ ۴۸۳ ۲۲۱۷',
    notif: true,
    metric: true,
  },
  keep,
);
