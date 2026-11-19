/**
 * Live mode: loads the athlete's data from the API into the app's stores, and the actions screens call
 * to change it. Every action falls back to the local sample behaviour when the app runs without an API
 * (`LIVE` false: tests and design review).
 */
import { faDigits, faNumber, faTime, toJalali, JALALI_MONTHS } from '@baseline/core';
import { LIVE } from '../api/config';
import { ApiError, faError, getAll, http } from '../api/http';
import { toast } from '../ui/overlays';
import type { MealStatus } from '../ui/domain';
import {
  ATHLETE,
  chat,
  health,
  MEALS,
  measures,
  MEASURE_HISTORY,
  METRICS,
  nutrition,
  profile,
  recovery,
  TARGETS,
  type ChatItem,
  type HealthKey,
  type MeasureEntry,
  type MetricKey,
  type PlanMeal,
  type RecoveryKey,
} from './athlete';
import { createStore } from './store';
import { loadToday, refreshToday } from './workout';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const iso = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const faDay = (isoDate: string) => {
  const { jm, jd } = toJalali(new Date(isoDate + 'T12:00:00'));
  return faDigits(jd) + ' ' + JALALI_MONTHS[jm - 1];
};
const GOAL: Record<string, string> = { gain: 'عضله‌سازی', loss: 'کاهش چربی', str: 'قدرت', gen: 'آمادگی عمومی' };

/** Records (M44, Home) and progress (M43) — live-only data. */
export const records = createStore<{ list: Json[]; loaded: boolean }>('records', { list: [], loaded: false }, { persist: false });
export const progress = createStore<{ data: Json | null; days: number }>('progress', { data: null, days: 180 }, { persist: false });

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) console.warn('load failed', e);
  }
}

/** Everything the tabs show; called after sign-in and on pull-to-refresh / app focus. */
export async function loadAll(): Promise<void> {
  await Promise.all([
    safe(loadProfile),
    safe(loadToday),
    safe(loadNutrition),
    safe(loadRecovery),
    safe(loadMeasures),
    safe(loadHealth),
    safe(loadChat),
    safe(loadGroups),
    safe(loadRecords),
    safe(() => loadProgress()),
    safe(loadInbox),
    safe(loadTomorrow),
  ]);
}

let lastTraining = 0;
/**
 * Reload what the coach controls about training — today's session(s), tomorrow and the program name —
 * when the Workout / Home tab is focused, the app comes back to the foreground or the coach changes the
 * athlete's programs (#74: no more signing out to see a newly assigned program). At most every 5 s
 * unless `force` (pull to refresh, the coach's change).
 */
export async function refreshTraining(force = false): Promise<void> {
  if (!LIVE || (!force && Date.now() - lastTraining < 5000)) return;
  lastTraining = Date.now();
  await Promise.all([safe(refreshToday), safe(loadTomorrow), safe(loadProfile)]);
}

/** Tomorrow's prescription for the home screen («فردا»). */
export const tomorrow = createStore<{ day: Json | null }>('tomorrow', { day: null }, { persist: false });

export async function loadTomorrow(): Promise<void> {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const r = await http.get<Json>(`/me/schedule/?start=${iso(d)}&days=1`);
  tomorrow.set({ day: r.program ? (r.days || [])[0] || null : null });
}

/* ---------------- in-app notifications ---------------- */

/** What the coach changed or said, from `/notifications/` — the in-app copy of push, so the app needs none. */
export const inbox = createStore<{ items: Json[]; unread: number; loaded: boolean }>('inbox', { items: [], unread: 0, loaded: false }, { persist: false });

export async function loadInbox(): Promise<void> {
  const r = await http.get<Json>('/notifications/');
  inbox.set({ items: r.results || [], unread: r.unread || 0, loaded: true });
}

export async function markInboxRead(): Promise<void> {
  if (!inbox.get().unread) return;
  inbox.set((s) => ({ unread: 0, items: s.items.map((x) => ({ ...x, unread: false })) }));
  await http.post('/notifications/read/', {}).catch(() => {});
}

/* ---------------- profile ---------------- */

export async function loadProfile(): Promise<void> {
  const [me, a] = await Promise.all([http.get<Json>('/auth/me/'), http.get<Json>('/me/athlete/')]);
  const age = a.birthDate ? Math.floor((Date.now() - Date.parse(a.birthDate)) / (365.25 * 86400000)) : 0;
  Object.assign(ATHLETE, {
    name: me.name,
    first: me.name.split(' ')[0],
    email: me.email,
    age,
    heightCm: a.heightCm ?? 0,
    goal: GOAL[a.goal] || '',
    goalKey: a.goal || '',
    birthDate: a.birthDate || null,
    coach: a.coachName || '',
    program: a.programName || 'بدون برنامه',
    programWeek: a.programWeek || 0,
    programWeeks: 0,
  });
  profile.set({ photo: me.photo || null, phone: faDigits(me.phone || '') });
}

const ageOf = (iso: string | null) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / (365.25 * 86400000)) : 0);

/** Photo, phone, birth date and goal (M45). */
export async function saveProfile(
  photo: { uri: string; mimeType?: string; fileName?: string | null } | null,
  phone: string,
  info: { birthDate?: string | null; goal?: string } = {},
): Promise<boolean> {
  const applyInfo = () => {
    if (info.birthDate !== undefined) Object.assign(ATHLETE, { birthDate: info.birthDate, age: ageOf(info.birthDate) });
    if (info.goal !== undefined) Object.assign(ATHLETE, { goalKey: info.goal, goal: GOAL[info.goal] || '' });
  };
  if (!LIVE) {
    applyInfo();
    profile.set({ photo: photo?.uri ?? profile.get().photo, phone });
    return true;
  }
  try {
    const en = phone.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s/g, '');
    if (info.birthDate !== undefined || info.goal !== undefined) {
      await http.patch<Json>('/me/athlete/', { ...(info.birthDate !== undefined ? { birthDate: info.birthDate } : {}), ...(info.goal !== undefined ? { goal: info.goal } : {}) });
      applyInfo();
    }
    let me = await http.patch<Json>('/auth/me/', { phone: en });
    if (photo && photo.uri !== profile.get().photo) {
      const fd = new FormData();
      const name = photo.fileName || 'photo.jpg';
      if (photo.uri.startsWith('blob:') || photo.uri.startsWith('data:')) {
        const blob = await (await fetch(photo.uri)).blob();
        fd.append('photo', blob, name);
      } else fd.append('photo', { uri: photo.uri, name, type: photo.mimeType || 'image/jpeg' } as unknown as Blob);
      me = await http.patch<Json>('/auth/me/', fd);
    }
    profile.set({ photo: me.photo || null, phone: faDigits(me.phone || '') });
    return true;
  } catch (e) {
    toast(
      'ذخیره نشد',
      e instanceof ApiError && e.fields.phone ? 'شماره را به شکل ۰۹xxxxxxxxx وارد کن.' : e instanceof ApiError && e.fields.birthDate ? 'تاریخ تولد معتبر نیست.' : faError(e),
      'error',
    );
    return false;
  }
}

/* ---------------- nutrition (M40) ---------------- */

/** «۳ عدد سفیده تخم‌مرغ (۹۹g)» for a food-bank item in a unit; «سینه مرغ ۱۵۰ گرم» otherwise. */
export function foodLabel(f: Json): string {
  const g = faDigits(Math.round(f.grams || 0));
  if (f.food && f.unit && f.unit !== 'گرم' && f.quantity != null) return faNumber(f.quantity) + ' ' + f.unit + ' ' + f.name + ' (' + g + 'g)';
  return f.name + ' ' + g + ' گرم';
}

export async function loadNutrition(): Promise<void> {
  const [plan, day] = await Promise.all([http.get<Json>('/nutrition-plans/me/'), http.get<Json>(`/me/nutrition/?date=${iso()}`)]);
  const foods = new Map<number, string>((plan.meals || []).map((m: Json) => [m.id, (m.foods || []).map(foodLabel).join(' · ')]));
  const meals: PlanMeal[] = (day.meals || []).map((m: Json) => ({
    id: m.id,
    meal: m.name,
    time: m.time ? faDigits(String(m.time).slice(0, 5)) : '',
    items: foods.get(m.id) || '',
    k: [Math.round(m.totals.kcal), Math.round(m.totals.protein), Math.round(m.totals.carbs), Math.round(m.totals.fat)] as [number, number, number, number],
  }));
  MEALS.splice(0, MEALS.length, ...meals);
  Object.assign(TARGETS, day.targets);
  const week = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'].map((d) => ({
    day: d,
    meals: (plan.meals || [])
      .filter((m: Json) => !m.days?.length || m.days.includes(d))
      .map((m: Json) => ({
        meal: m.name,
        time: m.time ? faDigits(String(m.time).slice(0, 5)) : '',
        kcal: Math.round(m.totals?.kcal || 0),
        protein: Math.round(m.totals?.protein || 0),
        foods: (m.foods || []).map((f: Json) => ({ name: f.name, grams: Math.round(f.grams || 0), kcal: Math.round(f.totals?.kcal || 0), label: foodLabel(f) })),
      })),
  }));
  nutrition.set({
    st: (day.meals || []).map((m: Json) => m.status as MealStatus),
    water: day.waterL || 0,
    week,
    updated: plan.updatedAt || null,
    supps: (plan.supplements || []).map((x: Json) => ({ name: x.name, dose: x.dose || '', timing: x.timing || '' })),
  });
}

export async function setMealStatus(i: number, st: MealStatus): Promise<void> {
  const prev = nutrition.get().st;
  nutrition.set((s) => ({ st: s.st.map((x, j) => (j === i ? st : x)) }));
  if (!LIVE) return;
  const meal = MEALS[i];
  try {
    if (st === 'unlogged') {
      const rows = await getAll<Json>(`/meal-logs/?from=${iso()}&to=${iso()}`);
      const row = rows.find((r) => r.mealId === meal.id);
      if (row) await http.del(`/meal-logs/${row.id}/`);
    } else await http.post('/meal-logs/', { mealId: meal.id, date: iso(), status: st });
  } catch (e) {
    nutrition.set({ st: prev });
    toast('ثبت نشد', faError(e), 'error');
  }
}

let waterTimer: ReturnType<typeof setTimeout> | null = null;
export function setWater(liters: number): void {
  nutrition.set({ water: liters });
  if (!LIVE) return;
  if (waterTimer) clearTimeout(waterTimer);
  waterTimer = setTimeout(() => {
    http.put('/me/water/', { date: iso(), liters }).catch((e) => toast('آب ثبت نشد', faError(e), 'error'));
  }, 600);
}

/* ---------------- recovery (M41) ---------------- */

const REC: Record<RecoveryKey, string> = { q: 'sleepQuality', e: 'energy', t: 'stress', o: 'soreness', f: 'fatigue' };

/** Watch metrics (#54): check key → API field. */
export const WATCH_API: Record<string, string> = { rhr: 'restingHr', hrv: 'hrvMs', sleep_score: 'sleepScore', body_battery: 'bodyBattery', spo2: 'spo2', steps: 'steps' };

export async function loadRecovery(): Promise<void> {
  const [rows, plan] = await Promise.all([getAll<Json>(`/recovery/?from=${iso()}&to=${iso()}`), http.get<Json>('/recovery-plans/me/').catch(() => null)]);
  const info = plan
    ? {
        sleepHours: plan.sleepHours,
        waterL: plan.waterL,
        stretchMin: plan.stretchMin,
        restDays: plan.restDays || [],
        checks: plan.checks || [],
        customFields: plan.customFields || [],
      }
    : null;
  const r = rows[0];
  if (!r) return recovery.set({ plan: info, saved: false, sleep: 7, v: { q: null, e: null, t: null, o: null, f: null }, watch: {}, extra: {} });
  recovery.set({
    plan: info,
    saved: true,
    sleep: r.sleepHours ?? 7,
    v: Object.fromEntries((Object.keys(REC) as RecoveryKey[]).map((k) => [k, r[REC[k]] ?? null])) as Record<RecoveryKey, number | null>,
    watch: Object.fromEntries(Object.entries(WATCH_API).map(([k, f]) => [k, r[f] != null ? String(r[f]) : ''])),
    extra: r.extra || {},
  });
}

export async function saveRecovery(): Promise<boolean> {
  if (!LIVE) {
    recovery.set({ saved: true });
    return true;
  }
  const s = recovery.get();
  try {
    const num = (t: string | undefined) => {
      const n = Number(String(t ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
      return t && String(t).trim() && Number.isFinite(n) ? Math.round(n) : null;
    };
    await http.post('/recovery/', {
      date: iso(),
      sleepHours: s.sleep,
      ...Object.fromEntries((Object.keys(REC) as RecoveryKey[]).map((k) => [REC[k], s.v[k]])),
      ...Object.fromEntries(Object.entries(WATCH_API).map(([k, f]) => [f, num(s.watch[k])])),
      extra: s.extra,
    });
    recovery.set({ saved: true });
    return true;
  } catch (e) {
    toast('چک‌این ذخیره نشد', faError(e), 'error');
    return false;
  }
}

/* ---------------- measurements (M42) ---------------- */

const METRIC_API: Record<MetricKey, string> = {
  h: 'height',
  w: 'weight',
  f: 'bodyFat',
  m: 'muscleMass',
  ch: 'chest',
  wa: 'waist',
  ar: 'arm',
  th: 'thigh',
  hi: 'hip',
  ca: 'calf',
  ne: 'neck',
};
const METRIC_KEY = Object.fromEntries(Object.entries(METRIC_API).map(([k, v]) => [v, k])) as Record<string, MetricKey>;

export async function loadMeasures(): Promise<void> {
  const rows = await getAll<Json>('/measurements/?ordering=-date');
  const byDate = new Map<string, MeasureEntry>();
  const latest: Partial<Record<MetricKey, number>> = {};
  for (const r of rows) {
    const k = METRIC_KEY[r.metric];
    if (!k) continue;
    if (latest[k] == null) latest[k] = r.value;
    const e: MeasureEntry = byDate.get(r.date) || { date: faDay(r.date), iso: r.date, by: r.recordedBy === 'coach' ? 'c' : 'a', v: {}, n: 0 };
    if (e.v[k] == null) {
      e.v[k] = r.value;
      e.n++;
    }
    byDate.set(r.date, e);
  }
  MEASURE_HISTORY.splice(0, MEASURE_HISTORY.length, ...[...byDate.values()].sort((a, b) => (b.iso || '').localeCompare(a.iso || '')));
  METRICS.forEach((m) => {
    if (latest[m[0]] != null) m[3] = latest[m[0]] as number;
  });
  measures.set({ extra: [] });
}

export async function addMeasurements(v: Partial<Record<MetricKey, number>>): Promise<boolean> {
  const n = Object.keys(v).length;
  if (!n) return false;
  if (!LIVE) {
    measures.set((s) => ({ extra: [{ date: 'امروز', by: 'a', v, n }, ...s.extra] }));
    return true;
  }
  try {
    await http.post('/measurements/batch/', { date: iso(), values: Object.entries(v).map(([k, value]) => ({ metric: METRIC_API[k as MetricKey], value })) });
    await loadMeasures();
    return true;
  } catch (e) {
    toast('ثبت نشد', faError(e), 'error');
    return false;
  }
}

/* ---------------- health (M46) ---------------- */

const HEALTH: Record<HealthKey, string> = { cond: 'conditions', inj: 'injuries', med: 'medications', alg: 'allergies', res: 'limitations', hist: 'history', note: 'note' };

export async function loadHealth(): Promise<void> {
  const h = await http.get<Json>('/me/health/');
  health.set({
    v: Object.fromEntries((Object.keys(HEALTH) as HealthKey[]).map((k) => [k, h[HEALTH[k]] || ''])) as Record<HealthKey, string>,
    updated: h.updatedAt ? faDay(String(h.updatedAt).slice(0, 10)) : '',
  });
}

export async function saveHealth(v: Partial<Record<HealthKey, string>>): Promise<boolean> {
  const next = { ...health.get().v, ...v };
  if (!LIVE) {
    health.set({ v: next, updated: 'امروز' });
    return true;
  }
  try {
    await http.put('/me/health/', Object.fromEntries((Object.keys(HEALTH) as HealthKey[]).map((k) => [HEALTH[k], next[k] || ''])));
    health.set({ v: next, updated: 'امروز' });
    return true;
  } catch (e) {
    toast('ذخیره نشد', faError(e), 'error');
    return false;
  }
}

/* ---------------- chat (M47) ---------------- */

interface ChatMessage {
  id: number;
  sender: 'coach' | 'athlete';
  text: string;
  attachment: string | null;
  voiceSec?: number | null;
  ref: string;
  createdAt: string;
  readAt: string | null;
  editedAt?: string | null;
  deleted?: boolean;
}
let chatRaw: ChatMessage[] = [];
export const chatMeta = createStore<{ unread: number; typing: boolean; lastRead: boolean }>('chat-meta', { unread: 0, typing: false, lastRead: false }, { persist: false });

function dayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'امروز';
  if (d.toDateString() === y.toDateString()) return 'دیروز';
  return faDay(iso(d));
}

function renderChat() {
  const msgs: ChatItem[] = [];
  let day = '';
  for (const m of chatRaw) {
    const d = dayLabel(m.createdAt);
    if (d !== day) msgs.push({ d: (day = d) });
    msgs.push({
      from: m.sender === 'coach' ? 'c' : 'a',
      t: m.text,
      at: faTime(new Date(m.createdAt)),
      id: m.id,
      ...(m.editedAt ? { edited: true } : {}),
      ...(m.deleted ? { deleted: true } : {}),
      ...(m.attachment && m.voiceSec != null ? { voice: { uri: m.attachment, sec: m.voiceSec } } : m.attachment ? { file: m.attachment } : {}),
      ...(m.ref ? { ref: m.ref.replace(/^session:/, '') } : {}),
    });
  }
  chat.set({ msgs });
  const lastMine = [...chatRaw].reverse().find((m) => m.sender === 'athlete');
  chatMeta.set({ unread: chatRaw.filter((m) => m.sender === 'coach' && !m.readAt).length, lastRead: !!lastMine?.readAt });
}

export async function loadChat(): Promise<void> {
  chatRaw = await http.get<ChatMessage[]>('/messages/');
  renderChat();
}

/** New message from the socket (or our own send): add once, in order. */
export function receiveMessage(m: ChatMessage): void {
  if (chatRaw.some((x) => x.id === m.id)) return;
  chatRaw = [...chatRaw, m].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  if (m.sender === 'coach') chatMeta.set({ typing: false });
  renderChat();
}

/** A message was edited or deleted (socket, or our own change). */
export function receiveUpdate(m: ChatMessage): void {
  chatRaw = chatRaw.map((x) => (x.id === m.id ? m : x));
  renderChat();
}

/** Edit your own message's text (#59). */
export async function editChat(id: number, text: string): Promise<boolean> {
  try {
    receiveUpdate(await http.patch<ChatMessage>(`/messages/${id}/`, { text }));
    return true;
  } catch (e) {
    toast('ویرایش نشد', faError(e), 'error');
    return false;
  }
}

/** Delete your own message for both sides (#59). */
export async function deleteChat(id: number): Promise<boolean> {
  try {
    receiveUpdate(await http.del<ChatMessage>(`/messages/${id}/`));
    return true;
  } catch (e) {
    toast('حذف نشد', faError(e), 'error');
    return false;
  }
}

export function receiveRead(reader: 'coach' | 'athlete', at: string): void {
  if (reader !== 'coach') return;
  chatRaw = chatRaw.map((m) => (m.sender === 'athlete' && !m.readAt ? { ...m, readAt: at } : m));
  renderChat();
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
export function receiveTyping(): void {
  chatMeta.set({ typing: true });
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => chatMeta.set({ typing: false }), 4000);
}

export async function markChatRead(): Promise<void> {
  if (!LIVE || !chatRaw.some((m) => m.sender === 'coach' && !m.readAt)) return;
  const now = new Date().toISOString();
  chatRaw = chatRaw.map((m) => (m.sender === 'coach' && !m.readAt ? { ...m, readAt: now } : m));
  renderChat();
  await http.post('/messages/read/').catch(() => {});
}

/** Send a voice message (recorded in the chat composer). */
export async function sendVoice(r: { uri: string; sec: number; name: string; mime: string }): Promise<boolean> {
  if (!LIVE) return true;
  try {
    const fd = new FormData();
    fd.append('text', '');
    fd.append('voiceSec', String(Math.round(r.sec * 10) / 10));
    if (r.uri.startsWith('blob:') || r.uri.startsWith('data:')) fd.append('attachment', await (await fetch(r.uri)).blob(), r.name);
    else fd.append('attachment', { uri: r.uri, name: r.name, type: r.mime } as unknown as Blob);
    receiveMessage(await http.post<ChatMessage>('/messages/', fd));
    return true;
  } catch (e) {
    toast('پیام صوتی ارسال نشد', faError(e), 'error');
    return false;
  }
}

/** Send a message (optionally an image or a reference to today's session). */
export async function sendChat(
  text: string,
  opts: { image?: { uri: string; mimeType?: string; fileName?: string | null; type?: string | null }; ref?: string } = {},
): Promise<boolean> {
  if (!LIVE) return true;
  try {
    let m: ChatMessage;
    if (opts.image) {
      const fd = new FormData();
      fd.append('text', text);
      if (opts.ref) fd.append('ref', 'session:' + opts.ref);
      // A picked photo or video (#82); the name's extension is what the server checks.
      const video = opts.image.type === 'video' || !!opts.image.mimeType?.startsWith('video/');
      const name = opts.image.fileName || (video ? 'video.mp4' : 'photo.jpg');
      if (opts.image.uri.startsWith('blob:') || opts.image.uri.startsWith('data:')) fd.append('attachment', await (await fetch(opts.image.uri)).blob(), name);
      else fd.append('attachment', { uri: opts.image.uri, name, type: opts.image.mimeType || (video ? 'video/mp4' : 'image/jpeg') } as unknown as Blob);
      m = await http.post<ChatMessage>('/messages/', fd);
    } else m = await http.post<ChatMessage>('/messages/', { text, ref: opts.ref ? 'session:' + opts.ref : '' });
    receiveMessage(m);
    return true;
  } catch (e) {
    toast('پیام ارسال نشد', faError(e), 'error');
    return false;
  }
}

/* ---------------- coach broadcast groups (#81) ---------------- */

/** A group the coach added us to: they post, we read. */
export interface ChatGroup {
  id: number;
  name: string;
  memberCount: number;
  coachName: string;
  lastText: string;
  lastAt: string | null;
  unread: number;
}
export interface GroupPost {
  id: number;
  groupId: number;
  text: string;
  attachment: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}

export const groups = createStore<{ list: ChatGroup[]; unread: number }>('chat-groups', { list: [], unread: 0 }, { persist: false });
/** Posts of the group that's open on screen. */
export const groupPosts = createStore<{ id: number | null; posts: GroupPost[]; loaded: boolean }>('group-posts', { id: null, posts: [], loaded: false }, { persist: false });

export async function loadGroups(): Promise<void> {
  if (!LIVE) return;
  const list = await http.get<ChatGroup[]>('/chat-groups/');
  groups.set({ list, unread: list.reduce((a, g) => a + (g.unread || 0), 0) });
}

export async function openGroup(id: number): Promise<void> {
  if (groupPosts.get().id !== id) groupPosts.set({ id, posts: [], loaded: false });
  const posts = await http.get<GroupPost[]>(`/chat-groups/${id}/messages/`);
  if (groupPosts.get().id === id) groupPosts.set({ posts, loaded: true });
  await markGroupRead(id);
}

export async function markGroupRead(id: number): Promise<void> {
  const g = groups.get().list.find((x) => x.id === id);
  if (!g?.unread) return;
  await http.post(`/chat-groups/${id}/read/`, {});
  const list = groups.get().list.map((x) => (x.id === id ? { ...x, unread: 0 } : x));
  groups.set({ list, unread: list.reduce((a, x) => a + (x.unread || 0), 0) });
}

/** A `group` socket event: a new or edited post in the open group, or any change to our groups. */
export function receiveGroupEvent(groupId: number, post?: GroupPost): void {
  const open = groupPosts.get();
  if (post && open.id === groupId) {
    const posts = open.posts.some((x) => x.id === post.id) ? open.posts.map((x) => (x.id === post.id ? post : x)) : [...open.posts, post];
    groupPosts.set({ posts });
  }
  void loadGroups()
    .then(() => (open.id === groupId && post ? markGroupRead(groupId) : undefined))
    .catch(() => {});
}

/* ---------------- records & progress (M43, M44) ---------------- */

export async function loadRecords(): Promise<void> {
  const [prs, tests] = await Promise.all([getAll<Json>('/records/?ordering=-date'), getAll<Json>('/test-results/?ordering=-date')]);
  const rows: Json[] = prs.map((r) => ({
    ex: r.exerciseName,
    type: /^\d+RM$/.test(r.type) ? 'حداکثر ' + faDigits(parseInt(r.type, 10)) + ' تکرار' : r.type,
    date: faDay(r.date),
    iso: r.date,
    v: r.value,
    p: r.previous,
    u: r.unit,
    d: r.previous ? Math.round(((r.value - r.previous) / r.previous) * 1000) / 10 : 0,
    c: 'str',
    isNew: Date.now() - Date.parse(r.date) < 7 * 86400000,
  }));
  const best = new Map<number, Json[]>();
  tests.forEach((t) => best.set(t.testId, [...(best.get(t.testId) || []), t]));
  best.forEach((list) => {
    const lower = list[0].better === 'lower';
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let top = sorted[0];
    let prev: Json | null = null;
    sorted.slice(1).forEach((x) => {
      if (lower ? x.value < top.value : x.value > top.value) {
        prev = top;
        top = x;
      }
    });
    const p = prev as Json | null;
    rows.push({
      ex: top.testName,
      type: lower ? 'بهترین زمان' : 'بهترین نتیجه',
      date: faDay(top.date),
      iso: top.date,
      v: top.value,
      p: p ? p.value : null,
      u: top.unit,
      d: p ? Math.round(((top.value - p.value) / p.value) * 1000) / 10 : 0,
      c: lower ? 'spd' : 'pow',
      lower,
      isNew: Date.now() - Date.parse(top.date) < 7 * 86400000,
    });
  });
  records.set({ list: rows.sort((a, b) => b.iso.localeCompare(a.iso)), loaded: true });
}

export async function loadProgress(days = progress.get().days): Promise<void> {
  progress.set({ days });
  progress.set({ data: await http.get<Json>(`/me/progress/?days=${days}`) });
}
