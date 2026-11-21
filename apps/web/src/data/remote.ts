/**
 * The data layer over HTTP (live mode). `remoteApi` has the same shape as the mock `mockApi`, so the
 * screens already on the data layer work unchanged; `remote` holds the calls that only exist live
 * (dashboards, chat, health, nutrition plans, 2FA…). Ids are strings in the UI (`types.ts`) and
 * numbers on the wire — the adapters below convert.
 */
import { changed } from './store';
import { getAll, http } from './http';
import { currentUser } from './session';
import type { AccountStatus, Admin, AdminRole, Athlete, Coach, Exercise, ID, LinkResult, LinkSubject, NewAthlete, NewCoach, Program, ProgramWeek } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const str = (v: unknown): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v));

export function toCoach(c: Json): Coach {
  return {
    id: String(c.id),
    userId: str(c.userId),
    name: c.name,
    email: c.username ?? c.email,
    status: c.status,
    branding: { ...c.branding, logoUrl: str(c.branding?.logoUrl), theme: str(c.branding?.theme) },
    sport: c.sport,
    athleteCap: c.athleteCap ?? null,
    athleteCount: c.athleteCount ?? null,
    validity:
      c.validity.kind === 'unlimited' ? { kind: 'unlimited' } : { kind: 'limited', days: c.validity.days, ...(c.validity.expiresAt ? { expiresAt: c.validity.expiresAt } : {}) },
    reminderDays: c.reminderDays,
    cadence: c.cadence,
    customTests: (c.customTests || []).map((t: Json) => ({ ...t, id: String(t.id) })),
    lastLoginAt: str(c.lastLoginAt),
    hasAccount: c.hasAccount ?? true,
    createdAt: c.createdAt,
  };
}

export function toAthlete(a: Json): Athlete {
  return {
    id: String(a.id),
    coachId: String(a.coachId),
    coachName: a.coachName,
    userId: str(a.userId),
    name: a.name,
    email: str(a.email),
    phone: str(a.phone),
    status: a.status,
    goal: str(a.goal) as Athlete['goal'],
    gender: str(a.gender) as Athlete['gender'],
    birthDate: str(a.birthDate),
    sport: str(a.sport),
    heightCm: a.heightCm ?? undefined,
    programId: str(a.programId),
    programName: str(a.programName),
    programWeek: a.programWeek ?? undefined,
    customized: a.customized,
    stats: a.stats,
    lastActiveAt: str(a.lastActiveAt),
    maxHr: a.maxHr ?? null,
    createdAt: str(a.createdAt),
  };
}

export function toAdmin(a: Json): Admin {
  return { id: String(a.id), name: a.name, email: a.email, role: a.role, twoFactor: a.twoFactor, pending: a.pending, invitedAt: str(a.invitedAt), lastLoginAt: str(a.lastLoginAt) };
}

export function toExercise(e: Json): Exercise {
  return {
    id: String(e.id),
    name: e.name,
    cat: e.cat,
    equip: e.equip,
    diff: e.diff,
    video: !!e.hasVideo,
    videoSrc: str(e.videoSrc),
    imageSrc: str(e.imageSrc),
    hasOwnImage: !!e.hasOwnImage,
    dur: str(e.dur),
    metrics: e.metrics || [],
    used: e.used ?? 0,
    sport: str(e.sport),
    measure: str(e.measure),
    unit: str(e.unit),
    description: str(e.description),
    cues: e.cues || [],
    imageStartSrc: e.imageStartSrc ?? null,
    steps: e.steps || [],
    musclesPrimary: e.musclesPrimary || [],
    musclesSecondary: e.musclesSecondary || [],
    issues: e.issues || [],
    badge: e.badge || '',
    illustrationMatch: e.illustrationMatch || '',
    libraryKey: e.libraryKey || '',
    alternatives: e.alternatives || {},
  };
}

let slotSeq = 0;
function toWeeks(weeks: Json[] | undefined): ProgramWeek[] | undefined {
  return weeks?.map((w) => ({
    index: w.index,
    days: w.days.map((d: Json) => ({
      weekday: d.weekday,
      focus: d.focus || undefined,
      time: d.time || '',
      rest: !!d.rest,
      exercises: (d.exercises || []).map((x: Json) => ({
        id: x.id || 's' + ++slotSeq,
        exerciseId: String(x.exerciseId),
        note: x.note || undefined,
        time: x.time || '',
        sets: x.sets,
      })),
    })),
  }));
}

/** UI program tree → wire format (numeric exercise ids). */
export function fromWeeks(weeks: ProgramWeek[]): Json[] {
  return weeks.map((w) => ({
    index: w.index,
    days: w.days.map((d) => ({
      weekday: d.weekday,
      focus: d.focus || '',
      time: d.time || '',
      rest: d.rest,
      exercises: d.exercises.map((x) => ({ id: x.id, exerciseId: Number(x.exerciseId), note: x.note || '', time: x.time || '', sets: x.sets })),
    })),
  }));
}

export function toProgram(p: Json): Program & { athleteName?: string; assignedCount?: number; description?: string } {
  return {
    id: String(p.id),
    coachId: String(p.coachId),
    name: p.name,
    goal: str(p.goal),
    sport: str(p.sport),
    time: p.time || '',
    description: str(p.description),
    kind: p.kind,
    templateId: str(p.templateId),
    athleteId: str(p.athleteId),
    athleteName: str(p.athleteName),
    assignedCount: p.assignedCount ?? undefined,
    version: p.version,
    durationWeeks: p.durationWeeks,
    sessionsPerWeek: p.sessionsPerWeek,
    weeks: toWeeks(p.weeks),
    updatedAt: p.updatedAt,
    active: !!p.active,
    main: !!p.main,
    startDate: str(p.startDate),
  };
}

function mutate<T>(p: Promise<T>): Promise<T> {
  return p.then((r) => {
    changed();
    return r;
  });
}

export interface TeamCoach {
  id: number;
  name: string;
  username: string;
  phone: string;
  status: string;
  athleteCount: number;
  lastLoginAt: string | null;
}

export const remoteApi = {
  coaches: {
    list: async (): Promise<Coach[]> => (await getAll<Json>('/coaches/')).map(toCoach),
    get: async (id: ID): Promise<Coach> => toCoach(await http.get<Json>(`/coaches/${id}/`)),
    async create(input: NewCoach): Promise<Coach> {
      return toCoach(await mutate(http.post<Json>('/coaches/', { ...input })));
    },
    extend: async (id: ID, days: number): Promise<Coach> => toCoach(await mutate(http.post<Json>(`/coaches/${id}/extend/`, { days }))),
    setStatus: async (id: ID, status: AccountStatus): Promise<Coach> => toCoach(await mutate(http.post<Json>(`/coaches/${id}/status/`, { status }))),
    /** Branding / limits. Pass FormData to upload a logo. */
    update: async (id: ID, data: Json | FormData): Promise<Coach> => toCoach(await mutate(http.patch<Json>(`/coaches/${id}/`, data))),
    /** For good, with their athletes and every record and file (#102). */
    remove: async (id: ID): Promise<void> => {
      await mutate(http.del(`/coaches/${id}/`));
    },
  },

  athletes: {
    list: async (filter: { coachId?: ID } = {}): Promise<Athlete[]> =>
      (await getAll<Json>('/athletes/' + (filter.coachId && isAdminFilter() ? `?coach=${filter.coachId}` : ''))).map(toAthlete),
    get: async (id: ID): Promise<Athlete> => toAthlete(await http.get<Json>(`/athletes/${id}/`)),
    async create(input: NewAthlete & { startDate?: string }): Promise<Athlete & { smsStatus?: string }> {
      const { programId, startDate, ...rest } = input;
      const a = await http.post<Json>('/athletes/', rest);
      if (programId) await http.post(`/programs/${programId}/assign/`, { athleteIds: [a.id], ...(startDate ? { startDate } : {}) });
      changed();
      return { ...toAthlete(a), smsStatus: a.smsStatus };
    },
    update: async (id: ID, data: Json): Promise<Athlete> => toAthlete(await mutate(http.patch<Json>(`/athletes/${id}/`, data))),
    setStatus: async (ids: ID[], status: AccountStatus): Promise<void> => {
      await mutate(http.post('/athletes/bulk-status/', { ids: ids.map(Number), status }));
    },
    transfer: async (id: ID, coachId: ID): Promise<void> => {
      await mutate(http.post(`/athletes/${id}/transfer/`, { coachId: Number(coachId) }));
    },
    /** Deletes the athlete with all their data and app account (coach only). */
    remove: async (id: ID): Promise<void> => {
      await mutate(http.del(`/athletes/${id}/`));
    },
  },

  programs: {
    list: async (_filter: { coachId?: ID } = {}): Promise<Program[]> => (isAdminFilter() ? [] : (await getAll<Json>('/programs/?archived=false')).map(toProgram)),
    get: async (id: ID): Promise<Program | undefined> => toProgram(await http.get<Json>(`/programs/${id}/`)),
    create: async (p: { name: string; goal?: string; description?: string; durationWeeks: number; sessionsPerWeek: number; weeks?: ProgramWeek[]; forAthlete?: ID }) =>
      toProgram(await mutate(http.post<Json>('/programs/', { ...p, forAthlete: p.forAthlete ? Number(p.forAthlete) : undefined, weeks: p.weeks ? fromWeeks(p.weeks) : [] }))),
    update: async (id: ID, p: Partial<{ name: string; goal: string; description: string; durationWeeks: number; sessionsPerWeek: number; weeks: ProgramWeek[] }>) =>
      toProgram(await mutate(http.patch<Json>(`/programs/${id}/`, { ...p, ...(p.weeks ? { weeks: fromWeeks(p.weeks) } : {}) }))),
    /** `replace: false` runs the program alongside the athletes' other programs (#74). */
    assign: async (id: ID, athleteIds: ID[], startDate?: string, replace = true) =>
      (await mutate(http.post<Json[]>(`/programs/${id}/assign/`, { athleteIds: athleteIds.map(Number), replace, ...(startDate ? { startDate } : {}) }))).map(toProgram),
    /** Start one of an athlete's programs again (e.g. their custom one), replacing or alongside the others. */
    activate: async (id: ID, opts: { replace?: boolean; startDate?: string } = {}) =>
      toProgram(await mutate(http.post<Json>(`/programs/${id}/activate/`, { replace: opts.replace ?? true, ...(opts.startDate ? { startDate: opts.startDate } : {}) }))),
    deactivate: async (id: ID) => toProgram(await mutate(http.post<Json>(`/programs/${id}/deactivate/`))),
    duplicate: async (id: ID) => toProgram(await mutate(http.post<Json>(`/programs/${id}/duplicate/`))),
    archive: async (id: ID): Promise<void> => {
      await mutate(http.del(`/programs/${id}/`));
    },
    /** Deletes for good; workout history stays without the program. */
    remove: async (id: ID): Promise<void> => {
      await mutate(http.del(`/programs/${id}/?permanent=true`));
    },
  },

  admins: {
    list: async (): Promise<Admin[]> => (await getAll<Json>('/admin/admins/')).map(toAdmin),
    invite: async (input: { name: string; email: string; role: AdminRole }): Promise<Admin> => toAdmin(await mutate(http.post<Json>('/admin/admins/', input))),
    setRole: async (id: ID, role: AdminRole): Promise<void> => {
      await mutate(http.patch(`/admin/admins/${id}/`, { role }));
    },
    remove: async (id: ID): Promise<void> => {
      await mutate(http.del(`/admin/admins/${id}/`));
    },
  },

  exercises: {
    list: async (): Promise<Exercise[]> => (await getAll<Json>('/exercises/?ordering=name')).map(toExercise),
    get: async (id: ID): Promise<Exercise> => toExercise(await http.get<Json>(`/exercises/${id}/`)),
    /** Accepts the UI shape; a FormData body uploads the coach's video. */
    async create(ex: Exercise | FormData): Promise<Exercise> {
      const body = ex instanceof FormData ? ex : exerciseBody(ex);
      return toExercise(await mutate(http.post<Json>('/exercises/', body)));
    },
    update: async (id: ID, ex: Partial<Exercise> | FormData): Promise<Exercise> =>
      toExercise(await mutate(http.patch<Json>(`/exercises/${id}/`, ex instanceof FormData ? ex : exerciseBody(ex)))),
    remove: async (id: ID): Promise<void> => {
      await mutate(http.del(`/exercises/${id}/`));
    },
  },

  auth: {
    setPassword: async (userId: ID, password: string, opts: { forceChange: boolean; emailUser: boolean }): Promise<void> => {
      await http.post(`/admin/users/${userId}/password/`, { password, ...opts });
    },
    resetLink: (who: LinkSubject, opts: { send: boolean; email?: string }): Promise<LinkResult> => http.post<LinkResult>(`/admin/users/${who.userId}/reset-link/`, opts),
    inviteLink: (who: LinkSubject, opts: { send: boolean; email?: string }): Promise<LinkResult> =>
      http.post<LinkResult>(who.kind === 'admin' ? `/admin/admins/${who.id}/invite/` : `/${who.kind === 'coach' ? 'coaches' : 'athletes'}/${who.id}/invite/`, opts),
    requestReset: async (email: string): Promise<void> => {
      await http.post('/auth/forgot-password/', { email }, { anonymous: true });
    },
  },
};

function exerciseBody(ex: Partial<Exercise>): Json {
  const {
    id: _id,
    video: _video,
    videoSrc: _src,
    imageSrc: _img,
    hasOwnImage: _own,
    used: _used,
    imageStartSrc: _start,
    badge: _badge,
    illustrationMatch: _match,
    libraryKey: _key,
    alternatives: _alt,
    ...rest
  } = ex;
  return rest;
}

/** Admins list across coaches (filter by coach); coach lists are scoped by the server. */
function isAdminFilter(): boolean {
  return currentUser()?.role === 'admin';
}

/* ---------------------------------------------------------------- live-only calls */

export interface Thread {
  athleteId: number;
  name: string;
  lastAt: string;
  lastText: string;
  lastSender: 'coach' | 'athlete';
  unread: number;
}

export interface ChatMessage {
  id: number;
  athleteId: number;
  sender: 'coach' | 'athlete';
  text: string;
  attachment: string | null;
  /** Voice message length in seconds (the attachment is the recording). */
  voiceSec?: number | null;
  ref: string;
  createdAt: string;
  readAt: string | null;
  status: 'sent' | 'read';
  editedAt?: string | null;
  deleted?: boolean;
}

/** A food in the bank; nutrition per 100 g, units in grams (e.g. «عدد» = 33 g for an egg white). */
export interface NutritionTemplate {
  id: number;
  name: string;
  description: string;
  mealCount: number;
  kcal: number;
  coachName: string;
}

export interface BankFood {
  id: number;
  name: string;
  category: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultUnit: string;
  units: Array<{ unit: string; grams: number }>;
  mine: boolean;
}

/** A coach's broadcast group (#81): the coach posts, member athletes read. */
export interface ChatGroup {
  id: number;
  name: string;
  /** Athlete ids (coach only). */
  members?: number[];
  memberCount: number;
  coachName: string;
  createdAt: string;
  lastText: string;
  lastAt: string | null;
  unread: number;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  text: string;
  attachment: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}

/** One signed-in device (sign-in session). */
export interface DeviceSession {
  id: string;
  device: string;
  client: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export const remote = {
  /** Admin activity analytics (online, active users, sections, sign-ins) and one user's. */
  activity: (days: number) => http.get<Json>(`/admin/activity/?days=${days}`),
  userActivity: (id: ID, days: number) => http.get<Json>(`/admin/activity/users/${id}/?days=${days}`),
  /** Signed-in devices: your own, or a user's (admins). */
  sessions: (userId?: ID) => http.get<DeviceSession[]>(userId ? `/admin/users/${userId}/sessions/` : '/auth/sessions/'),
  endSession: (id: string, userId?: ID) => mutate(http.del(userId ? `/admin/users/${userId}/sessions/${id}/` : `/auth/sessions/${id}/`)),
  /** Admins: every device of the user. Yourself: every device but this one. */
  endOtherSessions: (userId?: ID) => mutate(http.post(userId ? `/admin/users/${userId}/sessions/` : '/auth/sessions/end-others/')),
  allPrograms: async () => (await getAll<Json>('/programs/')).map((p) => ({ ...toProgram(p), archived: !!p.archived, exerciseCount: p.exerciseCount ?? 0 })),
  programCopies: (id: ID) => http.get<Json[]>(`/programs/${id}/copies/`),
  pushProgramUpdate: (id: ID, copyIds: number[]) => mutate(http.post<{ updated: number }>(`/programs/${id}/push-update/`, { copyIds })),
  restoreProgram: (id: ID) => mutate(http.patch<Json>(`/programs/${id}/`, { archived: false })),
  adminStats: () => http.get<Json>('/admin/stats/'),
  coachSummary: (id: ID) => http.get<Json>(`/coaches/${id}/summary/`),
  platformSettings: () => http.get<Json>('/admin/settings/'),
  savePlatformSettings: (data: Json) => mutate(http.patch<Json>('/admin/settings/', data)),
  resetTwoFactor: (userId: ID) => mutate(http.post(`/admin/users/${userId}/2fa-reset/`)),
  /** Correct a logged session's duration, RPE, heart rate and cardio details (coach or the athlete). */
  updateSessionMetrics: (logId: ID, data: Json) => mutate(http.patch<Json>(`/workouts/${logId}/metrics/`, data)),
  auditEvents: () => http.get<{ results: Json[] }>('/admin/audit-events/?page_size=50').then((p) => p.results),
  /** Newest first: events about one record (`targetType` is the model name, e.g. `coach`, `user`). */
  auditEventsFor: (targetType: string, targetId: ID) =>
    http.get<{ results: Json[] }>(`/admin/audit-events/?page_size=50&ordering=-at&target_type=${targetType}&target_id=${targetId}`).then((p) => p.results),

  coachDashboard: () => http.get<Json>('/coach/dashboard/'),
  requestRenewal: () => http.post('/coach/renewal-request/'),
  coachProfile: () => http.get<Json>('/coach/profile/'),
  saveCoachProfile: (data: Json) => mutate(http.patch<Json>('/coach/profile/', data)),
  tests: () => http.get<Json[]>('/tests/'),
  addTest: (t: { name: string; unit: string; better: 'higher' | 'lower'; category?: string; protocol?: string }) => mutate(http.post<Json>('/tests/', t)),
  updateTest: (id: number, t: Json) => mutate(http.patch<Json>(`/tests/${id}/`, t)),
  removeTest: (id: number) => mutate(http.del(`/tests/${id}/`)),
  documents: () => http.get<Json[]>('/coach/documents/'),
  uploadDocument: (kind: 'resume' | 'certificate', file: File) => {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    return mutate(http.post<Json>('/coach/documents/', fd));
  },
  deleteDocument: (id: number) => mutate(http.del(`/coach/documents/${id}/`)),

  athleteCalendar: (athleteId: ID, from: string, to: string) => http.get<Json[]>(`/athletes/${athleteId}/calendar/?from=${from}&to=${to}`),
  athleteOverview: (athleteId: ID) => http.get<Json>(`/athletes/${athleteId}/overview/`),
  notes: (athleteId: ID) => http.get<Json[]>(`/athletes/${athleteId}/notes/`),
  addNote: (athleteId: ID, text: string) => mutate(http.post<Json>(`/athletes/${athleteId}/notes/`, { text })),
  health: (athleteId: ID) => http.get<Json>(`/athletes/${athleteId}/health/`),
  saveHealth: (athleteId: ID, data: Json) => mutate(http.put<Json>(`/athletes/${athleteId}/health/`, data)),
  measurements: (athleteId: ID) => getAll<Json>(`/measurements/?athlete=${athleteId}&ordering=date`),
  latestMeasurements: (athleteId: ID) => http.get<Json[]>(`/measurements/latest/?athlete=${athleteId}`),
  addMeasurements: (athleteId: ID, date: string, values: Array<{ metric: string; value: number }>) =>
    mutate(http.post<Json>('/measurements/batch/', { athlete: Number(athleteId), date, values })),
  addMeasurement: (athleteId: ID, metric: string, value: number, date: string) => mutate(http.post<Json>('/measurements/', { athlete: Number(athleteId), metric, value, date })),
  workouts: (athleteId?: ID, range: { from?: string; to?: string } = {}) =>
    getAll<Json>(`/workouts/?ordering=-date${athleteId ? `&athlete=${athleteId}` : ''}${range.from ? `&from=${range.from}` : ''}${range.to ? `&to=${range.to}` : ''}`),
  /** The latest `n` sessions and the total count (one page, no paging through the whole history). */
  recentWorkouts: (athleteId: ID, n: number) => http.get<{ count: number; results: Json[] }>(`/workouts/?ordering=-date&athlete=${athleteId}&page_size=${n}`),
  feedback: (workoutId: number, text: string) => mutate(http.post<Json>(`/workouts/${workoutId}/feedback/`, { text })),
  records: (athleteId?: ID) => getAll<Json>(`/records/${athleteId ? `?athlete=${athleteId}` : ''}`),
  /** A tested max the coach records by hand (e.g. type `1RM`, kg). */
  addRecord: (athleteId: ID, r: { exerciseId: number; type: string; value: number; date: string }) =>
    mutate(http.post<Json>('/records/', { athlete: Number(athleteId), unit: 'kg', ...r })),
  deleteRecord: (id: number) => mutate(http.del(`/records/${id}/`)),
  exercisePrograms: (exerciseId: ID) => http.get<Json[]>(`/exercises/${exerciseId}/programs/`),
  exerciseRecords: (exerciseId: ID) => getAll<Json>(`/records/?exercise=${exerciseId}&ordering=-value`),
  recovery: (athleteId: ID) => getAll<Json>(`/recovery/?athlete=${athleteId}`),
  testResults: (athleteId?: ID) => getAll<Json>(`/test-results/${athleteId ? `?athlete=${athleteId}` : ''}`),
  nutritionPlan: (athleteId: ID) => http.get<Json>(`/nutrition-plans/${athleteId}/`),
  saveNutritionPlan: (athleteId: ID, plan: Json) => mutate(http.put<Json>(`/nutrition-plans/${athleteId}/`, plan)),
  /** Food bank: shared Persian foods + the coach's own (with household units). */
  foods: (q: string) => http.get<BankFood[]>(`/foods/?q=${encodeURIComponent(q)}`),
  foodsByCategory: (category: string) => http.get<BankFood[]>(`/foods/?category=${encodeURIComponent(category)}`),
  foodCategories: () => http.get<Array<{ category: string; count: number }>>('/foods/categories/'),
  nutritionTemplates: () => http.get<NutritionTemplate[]>('/nutrition-templates/'),
  saveNutritionTemplate: (body: { name: string; athlete: ID; description?: string }) => mutate(http.post<NutritionTemplate>('/nutrition-templates/', body)),
  deleteNutritionTemplate: (id: ID) => mutate(http.del(`/nutrition-templates/${id}/`)),
  assignNutritionTemplate: (id: ID, athleteIds: ID[]) => mutate(http.post(`/nutrition-templates/${id}/assign/`, { athleteIds })),
  createFood: (food: Omit<BankFood, 'id' | 'mine'>) => http.post<BankFood>('/foods/', food),
  /** The athlete's weekly program (training, nutrition, supplements, recovery) as a PDF. */
  programPdf: (athleteId: ID) => http.get<Blob>(`/athletes/${athleteId}/program.pdf`, { blob: true }),
  /** SMS the athlete a link to their program PDF; a new name + phone is saved as a contact. */
  sendProgramSms: (b: { athlete?: number; name?: string; phone: string }) => http.post<{ athleteId: number; url: string; smsSent: boolean }>('/program-pdf/send-sms/', b),
  /** Head coach: the coaches under them. */
  attendance: (date: string) => http.get<Json>(`/attendance/?date=${date}`),
  setAttendance: (body: Json) => mutate(http.post<Json>('/attendance/', body)),
  workout: (id: ID) => http.get<Json>(`/workouts/${id}/`),
  patchSet: (id: ID, body: Json) => mutate(http.patch<Json>(`/sets/${id}/`, body)),
  team: () => http.get<TeamCoach[]>('/coach/team/'),
  createTeamCoach: (b: { name: string; username: string; password: string; phone?: string }) => http.post<TeamCoach>('/coach/team/', b),
  setTeamStatus: (id: number, status: 'active' | 'inactive') => http.post<TeamCoach>(`/coach/team/${id}/set_status/`, { status }),
  mealLogs: (athleteId: ID, from?: string) => getAll<Json>(`/meal-logs/?athlete=${athleteId}${from ? `&from=${from}` : ''}`),
  waterLogs: (athleteId: ID, from?: string) => getAll<Json>(`/water-logs/?athlete=${athleteId}${from ? `&from=${from}` : ''}`),

  /** C26–C30: `overview` · `strength` · `endurance` · `body` · `recovery` for one athlete. */
  analytics: (athleteId: ID, section: 'overview' | 'strength' | 'endurance' | 'body' | 'recovery' | 'performance' | 'trends', days?: number) =>
    http.get<Json>(`/athletes/${athleteId}/analytics/?section=${section}${days ? '&days=' + days : ''}`),
  recoveryPlan: (athleteId: ID) => http.get<Json>(`/recovery-plans/${athleteId}/`),
  saveRecoveryPlan: (athleteId: ID, plan: Json) => mutate(http.put<Json>(`/recovery-plans/${athleteId}/`, plan)),
  addTestResult: (athleteId: ID, testId: number, value: number, date: string, note = '') =>
    mutate(http.post<Json>('/test-results/', { athlete: Number(athleteId), testId, value, date, note })),

  threads: () => http.get<Thread[]>('/coach/threads/'),
  messages: (athleteId: ID, after?: number) => http.get<ChatMessage[]>(`/messages/?athlete=${athleteId}${after ? `&after=${after}` : ''}`),
  sendMessage: (athleteId: ID, text: string, opts: { file?: File; ref?: string; voice?: { blob: Blob; sec: number; ext: string } } = {}) => {
    if (!opts.file && !opts.voice) return http.post<ChatMessage>('/messages/', { athlete: Number(athleteId), text, ref: opts.ref || '' });
    const fd = new FormData();
    fd.append('athlete', String(athleteId));
    fd.append('text', text);
    fd.append('ref', opts.ref || '');
    if (opts.voice) {
      fd.append('attachment', opts.voice.blob, 'voice.' + opts.voice.ext);
      fd.append('voiceSec', String(Math.round(opts.voice.sec * 10) / 10));
    } else if (opts.file) fd.append('attachment', opts.file);
    return http.post<ChatMessage>('/messages/', fd);
  },
  editMessage: (id: number, text: string) => http.patch<ChatMessage>(`/messages/${id}/`, { text }),
  deleteMessage: (id: number) => http.del<ChatMessage>(`/messages/${id}/`),
  markRead: (athleteId: ID) => http.post('/messages/read/', { athlete: Number(athleteId) }),
  groups: () => http.get<ChatGroup[]>('/chat-groups/'),
  saveGroup: (id: number | null, data: { name: string; members: number[] }) =>
    id ? http.patch<ChatGroup>(`/chat-groups/${id}/`, data) : http.post<ChatGroup>('/chat-groups/', data),
  deleteGroup: (id: number) => http.del(`/chat-groups/${id}/`),
  groupMessages: (id: number) => http.get<GroupMessage[]>(`/chat-groups/${id}/messages/`),
  postToGroup: (id: number, text: string, file?: File) => {
    if (!file) return http.post<GroupMessage>(`/chat-groups/${id}/messages/`, { text });
    const fd = new FormData();
    fd.append('text', text);
    fd.append('attachment', file);
    return http.post<GroupMessage>(`/chat-groups/${id}/messages/`, fd);
  },
  editGroupMessage: (id: number, mid: number, text: string) => http.patch<GroupMessage>(`/chat-groups/${id}/messages/${mid}/`, { text }),
  deleteGroupMessage: (id: number, mid: number) => http.del<GroupMessage>(`/chat-groups/${id}/messages/${mid}/`),

  me: () => http.get<Json>('/auth/me/'),
  updateMe: (data: Json | FormData) => http.patch<Json>('/auth/me/', data),
  smsSettings: () => http.get<Json>('/sms-settings/'),
  saveSmsSettings: (data: Json) => http.put<Json>('/sms-settings/', data),
  smsTest: (phone: string) => http.post<Json>('/sms-settings/test/', { phone }),
  changeUsername: (username: string, currentPassword: string) => http.post<Json>('/auth/username/', { username, currentPassword }),
  changePassword: (currentPassword: string, newPassword: string) => http.post<Json>('/auth/password/', { currentPassword, newPassword }),
  mfaStatus: () => http.get<{ enabled: boolean; required: boolean; recoveryCodesLeft: number }>('/auth/2fa/'),
  mfaSetup: () => http.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup/'),
  mfaEnable: (otp: string) => http.post<{ recoveryCodes: string[] }>('/auth/2fa/enable/', { otp }),
  mfaDisable: (password: string, otp: string) => http.post('/auth/2fa/disable/', { password, otp }),
  mfaRecoveryCodes: (otp: string) => http.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes/', { otp }),
  resetPassword: (token: string, password: string) => http.post('/auth/reset-password/', { token, password }, { anonymous: true }),
  invite: (token: string) => http.get<Json>(`/auth/invites/${token}/`, { anonymous: true }),
  acceptInvite: (token: string, password: string) => http.post<Json>(`/auth/invites/${token}/`, { password }, { anonymous: true }),
};
