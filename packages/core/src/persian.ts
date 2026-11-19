import { toJalali } from './jalali';

/** Persian (fa-IR) formatting that works without `Intl` (web and React Native/Hermes alike). */

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/** ASCII digits → Persian digits; `.` → `٫` when `decimal` is set. */
export function faDigits(v: string | number, decimal = false): string {
  const s = String(v).replace(/\d/g, (d) => FA[Number(d)]);
  return decimal ? s.replace(/\./g, '٫') : s;
}

/** Persian/Arabic digits and separators → ASCII (for parsing user input). */
export function toEnDigits(v: string): string {
  return String(v)
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}

/** Parses a number typed with Persian or ASCII digits; `null` when empty or invalid. */
export function parseFaNumber(v: string | null | undefined): number | null {
  const s = toEnDigits(v ?? '').replace(/[^\d.-]/g, '');
  if (!s || s === '.' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** `1840.5` → `۱٬۸۴۰٫۵` (max fraction digits, trailing zeros trimmed, `٬` thousands). */
export function faNumber(n: number, maxFraction = 1, group = true): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(maxFraction);
  const [int, frac = ''] = fixed.split('.');
  const f = frac.replace(/0+$/, '');
  const i = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') : int;
  return (neg ? '−' : '') + faDigits(i) + (f ? '٫' + faDigits(f) : '');
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
/** Indexed by `Date.getDay()` (0 = Sunday). */
export const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/** `۵ مهر ۱۴۰۵`, optionally with weekday (`سه‌شنبه ۱ مهر`) and without year. */
export function faDate(d: Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { jm, jd, jy } = toJalali(d);
  const parts = [faDigits(jd), JALALI_MONTHS[jm - 1]];
  if (opts.year !== false) parts.push(faDigits(jy));
  return (opts.weekday ? WEEKDAYS[d.getDay()] + ' ' : '') + parts.join(' ');
}

/** `۰۸:۴۰` */
export function faTime(d: Date): string {
  return faDigits(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
}

/** `۱:۰۵` for a duration in seconds. */
export function faClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return faDigits(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
}

/** RTL mark: pins neutral separators to the right-to-left run so digit groups don't merge. */
export const RLM = '‏';

/**
 * Joins Persian label parts with ` · `. Each separator is wrapped in RLMs so adjacent numbers
 * (`۴ از ۴ · ۴ × ۱۲`) stay in reading order instead of collapsing into one LTR digit run.
 */
export function faJoin(parts: Array<string | null | undefined | false>, sep = '·'): string {
  return parts.filter(Boolean).join(' ' + RLM + sep + RLM + ' ');
}
