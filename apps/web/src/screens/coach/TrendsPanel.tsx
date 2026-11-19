// Long-range progress for the coach (#63), the same data as the athlete's progress tab. Every chart can
// show days, weeks or months and scroll along time. Aerobic / anaerobic Training Effect and lactate
// threshold are the athlete's watch values, as reported after each session.
import { useState } from 'react';
import { Tabs } from '@/ds';
import { remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { DatedPoint } from '@baseline/core';
import { faN, TimeChart } from './TimeChart';
import { VolumeChart } from './VolumeChart';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const RANGES = [
  { id: '90', label: '۳ ماه' },
  { id: '180', label: '۶ ماه' },
  { id: '365', label: '۱ سال' },
  { id: '730', label: '۲ سال' },
  { id: '1095', label: '۳ سال' },
  { id: '3650', label: 'همه' },
];
const mmss = (m: number) => faN(Math.floor(m), 0) + ':' + faN(Math.round((m % 1) * 60), 0).padStart(2, '۰');
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function TrendsPanel({ athleteId }: { athleteId: string }) {
  const [days, setDays] = useState('365');
  const q = useQuery(`analytics:trends:${athleteId}:${days}`, () => remote.analytics(athleteId, 'trends', +days));
  const t = q.data as Json | undefined;
  if (!t) return null;
  const S: Record<string, DatedPoint[]> = t.series || {};
  const pts = (k: string) => S[k] || [];
  const from = t.since as string;
  const to = iso(new Date());
  const long = +days > 180;
  const common = { from, to, initial: (long ? 'month' : 'week') as 'month' | 'week' };
  const w = t.watch || {};
  const watchNote = 'عدد ساعت ورزشی (Garmin و…) که بعد از هر جلسه ثبت می‌شود؛ بدون ساعت، این نمودار خالی می‌ماند.';
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, lineHeight: '28px', fontWeight: 600, flex: 1 }}>روند پیشرفت</h2>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <Tabs variant="pill" value={days} tabs={RANGES} onChange={setDays} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <TimeChart
          {...common}
          title="وزن بدن"
          summary={
            t.weight?.change != null
              ? (t.weight.change > 0 ? '+' : '') + faN(t.weight.change) + ' kg در این بازه' + (t.weight.goal ? ' · هدف ' + faN(t.weight.goal) + ' kg' : '')
              : 'وزن ثبت‌شده'
          }
          series={[{ name: 'وزن', points: pts('weight'), color: 'viz-1' }]}
          unit="kg"
          empty="وزن در این بازه ثبت نشده."
        />
        <TimeChart
          {...common}
          title="Training Effect هوازی و بی‌هوازی"
          summary={w.aerobicTe != null ? 'آخرین جلسه: هوازی ' + faN(w.aerobicTe) + ' · بی‌هوازی ' + faN(w.anaerobicTe) + ' (از ۵)' : 'از ساعت ورزشی'}
          footnote={watchNote + ' میانگین هر روز / هفته / ماه.'}
          series={[
            { name: 'هوازی', points: pts('aerobicTe'), color: 'viz-3' },
            { name: 'بی‌هوازی', points: pts('anaerobicTe'), color: 'viz-2' },
          ]}
          empty="هنوز Training Effect از ساعت ثبت نشده."
        />
        <TimeChart
          {...common}
          title="ضربان آستانه لاکتات"
          summary={w.ltHr != null ? 'آخرین: ' + faN(w.ltHr, 0) + ' bpm' : 'از ساعت ورزشی'}
          footnote={watchNote}
          series={[{ name: 'ضربان آستانه', points: pts('ltHr'), color: 'viz-4' }]}
          unit="bpm"
          empty="ضربان آستانه از ساعت ثبت نشده."
        />
        <TimeChart
          {...common}
          title="سرعت آستانه لاکتات"
          summary={w.ltPace != null ? 'آخرین: ' + mmss(w.ltPace) + ' دقیقه/کیلومتر · کمتر یعنی سریع‌تر' : 'از ساعت ورزشی'}
          footnote={watchNote}
          series={[{ name: 'سرعت آستانه (دقیقه/کیلومتر)', points: pts('ltPace'), color: 'viz-2' }]}
          empty="سرعت آستانه از ساعت ثبت نشده."
        />
        <TimeChart
          {...common}
          title="مسافت دویدن"
          summary={'مجموع ' + faN(t.totals?.km) + ' کیلومتر'}
          series={[{ name: 'کیلومتر', points: pts('km'), color: 'viz-1' }]}
          kind="bar"
          agg="sum"
          unit="km"
          empty="جلسه دویدن با مسافت در این بازه نیست."
        />
        <TimeChart
          {...common}
          title="VO₂max"
          summary={t.totals?.vo2max ? 'آخرین: ' + faN(t.totals.vo2max) + ' ml/kg/min' : 'از دویدن‌های ۳ کیلومتر به بالا'}
          series={[{ name: 'VO₂max', points: pts('vo2max'), color: 'viz-1' }]}
          agg="max"
          empty="دویدن ۳ کیلومتر به بالا در این بازه نیست."
        />
        <TimeChart
          {...common}
          title="ضربان استراحت و HRV"
          summary="از چک‌این صبح یا ساعت ورزشی"
          series={[
            { name: 'ضربان استراحت (bpm)', points: pts('restingHr'), color: 'viz-4' },
            { name: 'HRV (ms)', points: pts('hrv'), color: 'viz-3' },
          ]}
          empty="ضربان استراحت یا HRV ثبت نشده."
        />
        <VolumeChart t={t} {...common} />
        {(t.lifts || []).map((l: Json, i: number) => (
          <TimeChart
            key={l.name}
            {...common}
            title={'1RM تخمینی · ' + l.name}
            summary="بهترین ست هر دوره (فرمول Epley)"
            series={[{ name: l.name, points: l.points, color: ['viz-1', 'viz-2', 'viz-3'][i % 3] }]}
            agg="max"
            unit="kg"
          />
        ))}
      </div>
    </section>
  );
}
