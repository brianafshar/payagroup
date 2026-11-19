import { faDigits } from '@baseline/core';
import { LIVE } from '../api/config';
import { faError, http } from '../api/http';
import { toast } from '../ui/overlays';
import { createStore } from './store';

/** One exercise in today's session (from the coach's program). */
export interface WorkoutExercise {
  id: string;
  name: string;
  cat: string;
  eq: string;
  sets: number;
  reps: string;
  /** Target load (kg). */
  w: number;
  /** Rest between sets (s). */
  rest: number;
  /** Last session's sets: [kg, reps]. */
  prev: Array<[number, number]>;
  /** Current best for 8+ reps (kg) — beating it is a PR. */
  pr8?: number;
  cues: string[];
  note: string;
  /** Live: API exercise id and the coach's video URL. */
  exerciseId?: number;
  video?: string | null;
  /** Load unit: kg, or `band` (the value is the band level 1–5), km, s… */
  unit?: string;
  /** Part of the day of this exercise when the day has several sessions: morning · noon · afternoon · night. */
  time?: string;
  /** Live: the exercise's position in the program day (logged sets refer to it). */
  slot?: number;
  /** Library picture: end pose (or the coach's own picture) and, for two-frame illustrations, the start pose. */
  image?: string | null;
  imageStart?: string | null;
  illustrationMatch?: string;
  badge?: string;
  steps?: string[];
  musclesPrimary?: string[];
  musclesSecondary?: string[];
  issues?: string[];
}

export const TIME_LABEL: Record<string, string> = { morning: 'صبح', noon: 'ظهر', afternoon: 'عصر', night: 'شب' };

/** Exercises split by part of the day, in day order (one group without a label when there's a single time). */
export function byTime<T extends { time?: string }>(list: T[]): Array<{ label: string; items: Array<{ e: T; i: number }> }> {
  const order = ['morning', 'noon', 'afternoon', 'night', ''];
  const groups = new Map<string, Array<{ e: T; i: number }>>();
  list.forEach((e, i) => {
    const k = order.includes(e.time || '') ? e.time || '' : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ e, i });
  });
  const keys = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return keys.map((k) => ({ label: keys.length > 1 ? TIME_LABEL[k] || 'سایر' : '', items: groups.get(k)! }));
}

/** Band work is logged as a band level, not kilos (no volume, no kg records). */
export const isBand = (e: WorkoutExercise) => e.unit === 'band';
const isKg = (e: WorkoutExercise) => !e.unit || e.unit === 'kg';

/** Today's session (live mode rewrites it in place from `GET /me/today`). */
export const SESSION = {
  title: 'سینه + پشت بازو',
  week: 4,
  day: 2,
  program: 'عضله‌سازی ۸ هفته',
  weeks: 8,
  minutes: 60,
  coachNote: 'روی پشت بازو ۱ تا ۲ تکرار در ذخیره نگه دار. اگر شانه چپ درد گرفت متوقف کن.',
  rest: false,
  /** Live: the program this session belongs to (athletes can follow several, #74). */
  programId: null as number | null,
  /** Live: the day's part this session is (several sessions a day are logged and finished one by one). */
  part: '',
};

/** Today's session of each program the athlete follows (#74); the Workout tab switches between them. */
export interface TodaySession {
  programId: number;
  /** The day's part when it has several sessions (morning, night…); '' for a single session. */
  part: string;
  name: string;
  sport: string;
  focus: string;
  rest: boolean;
  status: string | null;
  selected: boolean;
}
export const todaySessions = createStore<{ list: TodaySession[] }>('today-sessions', { list: [] }, { persist: false });

export const EXERCISES: WorkoutExercise[] = [
  {
    id: 'bench',
    name: 'پرس سینه',
    cat: 'سینه',
    eq: 'هالتر',
    sets: 4,
    reps: '۸–۱۰',
    w: 60,
    rest: 90,
    prev: [
      [60, 10],
      [60, 10],
      [62.5, 8],
      [65, 8],
    ],
    pr8: 65,
    cues: ['کتف‌ها را جمع و به نیمکت بچسبان', 'میله را تا وسط سینه پایین بیاور', 'پاها محکم روی زمین'],
    note: 'ست آخر را ۶۷٫۵ بزن اگر تکرارها تمیز بود.',
  },
  {
    id: 'incline',
    name: 'پرس سرشیب دمبل',
    cat: 'سینه',
    eq: 'دمبل',
    sets: 4,
    reps: '۱۰',
    w: 22,
    rest: 75,
    prev: [
      [22, 10],
      [22, 10],
      [22, 9],
      [22, 8],
    ],
    cues: ['شیب نیمکت ۳۰ درجه', 'آرنج‌ها ۴۵ درجه از بدن', 'پایین آوردن کنترل‌شده، ۲ ثانیه'],
    note: '',
  },
  {
    id: 'fly',
    name: 'فلای سیم‌کش',
    cat: 'سینه',
    eq: 'سیم‌کش',
    sets: 3,
    reps: '۱۲',
    w: 15,
    rest: 60,
    prev: [
      [15, 12],
      [15, 12],
      [15, 11],
    ],
    cues: ['آرنج کمی خم و ثابت', 'دست‌ها جلوی سینه به هم برسند', 'کشش کامل در پایین حرکت'],
    note: '',
  },
  {
    id: 'push',
    name: 'پشت بازو سیم‌کش',
    cat: 'بازو',
    eq: 'سیم‌کش',
    sets: 4,
    reps: '۱۲',
    w: 25,
    rest: 60,
    prev: [
      [25, 12],
      [25, 12],
      [25, 11],
      [22.5, 12],
    ],
    cues: ['آرنج‌ها کنار بدن قفل', 'فقط ساعد حرکت کند', 'در پایین مکث کوتاه'],
    note: '۱ تا ۲ تکرار در ذخیره نگه دار. اگر شانه چپ درد گرفت متوقف کن.',
  },
];

export type SetLog = [kg: number, reps: number];

export interface WorkoutState {
  /** Logged sets per exercise, in order. */
  logs: SetLog[][];
  finished: boolean;
  rpe: number | null;
  /** Live: server log id, set ids by [exercise][set], server-detected PR flags, and the finish summary. */
  logId?: number | null;
  setIds?: number[][];
  prFlags?: boolean[][];
  summaryPrs?: PR[];
  loaded?: boolean;
  /** Live: the coach's feedback on today's session (#62). */
  feedback?: string[];
}

/** The design's mid-session state: 12 of 15 sets done, bench PR on the last set. */
export const SEED: WorkoutState = {
  logs: [
    [
      [60, 10],
      [60, 10],
      [62.5, 8],
      [67.5, 8],
    ],
    [
      [22, 10],
      [22, 10],
      [22, 10],
      [22, 10],
    ],
    [
      [15, 12],
      [15, 12],
      [15, 12],
    ],
    [[25, 12]],
  ],
  finished: false,
  rpe: null,
};

export const workout = createStore<WorkoutState>('workout', LIVE ? { logs: [], finished: false, rpe: null, loaded: false } : SEED, { persist: !LIVE });

export interface PR {
  ex: string;
  w: number;
  r: number;
  prev: number;
}

/** Preview of a PR (the server decides for real in live mode: best load for at least as many reps). */
export function isPR(e: WorkoutExercise, [w, r]: SetLog): boolean {
  return isKg(e) && !!e.pr8 && (LIVE || r >= 8) && w > e.pr8;
}

export function stats(s: WorkoutState, ex: WorkoutExercise[] = EXERCISES) {
  let done = 0;
  let total = 0;
  let vol = 0;
  const prs: PR[] = [];
  ex.forEach((e, i) => {
    total += e.sets;
    const l = s.logs[i] || [];
    done += Math.min(l.length, e.sets);
    l.forEach((x, k) => {
      if (isKg(e)) vol += x[0] * x[1];
      const flagged = LIVE ? !!s.prFlags?.[i]?.[k] : !!e.pr8 && isPR(e, x);
      if (flagged) prs.push({ ex: e.name, w: x[0], r: x[1], prev: e.pr8 || 0 });
    });
  });
  const cur = ex.findIndex((e, i) => (s.logs[i] || []).length < e.sets);
  return { done, total, vol, prs, cur };
}

/** Next exercise with sets left, searching after `from` and wrapping; -1 when all done. */
export function nextUnfinished(s: WorkoutState, from: number, ex: WorkoutExercise[] = EXERCISES): number {
  for (let k = 1; k <= ex.length; k++) {
    const j = (from + k) % ex.length;
    if ((s.logs[j] || []).length < ex[j].sets) return j;
  }
  return -1;
}

export function logSet(e: number, set: SetLog): void {
  const k = (workout.get().logs[e] || []).length;
  workout.set((s) => {
    const logs = s.logs.map((l) => l.slice());
    logs[e] = [...(logs[e] || []), set];
    return { logs };
  });
  if (LIVE) void track(saveSet(e, k, set));
}

export function undoLastSet(e: number): void {
  const k = (workout.get().logs[e] || []).length - 1;
  workout.set((s) => {
    const logs = s.logs.map((l) => l.slice());
    logs[e] = (logs[e] || []).slice(0, -1);
    return { logs };
  });
  if (LIVE && k >= 0) void track(unsaveSet(e, k));
}

export function finishWorkout(rpe: number | null = null, note = ''): void {
  workout.set({ finished: true, rpe });
  if (LIVE) void track(finishLive(rpe, note));
}

/* ---------------------------------------------------------------- live mode (API) */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const CAT: Record<string, string> = { chest: 'سینه', back: 'پشت', legs: 'پا', arms: 'بازو', shoulders: 'سرشانه', conditioning: 'هوازی', power: 'توان' };
const EQUIP: Record<string, string> = { barbell: 'هالتر', dumbbell: 'دمبل', cable: 'سیم‌کش', bodyweight: 'وزن بدن', machine: 'دستگاه', box: 'جعبه' };
const WEEKDAY_INDEX: Record<string, number> = { sat: 1, sun: 2, mon: 3, tue: 4, wed: 5, thu: 6, fri: 7 };
const firstInt = (reps: string) =>
  parseInt(
    String(reps).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),
    10,
  ) || 0;

/** The program session the athlete picked on the Workout tab (null: the server's default). */
let chosenProgram: number | null = null;
let chosenPart: string | null = null;
/** Set saves / finishes in flight: a refresh then would briefly show the server's older state. */
let inflight = 0;
const track = async <T>(p: Promise<T>): Promise<T> => {
  inflight++;
  try {
    return await p;
  } finally {
    inflight--;
  }
};

/** Switch the Workout tab to another program's session today (#74). */
export async function selectSession(programId: number, part: string | null = null): Promise<void> {
  chosenProgram = programId;
  chosenPart = part;
  workout.set({ loaded: false });
  await loadToday();
}

/** Reload today's session unless a set is being saved (tab focus, app foreground, coach changes, #74). */
export async function refreshToday(): Promise<void> {
  if (inflight) return;
  await loadToday();
}

/** `GET /me/today` → today's session, exercises (targets as prefill) and what's been logged. */
export async function loadToday(): Promise<void> {
  const q = [chosenProgram ? 'program=' + chosenProgram : '', chosenPart ? 'part=' + chosenPart : ''].filter(Boolean).join('&');
  const t = await http.get<Json>('/me/today/' + (q ? '?' + q : ''));
  todaySessions.set({ list: t.sessions || [] });
  const items: Json[] = t.exercises || [];
  const ex: WorkoutExercise[] = items.map((it) => {
    const sets: Json[] = it.sets || [];
    const first = sets[0] || {};
    return {
      id: String(it.exercise?.id ?? it.slot),
      exerciseId: it.exercise?.id,
      name: it.exercise?.name || 'حرکت',
      cat: CAT[it.exercise?.cat] || it.exercise?.cat || '',
      eq: EQUIP[it.exercise?.equip] || it.exercise?.equip || '',
      sets: sets.length,
      reps: faDigits(first.reps || ''),
      w: first.value ?? 0,
      rest: first.restSec ?? 60,
      prev: sets.map((x) => [x.value ?? 0, firstInt(x.reps)] as SetLog),
      pr8: it.bestKg ?? undefined,
      cues: it.exercise?.cues || [],
      note: it.note || '',
      video: it.exercise?.videoSrc || null,
      unit: first.unit || it.exercise?.unit || 'kg',
      time: it.time || '',
      slot: it.slot,
      image: it.exercise?.imageSrc || null,
      imageStart: it.exercise?.imageStartSrc || null,
      illustrationMatch: it.exercise?.illustrationMatch || '',
      badge: it.exercise?.badge || '',
      steps: it.exercise?.steps || [],
      musclesPrimary: it.exercise?.musclesPrimary || [],
      musclesSecondary: it.exercise?.musclesSecondary || [],
      issues: it.exercise?.issues || [],
    };
  });
  EXERCISES.splice(0, EXERCISES.length, ...ex);
  Object.assign(SESSION, {
    title: t.rest ? 'روز استراحت' : t.focus || 'تمرین امروز',
    week: t.week || 0,
    day: WEEKDAY_INDEX[t.weekday] || 0,
    program: t.program?.name || 'بدون برنامه',
    weeks: t.program?.durationWeeks || 0,
    minutes: Math.max(20, Math.round(ex.reduce((a, e) => a + e.sets * (e.rest + 45), 0) / 60)),
    coachNote:
      ex
        .map((e) => e.note)
        .filter(Boolean)
        .join(' · ') || 'یادداشتی برای امروز ثبت نشده.',
    rest: !!t.rest,
    programId: t.program?.id ?? null,
    part: t.part || '',
  });
  const log = t.log;
  const logs: SetLog[][] = [];
  const setIds: number[][] = [];
  const prFlags: boolean[][] = [];
  items.forEach((it, i) => {
    const logged = (it.sets || []).map((x: Json) => x.logged).filter(Boolean);
    setIds[i] = logged.map((x: Json) => x.id);
    const done = logged.filter((x: Json) => x.done);
    logs[i] = done.map((x: Json) => [x.actualValue ?? x.targetValue ?? 0, firstInt(x.actualReps || x.targetReps)] as SetLog);
    prFlags[i] = done.map((x: Json) => !!x.isPr);
  });
  // Finished = the athlete pressed «پایان تمرین», whatever was done (even nothing → «missed»), #64.
  const finished = !!log?.finishedAt;
  workout.set({ logs, setIds, prFlags, logId: log?.id ?? null, finished, rpe: log?.rpe ?? null, loaded: true, feedback: log?.coachFeedback || [] });
}

/** Opens today's server log (prefilled sets) on the first ticked set. */
async function ensureStarted(): Promise<void> {
  if (workout.get().logId && workout.get().setIds?.some((x) => x.length)) return;
  const log = await http.post<Json>('/workouts/start/', { ...(SESSION.programId ? { program: SESSION.programId } : {}), part: SESSION.part });
  // Stay on this session while it's under way (refreshes otherwise jump to the next one not started).
  chosenProgram = log.programId ?? SESSION.programId;
  chosenPart = log.part ?? SESSION.part;
  const setIds: number[][] = EXERCISES.map(() => []);
  (log.sets as Json[]).forEach((x) => {
    // A part holds some of the day's exercises: map the day slot to its place in this session's list.
    const i = EXERCISES.findIndex((e) => (e.slot ?? -1) === x.slot);
    if (i >= 0) (setIds[i] ||= [])[x.index] = x.id;
  });
  workout.set({ logId: log.id, setIds });
}

async function saveSet(e: number, k: number, [w, r]: SetLog): Promise<void> {
  try {
    await ensureStarted();
    const id = workout.get().setIds?.[e]?.[k];
    if (!id) return;
    const res = await http.patch<Json>(`/sets/${id}/`, { done: true, actualValue: w, actualReps: String(r) });
    workout.set((s) => {
      const prFlags = (s.prFlags || []).map((x) => x.slice());
      (prFlags[e] ||= [])[k] = !!res.isPr;
      return { prFlags };
    });
  } catch (err) {
    toast('ست ذخیره نشد', faError(err), 'error');
  }
}

async function unsaveSet(e: number, k: number): Promise<void> {
  const id = workout.get().setIds?.[e]?.[k];
  if (!id) return;
  try {
    await http.patch(`/sets/${id}/`, { done: false });
    workout.set((s) => {
      const prFlags = (s.prFlags || []).map((x) => x.slice());
      if (prFlags[e]) prFlags[e] = prFlags[e].slice(0, k);
      return { prFlags };
    });
  } catch (err) {
    toast('انجام نشد', faError(err), 'error');
  }
}

/** `POST /workouts/{id}/finish/` (can be repeated to update the RPE / note). */
/** Optional cardio details the athlete adds when finishing (running analytics). */
export interface CardioInput {
  distanceKm?: number | null;
  durationMin?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  cadenceSpm?: number | null;
  elevationM?: number | null;
  /** From the watch: Training Effect (0–5) and lactate threshold. */
  aerobicTe?: number | null;
  anaerobicTe?: number | null;
  ltHr?: number | null;
  ltPace?: number | null;
}

export async function finishLive(rpe: number | null, note = '', cardio: CardioInput = {}): Promise<void> {
  try {
    await ensureStarted();
    const id = workout.get().logId;
    if (!id) return;
    const extra = Object.fromEntries(Object.entries(cardio).filter(([, v]) => v != null));
    const r = await http.post<Json>(`/workouts/${id}/finish/`, { rpe, note, ...extra });
    // Done with this session: the Workout tab moves on to the day's next one (e.g. tonight's part).
    chosenProgram = null;
    chosenPart = null;
    workout.set({ summaryPrs: (r.prs || []).map((p: Json) => ({ ex: p.exerciseName, w: p.value, r: parseInt(p.type, 10) || 0, prev: p.previous || 0 })) });
  } catch (err) {
    toast('پایان تمرین ذخیره نشد', faError(err), 'error');
  }
}
