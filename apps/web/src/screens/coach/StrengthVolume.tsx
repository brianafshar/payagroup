// Strength training volume (#44), as strength apps show it: volume in kg per muscle group over time
// (days, weeks or months), hard sets per muscle group this week against the usual 10–20 range, and
// average session effort (RPE).
import { Card, MetricCard } from '@/ds';
import { EX_CATS } from '@/data/exercises';
import { remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { faDigits } from '@/lib/format';
import { VolumeChart } from './VolumeChart';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const kg = (n: number) => Math.round(n).toLocaleString('fa-IR');

export function StrengthVolume({ data: d, athleteId }: { data: Json; athleteId: string }) {
  const q = useQuery(`analytics:trends:${athleteId}:180`, () => remote.analytics(athleteId, 'trends', 180));
  const t = q.data as Json | undefined;
  const v = t?.volume || {};
  const now = v.last7?.kg ?? 0;
  const prev = v.prev7?.kg ?? 0;
  const weeks: Json[] = d.weeklyTonnes || [];
  const trained = weeks.filter((w) => w.tonnes > 0);
  const avg = trained.length ? (trained.reduce((a, w) => a + w.tonnes, 0) / trained.length) * 1000 : 0;
  const sets: Json[] = d.weekSets || [];
  const max = Math.max(20, ...sets.map((s) => s.sets));
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
        <MetricCard
          label="حجم ۷ روز اخیر"
          value={kg(now)}
          unit="kg"
          delta={prev ? Math.round(((now - prev) / prev) * 1000) / 10 : undefined}
          caption={'نسبت به ۷ روز قبل (' + kg(prev) + ' kg)'}
          icon="dumbbell"
        />
        <MetricCard
          label="میانگین حجم هفتگی"
          value={trained.length ? kg(avg) : null}
          unit="kg"
          caption={'هفته‌های تمرین‌شده از ۱۲ هفته اخیر (' + fa(trained.length) + ')'}
          emptyLabel="ثبت نشده"
          icon="trending-up"
        />
        <MetricCard label="میانگین RPE" value={d.avgRpe != null ? fa(d.avgRpe) : null} caption="۴ هفته اخیر · ۷ تا ۹ برای عضله‌سازی" emptyLabel="RPE ثبت نشده" icon="gauge" />
        <MetricCard label="جلسات ۴ هفته" value={fa(d.sessions28d ?? 0)} caption={'میانگین ' + fa(((d.sessions28d ?? 0) / 4).toFixed(1)) + ' جلسه در هفته'} icon="calendar" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        {t ? <VolumeChart t={t} from={t.since} to={iso(new Date())} /> : <Card title="حجم تمرین قدرتی">در حال بارگذاری…</Card>}
        <Card title="ست‌های هر عضله در این هفته" subtitle="بازه رایج عضله‌سازی: ۱۰ تا ۲۰ ست در هفته برای هر گروه عضلانی">
          {sets.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sets.map((s) => {
                const tone = s.sets < 10 ? 'var(--warning)' : s.sets > 20 ? 'var(--error)' : 'var(--success)';
                return (
                  <div key={s.category} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <span>{EX_CATS[s.category] || s.category}</span>
                    <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--surface-sunken)' }}>
                      <div
                        style={{
                          position: 'absolute',
                          insetInlineStart: (10 / max) * 100 + '%',
                          width: (10 / max) * 100 + '%',
                          top: -2,
                          bottom: -2,
                          border: '1px dashed var(--border)',
                          borderRadius: 3,
                        }}
                      />
                      <div style={{ width: (s.sets / max) * 100 + '%', height: '100%', borderRadius: 5, background: tone }} />
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>{fa(s.sets)} ست</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>در ۷ روز اخیر ستی ثبت نشده است.</p>
          )}
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <Card title="تازگی عضلات (Muscle recovery)" subtitle="روزهای گذشته از آخرین تمرین هر گروه و ست‌های ۷ روز اخیر">
          {(d.freshness || []).length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              {d.freshness.map((m: Json) => {
                // 0–1 day: still recovering (red) · 2 days: almost (amber) · 3+: fresh (green)
                const tone = m.daysSince <= 1 ? 'var(--error)' : m.daysSince === 2 ? 'var(--warning)' : 'var(--success)';
                return (
                  <div key={m.category} style={{ borderRadius: 10, padding: 10, border: '1px solid var(--border)', borderInlineStart: '4px solid ' + tone }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{EX_CATS[m.category] || m.category}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {m.daysSince === 0 ? 'امروز' : fa(m.daysSince) + ' روز پیش'} · {fa(m.sets7d)} ست
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>در ۲ هفته اخیر تمرین مقاومتی ثبت نشده است.</p>
          )}
        </Card>
        <Card title="قدرت نسبی" subtitle="۱RM تخمینی ÷ وزن بدن — برای مقایسه با استانداردها (مثلاً اسکوات ۱٫۵×، پرس سینه ۱٫۲۵×، ددلیفت ۲× برای سطح پیشرفته)">
          {(d.relative || []).length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {d.relative.map((x: Json) => (
                <div key={x.exerciseId} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px', gap: 8, fontSize: 13, alignItems: 'center' }}>
                  <span>{x.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{fa(x.e1rm)} kg</span>
                  <span style={{ fontWeight: 700 }}>{fa(x.ratio)}×</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>با ثبت وزن بدن و ست‌های وزنه‌دار محاسبه می‌شود.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
