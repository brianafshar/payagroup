// Progress beyond adherence (#63): every chart groups days, weeks or months and scrolls along time.
// Training Effect and lactate threshold are the values the athlete's watch reported after sessions.
import { faDigits, faNumber, volumeParts, type DatedPoint } from '@baseline/core';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ComparisonBar, Surface, Tag, TimeChart, Txt } from '../ui';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mmss = (min: number) => {
  const m = Math.floor(min);
  return faDigits(m + ':' + String(Math.round((min - m) * 60)).padStart(2, '0'));
};
const COLORS = ['viz-1', 'viz-2', 'viz-3', 'viz-4'] as const;
const WATCH = 'از ساعت ورزشی (مثلاً گارمین) — موقع پایان تمرین در «جزئیات دویدن / هوازی» وارد کن.';

export function ProgressTrends({ t, long }: { t: Json | undefined; long: boolean }) {
  const [lift, setLift] = useState(0);
  if (!t) return null;
  const S: Record<string, DatedPoint[]> = t.series || {};
  const p = (k: string) => S[k] || [];
  const common = { from: t.since as string, to: iso(new Date()), initial: (long ? 'month' : 'week') as 'month' | 'week' };
  const W = t.weight || {};
  const w = t.watch || {};
  const lifts: Json[] = t.lifts || [];
  const cur = lifts[Math.min(lift, lifts.length - 1)];
  const V = t.volume || {};
  const parts = volumeParts(V.groups || []);
  const change = V.prev7?.kg ? Math.round(((V.last7.kg - V.prev7.kg) / V.prev7.kg) * 100) : null;
  return (
    <>
      {cur ? (
        <Surface>
          <TimeChart
            {...common}
            title="قدرت · 1RM تخمینی"
            series={[{ name: cur.name, points: cur.points, color: 'viz-1' }]}
            agg="max"
            unit="kg"
            hint="بهترین ست هر دوره با فرمول Epley"
            extra={
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {lifts.map((l, i) => (
                  <Tag key={l.name} selected={l === cur} onPress={() => setLift(i)}>
                    {l.name}
                  </Tag>
                ))}
              </ScrollView>
            }
          />
        </Surface>
      ) : null}
      <Surface>
        <TimeChart
          {...common}
          title="حجم تمرین قدرتی"
          series={parts.map((x, i) => ({ name: x.name, points: x.points, color: COLORS[i] }))}
          kind="stacked"
          agg="sum"
          unit="kg"
          empty="ست وزنه‌داری که تیک بزنی، اینجا به تفکیک عضله جمع می‌شود."
          extra={
            <Txt size={13} lh={20}>
              {'۷ روز اخیر: ' + faNumber(V.last7?.kg ?? 0, 0) + ' کیلوگرم در ' + faDigits(V.last7?.sets ?? 0) + ' ست'}
              {change != null ? (
                <Txt size={13} lh={20} color={change >= 0 ? 'success-text' : 'warning-text'}>
                  {' · ' + (change === 0 ? 'برابر با ۷ روز قبل' : faDigits(Math.abs(change)) + '٪ ' + (change > 0 ? 'بیشتر' : 'کمتر') + ' از ۷ روز قبل')}
                </Txt>
              ) : null}
            </Txt>
          }
          hint={(parts.length ? 'سهم: ' + parts.map((x) => x.name + ' ' + faDigits(x.share) + '٪').join('، ') + ' · ' : '') + 'حجم = وزنه × تکرار'}
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="وزن بدن"
          series={[{ name: 'وزن', points: p('weight'), color: 'viz-1' }]}
          unit="kg"
          empty="با ثبت وزن در «اندازه‌گیری بدن»، روند وزن اینجا نمایش داده می‌شود."
          hint={W.goal ? 'هدف: ' + faNumber(W.goal) + ' kg' : undefined}
          extra={
            W.first != null && W.last != null && W.change != null ? (
              <ComparisonBar label="وزن" first={W.first} current={W.last} unit="kg" firstDate="اول بازه" currentDate="آخرین" />
            ) : null
          }
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="Training Effect هوازی و بی‌هوازی"
          series={[
            { name: 'هوازی', points: p('aerobicTe'), color: 'viz-3' },
            { name: 'بی‌هوازی', points: p('anaerobicTe'), color: 'viz-2' },
          ]}
          empty={'هنوز ثبت نشده. ' + WATCH}
          hint={
            (w.aerobicTe != null ? 'آخرین جلسه: هوازی ' + faNumber(w.aerobicTe) + ' · بی‌هوازی ' + faNumber(w.anaerobicTe ?? 0) + ' از ۵ · ' : '') + 'میانگین هر روز / هفته / ماه.'
          }
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="ضربان آستانه لاکتات"
          series={[{ name: 'ضربان آستانه', points: p('ltHr'), color: 'viz-4' }]}
          unit="bpm"
          empty={'هنوز ثبت نشده. ' + WATCH}
          hint={w.ltHr != null ? 'آخرین: ' + faDigits(w.ltHr) + ' bpm' : undefined}
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="سرعت آستانه لاکتات (دقیقه/کیلومتر)"
          series={[{ name: 'سرعت آستانه', points: p('ltPace'), color: 'viz-2' }]}
          empty={'هنوز ثبت نشده. ' + WATCH}
          hint={w.ltPace != null ? 'آخرین: ' + mmss(w.ltPace) + ' دقیقه/کیلومتر · کمتر یعنی سریع‌تر' : undefined}
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="مسافت دویدن"
          series={[{ name: 'کیلومتر', points: p('km'), color: 'viz-1' }]}
          kind="bar"
          agg="sum"
          unit="km"
          empty="جلسه‌های دویدن (با مسافت) که ثبت کنی، اینجا جمع می‌شوند."
          hint={t.totals?.km ? 'مجموع ' + faNumber(t.totals.km) + ' کیلومتر در این بازه' : undefined}
        />
      </Surface>
      <Surface>
        <TimeChart
          {...common}
          title="ضربان استراحت و HRV"
          series={[
            { name: 'ضربان استراحت', points: p('restingHr'), color: 'viz-4' },
            { name: 'HRV', points: p('hrv'), color: 'viz-3' },
          ]}
          empty="از چک‌این صبح یا ساعت ورزشی ثبت می‌شود."
          hint="ضربان استراحت کمتر و HRV بیشتر یعنی آمادگی بهتر."
        />
      </Surface>
      <View />
    </>
  );
}
