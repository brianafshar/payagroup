import { describe, expect, it } from 'vitest';
import { daysUntil, faDate, faDigits, faLastSeen, fmt } from './format';
import { fromJalali } from '@baseline/core';

describe('format', () => {
  it('uses Persian digits and the ٫ decimal separator', () => {
    expect(faDigits('12:40')).toBe('۱۲:۴۰');
    expect(fmt(62.5)).toBe('۶۲٫۵');
  });

  it('round-trips Jalali dates through Intl', () => {
    const d = fromJalali(1404, 12, 12);
    expect(faDate(d)).toBe('۱۲ اسفند ۱۴۰۴');
    expect(faDate(fromJalali(1405, 7, 5))).toBe('۵ مهر ۱۴۰۵');
  });

  it('labels last-seen relative to now', () => {
    const now = new Date(2026, 8, 25, 12, 0);
    expect(faLastSeen(new Date(2026, 8, 25, 8, 40).toISOString(), now)).toBe('امروز، ۰۸:۴۰');
    expect(faLastSeen(new Date(2026, 8, 24, 9).toISOString(), now)).toBe('دیروز');
    expect(faLastSeen(null, now)).toBe('هرگز');
  });

  it('counts whole days until a date', () => {
    const now = new Date(2026, 8, 25, 23, 0);
    expect(daysUntil(new Date(2026, 8, 27, 1).toISOString(), now)).toBe(2);
    expect(daysUntil(new Date(2026, 8, 20).toISOString(), now)).toBe(-5);
  });
});

import { faLastActive } from './format';

describe('faLastActive', () => {
  it('shows the weekday within the last week', () => {
    const now = new Date(2026, 8, 25, 12); // جمعه ۳ مهر ۱۴۰۵
    expect(faLastActive(new Date(2026, 8, 20, 9).toISOString(), now)).toBe('یکشنبه ۲۹ شهریور');
    expect(faLastActive(new Date(2026, 8, 2, 9).toISOString(), now)).toBe('۱۱ شهریور');
    expect(faLastActive(new Date(2026, 8, 25, 7).toISOString(), now)).toBe('امروز');
  });
});
