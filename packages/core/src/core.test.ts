import { describe, expect, it } from 'vitest';
import { faClock, faDate, faDigits, faNumber, fromJalali, iconPrimitives, parseFaNumber, toJalali } from './index';

describe('jalali', () => {
  it('round-trips dates across the year', () => {
    for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2027, 0, 1); t += 86400000 * 3) {
      const d = new Date(t);
      const { jy, jm, jd } = toJalali(d);
      const back = fromJalali(jy, jm, jd);
      expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([d.getFullYear(), d.getMonth(), d.getDate()]);
    }
  });

  it('matches known dates from the designs', () => {
    expect(toJalali(new Date(2026, 8, 23))).toEqual({ jy: 1405, jm: 7, jd: 1 });
    expect(faDate(new Date(2026, 8, 23), { weekday: true, year: false })).toBe('چهارشنبه ۱ مهر');
    expect(faDate(fromJalali(1404, 12, 12))).toBe('۱۲ اسفند ۱۴۰۴');
  });
});

describe('persian numbers', () => {
  it('formats and parses', () => {
    expect(faDigits(12.5, true)).toBe('۱۲٫۵');
    expect(faNumber(1840)).toBe('۱٬۸۴۰');
    expect(faNumber(67.5)).toBe('۶۷٫۵');
    expect(faNumber(-3)).toBe('−۳');
    expect(parseFaNumber('۸۲٫۴')).toBe(82.4);
    expect(parseFaNumber('')).toBeNull();
    expect(faClock(65)).toBe('۱:۰۵');
  });
});

describe('icons', () => {
  it('parses primitives and falls back to a circle', () => {
    expect(iconPrimitives('check')).toEqual([{ t: 'path', d: 'M4.5 12.5l5 5L20 7', filled: false }]);
    expect(iconPrimitives('nope')[0].t).toBe('circle');
  });
});

import { faJoin, RLM } from './index';

describe('faJoin', () => {
  it('wraps separators in RLMs and skips empty parts', () => {
    expect(faJoin(['حرکت ۴ از ۴', null, '۴ × ۱۲'])).toBe('حرکت ۴ از ۴ ' + RLM + '·' + RLM + ' ۴ × ۱۲');
  });
});

import { buckets, groupPoints } from './timeseries';

describe('timeseries', () => {
  const pts = [
    { date: '2026-09-01', value: 2 },
    { date: '2026-09-03', value: 4 },
    { date: '2026-09-20', value: 6 },
  ];
  it('groups by day, Saturday weeks and Persian months', () => {
    const d = buckets('2026-09-01', '2026-09-03', 'day');
    expect(d.map((b) => b.key)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(groupPoints(pts, d, 'day', 'sum')).toEqual([2, 0, 4]);
    expect(groupPoints(pts, d, 'day', 'avg')).toEqual([2, null, 4]);
    const w = buckets('2026-09-01', '2026-09-20', 'week');
    expect(w[0].key).toBe('2026-08-29'); // the Saturday before
    expect(groupPoints(pts, w, 'week', 'avg')[0]).toBe(3);
    const m = buckets('2026-09-01', '2026-09-20', 'month'); // شهریور 10 → 29
    expect(m.length).toBe(1);
    expect(groupPoints(pts, m, 'month', 'sum')).toEqual([12]);
  });
});

import { volumeParts } from './timeseries';

describe('volumeParts', () => {
  const g = (category: string, kg: number, date = '2026-10-01') => ({ category, kg, points: [{ date, value: kg }] });
  it('keeps the biggest groups and sums the rest as «سایر»', () => {
    const parts = volumeParts([g('legs', 500), g('chest', 300), g('back', 100, '2026-10-02'), g('arms', 60), g('shoulders', 40)]);
    expect(parts.map((p) => p.name)).toEqual(['پا', 'سینه', 'پشت', 'سایر']);
    expect(parts[3].kg).toBe(100);
    expect(parts[3].points).toEqual([{ date: '2026-10-01', value: 100 }]);
    expect(parts[0].share).toBe(50);
  });
  it('shows a fourth group instead of a «سایر» of one', () => {
    expect(volumeParts([g('legs', 5), g('chest', 3), g('back', 2), g('arms', 1)]).map((p) => p.name)).toEqual(['پا', 'سینه', 'پشت', 'بازو']);
  });
});
