// Recovery trends on the recovery plan page (#43): 30 days of sleep against the target, and
// soreness / energy / stress from the daily check-in, plus averages and resting heart rate.
import type { ReactElement } from 'react';
import { ChartContainer, ChartLegend, LineChart, MetricCard } from '@/ds';
import { faDayMonth, faDigits } from '@/lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');
const avg = (xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export function RecoveryTrends({ days, sleepTarget, sorenessAlert }: { days: Json[]; sleepTarget: number; sorenessAlert: number }) {
  if (!days?.some((d) => d.sleepHours != null || d.soreness != null)) return null;
  const labels = days.map((d, i) => (i % 5 === 0 || i === days.length - 1 ? faDayMonth(new Date(d.date + 'T12:00:00')) : ''));
  const last7 = days.slice(-7);
  const sleep7 = avg(last7.map((d) => d.sleepHours));
  const sore7 = avg(last7.map((d) => d.soreness));
  const rhr = avg(last7.map((d) => d.restingHr));
  const shortNights = days.filter((d) => d.sleepHours != null && d.sleepHours < sleepTarget - 1).length;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
        <MetricCard
          label="میانگین خواب ۷ روز"
          value={sleep7 != null ? fa(sleep7) : null}
          unit="ساعت"
          caption={'هدف ' + fa(sleepTarget) + ' ساعت'}
          emptyLabel="ثبت نشده"
          icon="moon"
        />
        <MetricCard
          label="میانگین کوفتگی ۷ روز"
          value={sore7 != null ? fa(sore7) : null}
          unit="/ ۱۰"
          caption={'هشدار از ' + fa(sorenessAlert)}
          emptyLabel="ثبت نشده"
          icon="activity"
        />
        <MetricCard label="ضربان استراحت" value={rhr != null ? fa(Math.round(rhr)) : null} unit="bpm" caption="میانگین ۷ روز" emptyLabel="ثبت نشده" icon="heart" />
        <MetricCard label="شب‌های کم‌خواب" value={fa(shortNights)} caption={'۳۰ روز · بیش از ۱ ساعت کمتر از هدف'} icon="alert-triangle" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <ChartContainer title="خواب ۳۰ روز" summary="ساعت خواب هر شب نسبت به هدف">
          <LineChart
            labels={labels}
            series={[{ name: 'خواب', values: days.map((d) => d.sleepHours), color: 'viz-1' }]}
            target={{ value: sleepTarget, label: 'هدف' }}
            unit="h"
            height={180}
            width={560}
          />
        </ChartContainer>
        <ChartContainer title="کوفتگی، انرژی و استرس" summary="امتیاز ۱ تا ۱۰ از چک‌این صبح">
          <LineChart
            labels={labels}
            series={[
              { name: 'کوفتگی', values: days.map((d) => d.soreness), color: 'viz-3' },
              { name: 'انرژی', values: days.map((d) => d.energy), color: 'viz-2' },
              { name: 'استرس', values: days.map((d) => d.stress), color: 'viz-4', dashed: true },
            ]}
            target={{ value: sorenessAlert, label: 'هشدار' }}
            yMin={0}
            yMax={10}
            height={180}
            width={560}
          />
          <ChartLegend
            items={[
              { label: 'کوفتگی', color: 'viz-3' },
              { label: 'انرژی', color: 'viz-2' },
              { label: 'استرس', color: 'viz-4', dashed: true },
            ]}
          />
        </ChartContainer>
      </div>
    </section>
  );
}

/** Watch metrics (HRV with its 7-day baseline, Body Battery, sleep score, steps) and the coach's own
 * check-in questions over the same days — each chart only when something was recorded (#53, #54). */
export function WatchTrends({ days, customFields = [], title }: { days: Json[]; customFields?: Json[]; title?: string }) {
  const labels = days.map((d, i) => (i % 5 === 0 || i === days.length - 1 ? faDayMonth(new Date(d.date + 'T12:00:00')) : ''));
  const has = (k: string) => days.some((d) => d[k] != null);
  const base = days.map((_, i) => {
    const w = days
      .slice(Math.max(0, i - 6), i + 1)
      .map((d) => d.hrvMs)
      .filter((x) => x != null);
    return w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null;
  });
  const charts: ReactElement[] = [];
  if (has('hrvMs'))
    charts.push(
      <ChartContainer key="hrv" title="HRV شبانه" summary="میلی‌ثانیه · خط‌چین = میانگین ۷ روز (پایه). افت چشمگیر زیر پایه یعنی بدن هنوز ریکاوری نشده.">
        <LineChart
          labels={labels}
          series={[
            { name: 'HRV', values: days.map((d) => d.hrvMs), color: 'viz-1', points: true },
            { name: 'پایه', values: base, color: 'viz-4', dashed: true },
          ]}
          unit="ms"
          height={180}
          width={560}
        />
      </ChartContainer>,
    );
  if (has('bodyBattery') || has('sleepScore'))
    charts.push(
      <ChartContainer key="bb" title="Body Battery و امتیاز خواب" summary="از ساعت ورزشی · ۰ تا ۱۰۰">
        <LineChart
          labels={labels}
          series={[
            { name: 'Body Battery', values: days.map((d) => d.bodyBattery), color: 'viz-2' },
            { name: 'امتیاز خواب', values: days.map((d) => d.sleepScore), color: 'viz-1', dashed: true },
          ]}
          yMin={0}
          yMax={100}
          height={180}
          width={560}
        />
        <ChartLegend
          items={[
            { label: 'Body Battery', color: 'viz-2' },
            { label: 'امتیاز خواب', color: 'viz-1', dashed: true },
          ]}
        />
      </ChartContainer>,
    );
  if (has('steps'))
    charts.push(
      <ChartContainer key="steps" title="قدم‌های روزانه" summary="فعالیت غیرتمرینی (NEAT)">
        <LineChart labels={labels} series={[{ name: 'قدم', values: days.map((d) => d.steps), color: 'viz-3' }]} height={180} width={560} />
      </ChartContainer>,
    );
  if (has('spo2'))
    charts.push(
      <ChartContainer key="spo2" title="اکسیژن خون (SpO₂)" summary="٪ · مقادیر پایدار زیر ۹۵ را پیگیری کنید">
        <LineChart labels={labels} series={[{ name: 'SpO₂', values: days.map((d) => d.spo2), color: 'viz-5' }]} yMin={85} yMax={100} height={180} width={560} />
      </ChartContainer>,
    );
  for (const f of customFields) {
    const vals = days.map((d) => (d.extra ? d.extra[f.key] : null));
    if (!vals.some((v) => v != null && v !== '')) continue;
    if (f.kind === 'scale' || f.kind === 'number')
      charts.push(
        <ChartContainer key={f.key} title={f.label} summary={'سؤال شما · ' + (f.kind === 'scale' ? '۱ تا ۱۰' : f.unit || 'عدد')}>
          <LineChart
            labels={labels}
            series={[{ name: f.label, values: vals.map((v) => (typeof v === 'number' ? v : null)), color: 'viz-2', points: true }]}
            height={180}
            width={560}
          />
        </ChartContainer>,
      );
    else if (f.kind === 'yesno') {
      const yes = vals.filter((v) => v === true).length;
      const no = vals.filter((v) => v === false).length;
      charts.push(<MetricCard key={f.key} label={f.label} value={fa(yes)} unit={'بله از ' + fa(yes + no)} caption="سؤال شما · ۳۰ روز" icon="check" />);
    } else {
      const last = days
        .filter((d) => d.extra && d.extra[f.key])
        .slice(-3)
        .reverse();
      charts.push(
        <div key={f.key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--surface)' }}>
          <strong style={{ fontSize: 14 }}>{f.label}</strong>
          {last.map((d) => (
            <p key={d.date} style={{ margin: '6px 0 0', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{faDayMonth(new Date(d.date + 'T12:00:00'))}: </span>
              {String(d.extra[f.key])}
            </p>
          ))}
        </div>,
      );
    }
  }
  if (!charts.length) return null;
  return (
    <>
      {title ? <h2 style={{ margin: 0, fontSize: 18, lineHeight: '28px', fontWeight: 600 }}>{title}</h2> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{charts}</div>
    </>
  );
}
