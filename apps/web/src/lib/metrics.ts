/** Body measurement metrics (backend `Measurement.Metric`) with Persian labels and units. */
export const METRICS: Record<string, { label: string; unit: string }> = {
  weight: { label: 'وزن بدن', unit: 'kg' },
  height: { label: 'قد', unit: 'cm' },
  bodyFat: { label: 'درصد چربی', unit: '%' },
  muscleMass: { label: 'توده عضلانی', unit: 'kg' },
  chest: { label: 'دور سینه', unit: 'cm' },
  waist: { label: 'دور کمر', unit: 'cm' },
  hip: { label: 'دور باسن', unit: 'cm' },
  arm: { label: 'دور بازو', unit: 'cm' },
  thigh: { label: 'دور ران', unit: 'cm' },
  calf: { label: 'دور ساق', unit: 'cm' },
  neck: { label: 'دور گردن', unit: 'cm' },
  restingHr: { label: 'ضربان استراحت', unit: 'bpm' },
};

export const HEALTH_LABELS: Array<[string, string]> = [
  ['conditions', 'شرایط پزشکی'],
  ['injuries', 'آسیب‌ها'],
  ['medications', 'داروها'],
  ['allergies', 'حساسیت‌ها'],
  ['limitations', 'محدودیت‌های حرکتی'],
  ['history', 'سابقه پزشکی'],
  ['note', 'یادداشت ورزشکار'],
];

/** `82.4` → `۸۲٫۴` */
export function faNum(n: number | null | undefined): string {
  if (n == null) return 'ثبت نشده';
  return String(Math.round(n * 10) / 10)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])
    .replace('.', '٫');
}
