import { EQUIPMENT_V2 } from '@baseline/core';

export { BAND_LEVELS, ISSUES, MUSCLES, bandLabel, illustrationNote } from '@baseline/core';

/** Exercise library labels (the exercises themselves come from `api.exercises`). */
export const EX_CATS: Record<string, string> = {
  chest: 'سینه',
  back: 'پشت',
  legs: 'پا',
  arms: 'بازو',
  shoulders: 'سرشانه',
  core: 'میان‌تنه',
  conditioning: 'آمادگی هوازی',
  power: 'توان',
  run: 'جلسه دویدن',
  drill: 'تکنیک دویدن',
  swim: 'جلسه شنا',
  swim_drill: 'تکنیک شنا',
  ride: 'جلسه رکاب‌زنی',
  ride_drill: 'تکنیک دوچرخه',
  brick: 'تمرین ترکیبی (بریک)',
  wod: 'WOD',
  gymnastics: 'ژیمناستیک',
  olympic: 'وزنه‌برداری المپیک',
  ball: 'تکنیک توپ',
  shooting: 'شوت',
  handling: 'دریبل و پاس',
  defense: 'دفاع',
  agility: 'سرعت و چابکی',
  technique: 'تکنیک و فرم رزمی',
  sparring: 'مبارزه و کیسه',
  mobility: 'کشش و تحرک‌پذیری',
  corrective: 'حرکات اصلاحی',
};

/** Bodybuilding / strength categories: every sport has them (athletes of any sport lift). */
export const STRENGTH_CATS = ['chest', 'back', 'legs', 'arms', 'shoulders', 'core', 'power', 'conditioning', 'mobility', 'corrective'];

/** Each sport's own categories (#75), listed before the strength ones. */
export const SPORT_CATS: Record<string, string[]> = {
  fitness: [],
  running: ['run', 'drill'],
  swimming: ['swim', 'swim_drill'],
  cycling: ['ride', 'ride_drill'],
  triathlon: ['swim', 'swim_drill', 'ride', 'run', 'drill', 'brick'],
  crossfit: ['wod', 'gymnastics', 'olympic'],
  football: ['ball', 'agility'],
  basketball: ['shooting', 'handling', 'defense', 'agility'],
  martial: ['technique', 'sparring', 'agility'],
  endurance: ['run', 'ride', 'swim'],
};

/** Categories to offer for a sport (all of them when no sport is chosen). */
export function categoriesFor(sport?: string | null): string[] {
  if (!sport || !(sport in SPORT_CATS)) return Object.keys(EX_CATS);
  return [...SPORT_CATS[sport], ...STRENGTH_CATS];
}
export const EX_EQUIP: Record<string, string> = {
  barbell: 'هالتر',
  dumbbell: 'دمبل',
  cable: 'کابل',
  bodyweight: 'وزن بدن',
  machine: 'دستگاه',
  kettlebell: 'کتل‌بل',
  band: 'کش',
  ball: 'توپ طبی',
  box: 'جعبه پرش',
  treadmill: 'تردمیل',
  outdoor: 'فضای باز',
  cardio: 'دستگاه هوازی',
  roller: 'فوم رولر',
  pool: 'استخر',
  basketball: 'توپ بسکتبال',
  cone: 'مخروط',
  other: 'بدون وسیله خاص',
  ...EQUIPMENT_V2,
};
export const EX_DIFF: Record<string, string> = { beginner: 'مبتدی', intermediate: 'متوسط', advanced: 'پیشرفته' };

/** Sports a coach can work in and exercises can belong to (one list for every screen). */
export const SPORTS: Array<[string, string]> = [
  ['fitness', 'فیتنس و قدرتی'],
  ['running', 'دویدن'],
  ['swimming', 'شنا'],
  ['cycling', 'دوچرخه‌سواری'],
  ['triathlon', 'سه‌گانه'],
  ['crossfit', 'کراس‌فیت'],
  ['football', 'فوتبال'],
  ['basketball', 'بسکتبال'],
  ['martial', 'هنرهای رزمی'],
  ['endurance', 'استقامتی'],
];
/** Required credit for the library illustrations (RepDB free tier licence). */
export const LIBRARY_CREDIT = { text: 'Exercise data by RepDB (repdb.co)', href: 'https://repdb.co/' };

export const SPORT_LABEL: Record<string, string> = Object.fromEntries(SPORTS);
