/** Persian (fa-IR) number & date helpers. Numbers use ۰–۹ and the `٫` decimal separator. */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Replaces ASCII digits with Persian digits (keeps everything else). */
export function faDigits(v: string | number): string {
  return String(v).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Localised number: `fmt(62.5)` → `۶۲٫۵`. Non-numbers pass through unchanged. */
export function fmt<T>(n: T, maxFractionDigits = 1): T | string {
  if (typeof n !== 'number' || Number.isNaN(n)) return n;
  return n.toLocaleString('fa-IR', { maximumFractionDigits: maxFractionDigits });
}

/** Date calendar chosen in settings (j = شمسی, g = میلادی, h = قمری), remembered on this device. */
export type CalendarPref = 'j' | 'g' | 'h';
const CAL_KEY = 'bl-calendar';
const LOCALE: Record<CalendarPref, string> = { j: 'fa-IR-u-ca-persian', g: 'fa-IR-u-ca-gregory', h: 'fa-IR-u-ca-islamic-umalqura' };
let calendar: CalendarPref = (() => {
  try {
    const v = localStorage.getItem(CAL_KEY);
    return v === 'g' || v === 'h' ? v : 'j';
  } catch {
    return 'j';
  }
})();

export function setCalendar(c: string | undefined): void {
  calendar = c === 'g' || c === 'h' ? c : 'j';
  try {
    localStorage.setItem(CAL_KEY, calendar);
  } catch {
    /* private mode */
  }
}

export function getCalendar(): CalendarPref {
  return calendar;
}

/** A date in the chosen calendar (Jalali by default), e.g. `۵ مهر ۱۴۰۵` or `۲۷ ربیع‌الاول ۱۴۴۸`. */
export function faDate(d: Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }, cal: CalendarPref = calendar): string {
  return d.toLocaleDateString(LOCALE[cal], opts);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `۲۹ شهریور` */
export function faDayMonth(d: Date): string {
  return faDate(d, { day: 'numeric', month: 'long' });
}

/** `۰۸:۴۰` */
export function faTime(d: Date): string {
  return faDigits(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
}

/**
 * Last-seen style label used across tables: `امروز، ۰۸:۴۰`, `دیروز`, `۲۹ شهریور`, or `هرگز`.
 * `withTime` adds the clock time for today.
 */
export function faLastSeen(iso: string | null | undefined, now = new Date(), withTime = true): string {
  if (!iso) return 'هرگز';
  const d = new Date(iso);
  if (sameDay(d, now)) return withTime ? 'امروز، ' + faTime(d) : 'امروز';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'دیروز';
  return faDayMonth(d);
}

/** Whole days from `now` to `iso` (negative when in the past). */
export function daysUntil(iso: string, now = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(iso);
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Last-activity label for athlete lists: `امروز`, `دیروز`, `شنبه ۲۹ شهریور` (this week),
 * `۱۱ شهریور` (older) or `هرگز`.
 */
export function faLastActive(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'هرگز';
  const d = new Date(iso);
  const days = -daysUntil(iso, now);
  if (days <= 1) return faLastSeen(iso, now, false);
  if (days < 7) return faDate(d, { weekday: 'long', day: 'numeric', month: 'long' }).replace('،', '');
  return faDayMonth(d);
}

/** Whole years since `iso`. */
export function yearsSince(iso: string, now = new Date()): number {
  const d = new Date(iso);
  let y = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) y--;
  return y;
}
