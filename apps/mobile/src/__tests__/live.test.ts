/**
 * Live mode against a fake API: sign-in, loading the athlete's data into the stores, and the writes
 * screens make. `EXPO_PUBLIC_API_URL` must be set before the app modules load, hence `require`.
 */
process.env.EXPO_PUBLIC_API_URL = 'http://api.test/api';

jest.mock('../api/realtime', () => ({ connectRealtime: jest.fn(), disconnectRealtime: jest.fn(), sendTyping: jest.fn() }));

type Call = { method: string; path: string; body: unknown };
const calls: Call[] = [];
const today = (() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();
const tomorrowIso = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();

const ME = {
  id: 5,
  role: 'athlete',
  name: 'علی رستمی',
  email: 'ali@x.test',
  phone: '09121234567',
  photo: null,
  branding: { appName: 'Northline', initials: 'NL', logoUrl: null, primary: '#000', secondary: '#fff', theme: 'northline' },
};
const ROUTES: Record<string, unknown> = {
  'POST /auth/login/': { access: 'a1', refresh: 'r1', user: ME },
  'GET /auth/me/': ME,
  'GET /me/athlete/': { birthDate: '1998-03-01', heightCm: 181, goal: 'gain', coachName: 'علی احمدی', programName: 'قدرت ۸ هفته', programWeek: 3 },
  'GET /me/today/': {
    program: { id: 1, name: 'قدرت ۸ هفته', durationWeeks: 8 },
    week: 3,
    weekday: 'mon',
    rest: false,
    focus: 'پا',
    exercises: [
      {
        slot: 0,
        exercise: { id: 9, name: 'اسکوات', cat: 'legs', equip: 'barbell', cues: [], videoSrc: null },
        note: 'عمق کامل',
        bestKg: 100,
        sets: [
          { reps: '5', value: 100, restSec: 120, logged: { id: 71, done: true, actualValue: 100, actualReps: '5', isPr: false } },
          { reps: '5', value: 100, restSec: 120, logged: { id: 72, done: false } },
        ],
      },
    ],
    log: { id: 40, status: 'in_progress', finishedAt: null, rpe: null },
  },
  [`GET /me/schedule/?start=${tomorrowIso}&days=1`]: {
    program: { name: 'قدرت ۸ هفته', durationWeeks: 8 },
    days: [{ date: tomorrowIso, weekday: 'sat', week: 3, focus: 'پا', rest: false, exercises: [{ name: 'اسکوات', sets: 4, reps: '6' }] }],
  },
  'GET /notifications/': { unread: 1, results: [{ kind: 'message', at: '2026-09-20T10:00:00Z', coachName: 'علی احمدی', text: 'سلام', value: 1, unread: true }] },
  'GET /nutrition-plans/me/': {
    updatedAt: '2026-09-20T10:00:00Z',
    meals: [
      { id: 3, name: 'صبحانه', time: '07:30:00', days: [], totals: { kcal: 300, protein: 20 }, foods: [{ name: 'تخم‌مرغ', grams: 150, totals: { kcal: 233 } }] },
      { id: 4, name: 'ناهار جمعه', time: null, days: ['fri'], totals: { kcal: 500 }, foods: [] },
    ],
  },
  [`GET /me/nutrition/?date=${today}`]: {
    targets: { kcal: 2400, protein: 150, carbs: 250, fat: 70, waterL: 3 },
    meals: [{ id: 3, name: 'صبحانه', time: '07:30:00', status: 'followed', totals: { kcal: 300, protein: 20, carbs: 10, fat: 20 } }],
    waterL: 1.25,
  },
  [`GET /recovery/?from=${today}&to=${today}&page_size=200`]: { results: [], next: null },
  'GET /measurements/?ordering=-date&page_size=200': {
    results: [
      { metric: 'weight', value: 82, date: '2026-09-20', recordedBy: 'athlete' },
      { metric: 'weight', value: 83, date: '2026-09-13', recordedBy: 'coach' },
    ],
    next: null,
  },
  'GET /me/health/': { conditions: 'آسم', injuries: '', medications: '', allergies: '', limitations: '', history: '', note: '', updatedAt: '2026-09-01T10:00:00Z' },
  'GET /messages/': [{ id: 1, sender: 'coach', text: 'سلام', attachment: null, ref: '', createdAt: '2026-09-20T09:00:00Z', readAt: null }],
  'GET /chat-groups/': [{ id: 5, name: 'تیم صبح', memberCount: 8, coachName: 'علی احمدی', lastText: '🎬 ویدیو', lastAt: '2026-09-21T07:00:00Z', unread: 2 }],
  'GET /chat-groups/5/messages/': [
    { id: 9, groupId: 5, text: '', attachment: 'http://api.test/media/attachments/warmup.mp4', createdAt: '2026-09-21T07:00:00Z', editedAt: null, deleted: false },
  ],
  'POST /chat-groups/5/read/': { updated: 1 },
  'GET /records/?ordering=-date&page_size=200': { results: [{ exerciseName: 'اسکوات', type: '5RM', date: '2026-09-18', value: 100, previous: 95, unit: 'kg' }], next: null },
  'GET /test-results/?ordering=-date&page_size=200': { results: [], next: null },
  'GET /me/progress/?days=180': { adherence: { training: 90, nutrition: 70, recovery: null }, lifts: [] },
  'PATCH /sets/72/': { id: 72, isPr: true },
  'POST /meal-logs/': { id: 1 },
  'POST /recovery/': { id: 1 },
  'POST /measurements/batch/': [],
  'POST /messages/': { id: 2, sender: 'athlete', text: 'ممنون', attachment: null, ref: '', createdAt: '2026-09-21T09:00:00Z', readAt: null },
};

globalThis.fetch = jest.fn(async (url: string, init: { method?: string; body?: string } = {}) => {
  const method = init.method || 'GET';
  const path = url.replace('http://api.test/api', '');
  calls.push({ method, path, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
  const key = method + ' ' + path;
  if (key === 'POST /auth/login/' && (JSON.parse(init.body as string) as { password: string }).password !== 'right')
    return new Response(JSON.stringify({ detail: 'bad', code: 'invalid_credentials' }), { status: 401 });
  if (!(key in ROUTES)) return new Response(JSON.stringify({ detail: 'not found ' + key }), { status: 404 });
  return new Response(JSON.stringify(ROUTES[key]), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as unknown as typeof fetch;

/* eslint-disable @typescript-eslint/no-require-imports */
const auth = require('../api/auth') as typeof import('../api/auth');
const http = require('../api/http') as typeof import('../api/http');
const athlete = require('../data/athlete') as typeof import('../data/athlete');
const live = require('../data/live') as typeof import('../data/live');
const wk = require('../data/workout') as typeof import('../data/workout');
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  calls.length = 0;
});

test('a wrong password shows the Persian error and stays signed out', async () => {
  await expect(auth.signIn('ali@x.test', 'wrong')).rejects.toBeInstanceOf(http.ApiError);
  await auth.signIn('ali@x.test', 'wrong').catch((e) => expect(http.faError(e)).toBe('ایمیل یا رمز عبور درست نیست.'));
  expect(athlete.session.get().signedIn).toBe(false);
});

test('sign-in as athlete applies branding and loads every tab from the API', async () => {
  await auth.signIn('ali@x.test', 'right');
  expect(calls[0]).toMatchObject({ method: 'POST', path: '/auth/login/', body: { email: 'ali@x.test', role: 'athlete' } });
  expect(athlete.session.get().signedIn).toBe(true);
  expect(auth.branding.get()).toMatchObject({ appName: 'Northline', theme: 'northline' });
  await live.loadAll();

  expect(athlete.ATHLETE).toMatchObject({ first: 'علی', coach: 'علی احمدی', program: 'قدرت ۸ هفته', programWeek: 3, goal: 'عضله‌سازی' });
  expect(wk.EXERCISES).toHaveLength(1);
  expect(wk.EXERCISES[0]).toMatchObject({ name: 'اسکوات', sets: 2, w: 100, rest: 120, pr8: 100, cat: 'پا' });
  expect(wk.SESSION).toMatchObject({ title: 'پا', week: 3, day: 3 });
  expect(wk.workout.get()).toMatchObject({ logs: [[[100, 5]]], setIds: [[71, 72]], logId: 40, finished: false, loaded: true });

  expect(athlete.MEALS).toEqual([{ id: 3, meal: 'صبحانه', time: '۰۷:۳۰', items: 'تخم‌مرغ ۱۵۰ گرم', k: [300, 20, 10, 20] }]);
  expect(athlete.TARGETS.kcal).toBe(2400);
  expect(athlete.nutrition.get()).toMatchObject({ st: ['followed'], water: 1.25, updated: '2026-09-20T10:00:00Z' });
  expect(live.tomorrow.get().day).toMatchObject({ focus: 'پا', exercises: [{ name: 'اسکوات' }] });
  // in-app notifications replace push where push isn't available
  expect(live.inbox.get()).toMatchObject({ unread: 1, loaded: true });
  expect(live.inbox.get().items[0]).toMatchObject({ kind: 'message', coachName: 'علی احمدی' });
  // #47: the week preview has each day's own menu
  const week = athlete.nutrition.get().week!;
  expect(week.find((w) => w.day === 'sat')!.meals).toEqual([
    { meal: 'صبحانه', time: '۰۷:۳۰', kcal: 300, protein: 20, foods: [{ name: 'تخم‌مرغ', grams: 150, kcal: 233, label: 'تخم‌مرغ ۱۵۰ گرم' }] },
  ]);
  expect(week.find((w) => w.day === 'fri')!.meals.map((m) => m.meal)).toEqual(['صبحانه', 'ناهار جمعه']);
  expect(athlete.recovery.get().saved).toBe(false);
  expect(athlete.MEASURE_HISTORY.map((e) => [e.iso, e.by, e.v.w])).toEqual([
    ['2026-09-20', 'a', 82],
    ['2026-09-13', 'c', 83],
  ]);
  expect(athlete.health.get().v.cond).toBe('آسم');
  expect(athlete.chat.get().msgs.filter((m) => 'from' in m)).toEqual([expect.objectContaining({ from: 'c', t: 'سلام' })]);
  expect(live.chatMeta.get().unread).toBe(1);
  expect(live.records.get().list[0]).toMatchObject({ ex: 'اسکوات', v: 100, p: 95, d: 5.3 });
  expect(live.progress.get().data?.adherence.training).toBe(90);
});

test('logging a set marks the server set done and keeps its PR flag', async () => {
  wk.logSet(0, [105, 5]);
  await flush();
  await flush();
  expect(calls.find((c) => c.method === 'PATCH')).toEqual({ method: 'PATCH', path: '/sets/72/', body: { done: true, actualValue: 105, actualReps: '5' } });
  expect(wk.stats(wk.workout.get()).prs).toEqual([{ ex: 'اسکوات', w: 105, r: 5, prev: 100 }]);
});

test('writes: meal status, recovery check-in, measurements, chat', async () => {
  await live.setMealStatus(0, 'partial');
  expect(calls.pop()).toMatchObject({ method: 'POST', path: '/meal-logs/', body: { mealId: 3, status: 'partial', date: today } });

  athlete.recovery.set({ sleep: 6.5, v: { q: 7, e: 6, t: 3, o: 8, f: 4 } });
  expect(await live.saveRecovery()).toBe(true);
  expect(calls.pop()).toMatchObject({ body: { date: today, sleepHours: 6.5, sleepQuality: 7, energy: 6, stress: 3, soreness: 8, fatigue: 4 } });

  expect(await live.addMeasurements({ w: 81.5, wa: 84 })).toBe(true);
  expect(calls.find((c) => c.path === '/measurements/batch/')?.body).toEqual({
    date: today,
    values: [
      { metric: 'weight', value: 81.5 },
      { metric: 'waist', value: 84 },
    ],
  });

  expect(await live.sendChat('ممنون')).toBe(true);
  // The socket echo of our own message is ignored (same id).
  live.receiveMessage({ id: 2, sender: 'athlete', text: 'ممنون', attachment: null, ref: '', createdAt: '2026-09-21T09:00:00Z', readAt: null });
  expect(athlete.chat.get().msgs.filter((m) => 'from' in m && m.from === 'a')).toHaveLength(1);
  live.receiveRead('coach', '2026-09-21T10:00:00Z');
  expect(live.chatMeta.get().lastRead).toBe(true);
});

test("#81: the coach's groups load with unread counts; opening one reads it; live posts arrive", async () => {
  await live.loadGroups();
  expect(live.groups.get()).toMatchObject({ unread: 2, list: [{ name: 'تیم صبح', unread: 2 }] });
  await live.openGroup(5);
  expect(live.groupPosts.get()).toMatchObject({ id: 5, loaded: true, posts: [{ id: 9 }] });
  expect(calls.some((c) => c.method === 'POST' && c.path === '/chat-groups/5/read/')).toBe(true);
  expect(live.groups.get().unread).toBe(0);
  live.receiveGroupEvent(5, { id: 10, groupId: 5, text: 'فردا ساعت ۷', attachment: null, createdAt: '2026-09-21T08:00:00Z', editedAt: null, deleted: false });
  expect(live.groupPosts.get().posts.map((p) => p.id)).toEqual([9, 10]);
});

test('food-bank items read as «۳ عدد سفیده تخم‌مرغ (۹۹g)»; grams-only and typed foods as «name N گرم»', () => {
  expect(live.foodLabel({ food: 2, name: 'سفیده تخم‌مرغ', unit: 'عدد', quantity: 3, grams: 99 })).toBe('۳ عدد سفیده تخم‌مرغ (۹۹g)');
  expect(live.foodLabel({ food: 29, name: 'برنج', unit: 'کفگیر', quantity: 1.5, grams: 135 })).toBe('۱٫۵ کفگیر برنج (۱۳۵g)');
  expect(live.foodLabel({ food: 5, name: 'سینه مرغ', unit: 'گرم', quantity: 150, grams: 150 })).toBe('سینه مرغ ۱۵۰ گرم');
  expect(live.foodLabel({ food: null, name: 'قهوه', unit: '', quantity: null, grams: 200 })).toBe('قهوه ۲۰۰ گرم');
});

test('sign-out forgets the tokens', async () => {
  ROUTES['POST /auth/logout/'] = {};
  await auth.signOut();
  expect(athlete.session.get().signedIn).toBe(false);
  expect(calls.some((c) => c.path === '/auth/logout/')).toBe(true);
  await flush();
});
