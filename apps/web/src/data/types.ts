/**
 * Domain model for the indow platform (from the handoff README › State management).
 * These types are the contract between the UI and the (future) backend; the mock API in
 * `./api.ts` returns exactly these shapes. Dates are ISO strings; display formatting
 * (Jalali calendar, Persian digits) happens in the UI.
 */

export type ID = string;
export type ISODate = string;

/* ---------- Identity & access ---------- */

export type AdminRole = 'super' | 'support';

export interface Admin {
  id: ID;
  name: string;
  email: string;
  role: AdminRole;
  twoFactor: boolean;
  /** Invited but not yet accepted. */
  pending: boolean;
  invitedAt?: ISODate;
  lastLoginAt?: ISODate;
}

export type AccountStatus = 'active' | 'inactive' | 'invited' | 'draft' | 'paused';

export interface CoachBranding {
  appName: string;
  initials: string;
  /** Optional uploaded logo (PNG/SVG/JPG/WebP ≤ 2 MB); defaults to initials on the primary color. */
  logoUrl?: string;
  primary: string;
  secondary: string;
  /** Registered white-label theme key used for `data-theme`. */
  theme?: string;
}

export type MeasurementCadence = { kind: 'weekly' } | { kind: 'every-n-weeks'; weeks: number } | { kind: 'monthly' };

export type BetterDirection = 'higher' | 'lower';

/** A performance test defined by the coach (C32) and used in endurance & speed analytics (C28). */
export interface TestDefinition {
  id: ID;
  name: string;
  unit: string;
  better: BetterDirection;
}

/**
 * Account validity. A limited account runs `days` from activation; `expiresAt` is set once the
 * coach activates. At the end date the coach is auto-deactivated (data retained, restored on renewal).
 */
export type Validity = { kind: 'unlimited' } | { kind: 'limited'; days: number; expiresAt?: ISODate };

export interface Coach {
  id: ID;
  /** Login account (for password / reset-link actions). */
  userId?: ID;
  name: string;
  email: string;
  status: AccountStatus;
  branding: CoachBranding;
  sport: string;
  /** Maximum athletes; `null` = unlimited. */
  athleteCap: number | null;
  athleteCount: number | null;
  validity: Validity;
  /** Days before expiry to notify the coach (in-app banner + email). */
  reminderDays: 1 | 2 | 3 | 7;
  cadence: MeasurementCadence;
  customTests: TestDefinition[];
  lastLoginAt?: ISODate;
  /** False until the coach sets a password (accepts the invite); then activation needs no invite. */
  hasAccount?: boolean;
  createdAt: ISODate;
}

export type Goal = 'loss' | 'gain' | 'str' | 'gen';
export type Gender = 'f' | 'm' | 'x';

export interface HealthProfile {
  injuries?: string;
  medications?: string;
  allergies?: string;
  limitations?: string;
}

export interface Athlete {
  id: ID;
  coachId: ID;
  coachName?: string;
  /** Login account; absent until the athlete accepts the invite. */
  userId?: ID;
  programName?: string;
  name: string;
  email?: string;
  phone?: string;
  status: AccountStatus;
  goal?: Goal;
  gender?: Gender;
  birthDate?: ISODate;
  sport?: string;
  /** Height lives with body measurements; kept here as the latest value for convenience. */
  heightCm?: number;
  programId?: ID;
  /** Current week in the assigned program (1-based). */
  programWeek?: number;
  /** The athlete's copy of the program was customized. */
  customized?: boolean;
  stats?: AthleteStats;
  /** Never exposed to admin roles. */
  health?: HealthProfile;
  lastActiveAt?: ISODate;
  createdAt?: ISODate;
  /** Measured max heart rate (bpm); `null` = estimated from age. */
  maxHr?: number | null;
}

export type AttentionFlag = 'pr' | 'missed' | 'down' | 'soreness' | 'nutrition';

/** Rolling 30-day summary shown in athlete lists. `null` = not recorded (never fabricated). */
export interface AthleteStats {
  adherencePct: number | null;
  strengthChangePct: number | null;
  flag?: AttentionFlag;
  /** e.g. nutrition adherence for the `nutrition` flag. */
  flagValue?: number;
}

export interface Invite {
  id: ID;
  kind: 'coach' | 'athlete' | 'admin';
  email: string;
  /** 7 days, single use. */
  expiresAt: ISODate;
  usedAt?: ISODate;
  url: string;
}

/** Who an invite / reset link is for. `id` is the coach, athlete or admin id; `userId` the login. */
export interface LinkSubject {
  kind: 'coach' | 'athlete' | 'admin';
  id: ID;
  userId?: ID;
}

/** `url` is null when the link was emailed instead of returned. */
export interface LinkResult {
  url: string | null;
  expiresAt: ISODate;
  sent: boolean;
}

export interface NewCoach {
  name: string;
  email: string;
  phone?: string;
  appName: string;
  sport: string;
  athleteCap: number | null;
  /** `null` = unlimited; otherwise days of validity from activation (1–1095). */
  durationDays: number | null;
  reminderDays: Coach['reminderDays'];
  sendInvite: boolean;
}

/** The coach is the signed-in one (the server scopes it). */
export interface NewAthlete {
  name: string;
  email?: string;
  phone?: string;
  gender?: Gender;
  goal?: Goal;
  programId?: ID;
  /** `email`: send the invite by email · `link`: coach shares the link manually · `false`: save only. */
  invite: 'email' | 'link' | false;
  sport?: string;
  /** Admins only (#96): the coach the athlete joins. */
  coach?: ID;
}

export interface ResetToken {
  id: ID;
  userId: ID;
  /** 24 hours, single use. Self-service flows only email it; admins may copy it (audited). */
  expiresAt: ISODate;
  url: string;
}

export interface AuditEvent {
  id: ID;
  at: ISODate;
  actorId: ID;
  action: 'password.change' | 'password.reset-link' | 'invite.copy' | 'invite.send' | 'coach.extend' | 'coach.deactivate' | 'health.view' | 'health.edit' | (string & {});
  targetId?: ID;
  meta?: Record<string, string | number | boolean>;
}

/* ---------- Training ---------- */

export type ExerciseCategory = 'chest' | 'back' | 'legs' | 'arms' | 'shoulders' | 'conditioning' | 'power' | (string & {});
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'bodyweight' | 'machine' | 'box' | (string & {});
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: ID;
  name: string;
  cat: ExerciseCategory;
  equip: Equipment;
  diff: Difficulty | (string & {});
  /** Coach's own uploaded video. */
  video: boolean;
  /** Playable URL of the video. */
  videoSrc?: string;
  /** Cover image URL. */
  imageSrc?: string;
  /** Video duration, `m:ss`. */
  dur?: string;
  /** Tracked metrics (labels). */
  metrics: string[];
  /** Number of programs using it. */
  used: number;
  sport?: string;
  measure?: string;
  unit?: string;
  description?: string;
  cues?: string[];
  /** The coach uploaded this picture (otherwise it's the library illustration). */
  hasOwnImage?: boolean;
  /** Library v2: start pose of the illustration (`imageSrc` is the end pose); none with the coach's own picture. */
  imageStartSrc?: string | null;
  steps?: string[];
  musclesPrimary?: string[];
  musclesSecondary?: string[];
  /** Corrective issue keys (`ISSUES` in @baseline/core). */
  issues?: string[];
  /** `band`: the picture shows the cable/dumbbell version of this band exercise. */
  badge?: string;
  /** exact · approx (look-alike movement) · none */
  illustrationMatch?: string;
  libraryKey?: string;
  /** Ids of this coach's band / no-equipment alternatives, and (on band exercises) what they replace. */
  alternatives?: { band?: ID[]; home?: ID[]; replaces?: ID[] };
}

/** Load unit of a set: kilograms, metres (distance), seconds, … */
export type SetUnit = 'kg' | 'm' | 's' | 'min' | 'km' | 'reps' | (string & {});

export interface SetPrescription {
  reps: string;
  value?: number | null;
  unit: SetUnit;
  restSec?: number | null;
  rpe?: number | null;
}

export interface ExerciseSlot {
  id: ID;
  exerciseId: ID;
  sets: SetPrescription[];
  note?: string;
  /** Part of the day of this exercise when a day has several sessions ('' = the day's time). */
  time?: DayTime;
}

/** Saturday-first Persian week; Friday is a valid training day. */
export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export type DayTime = '' | 'morning' | 'noon' | 'afternoon' | 'night';

export interface ProgramDay {
  weekday: Weekday;
  focus?: string;
  /** Part of the day: morning · noon · afternoon · night ('' = not set). */
  time?: DayTime;
  rest: boolean;
  exercises: ExerciseSlot[];
}

export interface ProgramWeek {
  index: number;
  days: ProgramDay[];
}

export interface Program {
  id: ID;
  coachId: ID;
  name: string;
  goal?: string;
  sport?: string;
  /** Default time of day for its sessions; a day's own `time` wins. */
  time?: DayTime;
  kind: 'template' | 'copy' | 'customized';
  /** For athlete copies: the template it came from. Edits never flow back to the template. */
  templateId?: ID;
  athleteId?: ID;
  version: number;
  durationWeeks: number;
  /** Week/day/exercise detail — loaded by the builder; list views only need the summary. */
  weeks?: ProgramWeek[];
  sessionsPerWeek: number;
  updatedAt: ISODate;
  /** Athlete programs (#74): running now, the athlete's main one, and since when. */
  active?: boolean;
  main?: boolean;
  startDate?: ISODate;
}

export type SessionStatus = 'completed' | 'partial' | 'missed' | 'planned' | 'in-progress' | 'rest';

export interface LoggedSet {
  target: SetPrescription;
  /** Filled only when different from the target (athlete ticks "done as prescribed" otherwise). */
  actual?: { reps?: string; value?: number | null };
  done: boolean;
  isPR?: boolean;
}

export interface WorkoutLog {
  id: ID;
  athleteId: ID;
  programId: ID;
  date: ISODate;
  status: SessionStatus;
  durationMin?: number;
  avgHr?: number;
  rpe?: number;
  exercises: Array<{ exerciseId: ID; sets: LoggedSet[] }>;
  athleteNote?: string;
  coachFeedback?: string[];
}

/* ---------- Nutrition & recovery ---------- */

export interface FoodItem {
  id: ID;
  name: string;
  kcalPer100g: number;
  grams: number;
}

export interface Meal {
  id: ID;
  name: string;
  time?: string;
  foods: FoodItem[];
}

export interface NutritionPlan {
  id: ID;
  athleteId: ID;
  targets: { kcal: number; protein: number; carbs: number; fat: number; waterL: number };
  meals: Meal[];
}

export interface RecoveryCheckIn {
  id: ID;
  athleteId: ID;
  date: ISODate;
  sleepHours?: number;
  sleepQuality?: number;
  soreness?: number;
  stress?: number;
  energy?: number;
  note?: string;
}

/* ---------- Measurements, tests & records ---------- */

export type BodyMetric = 'weight' | 'height' | 'bodyFat' | 'muscleMass' | 'waist' | 'hip' | 'chest' | 'arm' | 'thigh' | 'restingHr';

export interface Measurement {
  id: ID;
  athleteId: ID;
  metric: BodyMetric;
  value: number;
  unit: string;
  date: ISODate;
  /** The athlete is the primary source; the coach can also record. */
  recordedBy: 'athlete' | 'coach';
}

export interface TestResult {
  id: ID;
  athleteId: ID;
  testId: ID;
  value: number;
  date: ISODate;
}

export interface PersonalRecord {
  id: ID;
  athleteId: ID;
  exerciseId: ID;
  type: string;
  value: number;
  unit: string;
  date: ISODate;
  previous?: number;
}

/* ---------- Messaging ---------- */

export interface Message {
  id: ID;
  threadId: ID;
  from: 'coach' | 'athlete';
  text: string;
  at: ISODate;
  status: 'sending' | 'sent' | 'read' | 'failed';
}
