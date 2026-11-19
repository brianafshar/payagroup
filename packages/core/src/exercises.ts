/**
 * Exercise library v2 labels shared by the coach panel and the athlete app: muscles, corrective issues,
 * band intensity levels and the equipment added in v2. Keys match `backend/training/library/exercises.json`.
 */

/** Muscle keys (`musclesPrimary` / `musclesSecondary`) → Persian. */
export const MUSCLES: Record<string, string> = {
  abductors: 'دورکننده‌های ران',
  adductors: 'داخل ران (نزدیک‌کننده‌ها)',
  anterior_deltoid: 'سرشانه جلو',
  biceps_brachii: 'جلو بازو',
  brachialis: 'بازویی',
  brachioradialis: 'ساعد (بازویی‌زندی)',
  erector_spinae: 'فیله کمر',
  forearm_extensors: 'بازکننده‌های ساعد',
  forearm_flexors: 'خم‌کننده‌های ساعد',
  forearms: 'ساعد',
  gastrocnemius: 'ساق (دوقلو)',
  gluteus_maximus: 'سرینی بزرگ',
  gluteus_medius: 'سرینی میانی',
  hamstrings: 'همسترینگ (پشت ران)',
  hip_flexors: 'خم‌کننده‌های لگن',
  lateral_deltoid: 'سرشانه میانی',
  latissimus_dorsi: 'زیربغل (پشتی بزرگ)',
  obliques: 'پهلو (مورب‌ها)',
  pectoralis_major: 'سینه',
  posterior_deltoid: 'سرشانه خلفی',
  quadratus_lumborum: 'مربع کمری',
  quadriceps: 'چهارسر (جلو ران)',
  rectus_abdominis: 'راست شکمی',
  rhomboids: 'میان‌کتف (متوازی‌الاضلاع)',
  serratus_anterior: 'دندانه‌ای قدامی',
  soleus: 'نعلی',
  supraspinatus: 'فوق‌خاری',
  tibialis_anterior: 'جلو ساق (درشت‌نئی قدامی)',
  transverse_abdominis: 'عرضی شکم',
  trapezius: 'ذوزنقه',
  triceps_brachii: 'پشت بازو',
  rotator_cuff: 'روتاتور کاف (چرخاننده‌های شانه)',
  foot_intrinsics: 'عضلات کف پا',
};

/** Corrective issue keys (`issues`) → Persian; the «اصلاحی» filter groups exercises by these. */
export const ISSUES: Record<string, string> = {
  forward_head: 'سر به جلو',
  rounded_shoulders: 'شانه گرد و قوز',
  lower_back: 'کمردرد و ثبات کمر',
  anterior_pelvic_tilt: 'کمر گود (لوردوز)',
  knee_valgus: 'زانو ضربدری و درد زانو',
  flat_feet: 'صافی کف پا و مچ پا',
  shoulder_stability: 'ثبات شانه و روتاتور کاف',
  hip_mobility: 'تحرک لگن',
  thoracic_mobility: 'تحرک بالای کمر',
};

/**
 * Band intensity for band exercises (unit `band`): the set's value is the level, 1 = yellow … 5 = black.
 * `short` fits a set row; `color` is the band's own colour.
 */
export const BAND_LEVELS: Array<{ level: number; label: string; short: string; color: string }> = [
  { level: 1, label: 'زرد (خیلی سبک)', short: 'زرد', color: '#F2C200' },
  { level: 2, label: 'قرمز (سبک)', short: 'قرمز', color: '#D93636' },
  { level: 3, label: 'سبز (متوسط)', short: 'سبز', color: '#2E9E4F' },
  { level: 4, label: 'آبی (سنگین)', short: 'آبی', color: '#2F6FD6' },
  { level: 5, label: 'مشکی (خیلی سنگین)', short: 'مشکی', color: '#222222' },
];

/** «کش سبز» for a band level (1–5); '' when unset. */
export function bandLabel(level: number | null | undefined, long = false): string {
  const b = BAND_LEVELS.find((x) => x.level === Math.round(Number(level)));
  return b ? (long ? b.label : 'کش ' + b.short) : '';
}

/** Equipment added in library v2 (merged into each app's equipment labels). */
export const EQUIPMENT_V2: Record<string, string> = {
  band: 'کش دسته‌دار (بلند)',
  loop_band: 'مینی‌بند (کش حلقه‌ای)',
  ez_bar: 'میله EZ',
  smith: 'اسمیت',
  trx: 'TRX (بند تعلیقی)',
  rings: 'حلقه ژیمناستیک',
  stability_ball: 'توپ سوئیسی',
  pullup_bar: 'میله بارفیکس',
  parallel_bars: 'پارالل',
  bench: 'نیمکت',
  plate: 'صفحه وزنه',
  rope: 'طناب',
  other: 'سایر',
};

/** Under the picture: why it may not be exactly this exercise. */
export function illustrationNote(match?: string | null, badge?: string | null): string {
  if (badge === 'band') return 'تصویر نسخه کابل/دمبل است؛ اجرا با کش همین است';
  if (match === 'approx') return 'تصویر حرکت هم‌شکل است';
  return '';
}
