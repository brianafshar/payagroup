// Strength volume (kg = weight × reps of done sets) over time, stacked by muscle group, with the last
// 7 days against the 7 before and each group's share of the range. Same data as the athlete's app.
import { volumeParts } from '@baseline/core';
import { faN, TimeChart } from './TimeChart';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const COLORS = ['viz-1', 'viz-2', 'viz-3', 'viz-4'];
const kg = (n: number) => Math.round(n).toLocaleString('fa-IR');

export function VolumeChart({ t, from, to, initial = 'week' }: { t: Json; from: string; to: string; initial?: 'day' | 'week' | 'month' }) {
  const v = t.volume || {};
  const parts = volumeParts(v.groups || []);
  const now = v.last7 || { kg: 0, sets: 0 };
  const before = v.prev7 || { kg: 0, sets: 0 };
  const change = before.kg ? Math.round(((now.kg - before.kg) / before.kg) * 100) : null;
  const summary = (
    <>
      ۷ روز اخیر: <b>{kg(now.kg)} کیلوگرم</b> در {faN(now.sets, 0)} ست
      {change != null ? (
        <span style={{ color: change >= 0 ? 'var(--success-text, var(--success))' : 'var(--warning-text, var(--warning))' }}>
          {' · '}
          {change === 0 ? 'برابر با ۷ روز قبل' : faN(Math.abs(change), 0) + '٪ ' + (change > 0 ? 'بیشتر' : 'کمتر') + ' از ۷ روز قبل'}
        </span>
      ) : null}
    </>
  );
  return (
    <TimeChart
      title="حجم تمرین قدرتی"
      summary={summary}
      footnote={
        parts.length ? (
          <span>
            {'سهم در این بازه: ' + parts.map((p) => p.name + ' ' + faN(p.share, 0) + '٪').join('، ')}
            {' · حجم = وزنه × تکرار ست‌های انجام‌شده'}
          </span>
        ) : (
          'حجم = وزنه × تکرار ست‌های انجام‌شده'
        )
      }
      series={parts.map((p, i) => ({ name: p.name, points: p.points, color: COLORS[i] }))}
      from={from}
      to={to}
      kind="stacked"
      agg="sum"
      unit="kg"
      initial={initial}
      empty="ست وزنه‌دار انجام‌شده‌ای در این بازه ثبت نشده (ست‌ها باید در اپ تیک خورده باشند)."
    />
  );
}
