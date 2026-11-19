// Performance & readiness (#54) at the top of the analytics overview, modelled on what athletes know
// from their watches and apps:
//  • Training Readiness (Garmin) — this morning's score from HRV/RHR vs baseline, sleep, soreness, form;
//  • Training status (Garmin) — productive / maintaining / recovery / detraining / overreaching;
//  • Weekly training load against the athlete's normal (acute:chronic ratio, #76);
//  • Consistency calendar and weekly streak;
//  • The coach's own tests (any category) with latest, best, trend — logged or designed from here.
// Everything comes from what the athlete logs; watch numbers are optional and used only when present.
import { useState } from 'react';
import { Card, ChartContainer, ChartLegend } from '@/ds';
import { remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { faDayMonth, faDigits } from '@/lib/format';
import { LoadChart, loadTable, ZONE } from './LoadChart';
import { TEST_CAT, TestLogModal, unitLabel } from './TestLogModal';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');

const LEVEL: Record<string, [string, string, string]> = {
  prime: ['آماده برای تمرین سنگین', 'var(--success)', 'بدن آماده است؛ روز خوبی برای جلسه سخت یا رکوردگیری.'],
  high: ['آماده', 'var(--success)', 'تمرین طبق برنامه.'],
  moderate: ['متوسط', 'var(--warning)', 'تمرین متوسط؛ شدت یا حجم را کمی کم کنید.'],
  low: ['پایین', 'var(--error)', 'روز سبک یا ریکاوری فعال پیشنهاد می‌شود.'],
};
const FACTOR: Record<string, string> = {
  sleep: 'خواب',
  hrv: 'HRV نسبت به پایه',
  rhr: 'ضربان استراحت نسبت به پایه',
  soreness: 'کوفتگی',
  fatigue: 'خستگی',
  stress: 'استرس',
  body_battery: 'Body Battery',
  form: 'آمادگی (فرم)',
};
const STATUS: Record<string, [string, string]> = {
  productive: ['بهره‌ور', 'آمادگی در حال افزایش است و بار تمرین مناسب است.'],
  maintaining: ['حفظ آمادگی', 'بار تمرین برای حفظ آمادگی کافی است ولی آن را بالا نمی‌برد.'],
  recovery: ['ریکاوری', 'بار کمتر از معمول؛ بدن در حال بازسازی است.'],
  detraining: ['افت آمادگی', 'چند روز است تمرین کافی انجام نشده و آمادگی کم می‌شود.'],
  overreaching: ['فشار بیش از حد', 'خستگی بسیار بالاتر از آمادگی است؛ ریسک آسیب و افت عملکرد.'],
};
const CELL: Record<string, string> = { completed: 'var(--success)', partial: 'var(--warning)', missed: 'var(--error)' };

function detail(k: string, d: Json): string {
  if (k === 'sleep') return d.value != null ? fa(d.value) + ' از ' + fa(d.target) + ' ساعت' : 'امتیاز ' + fa(d.score);
  if (k === 'hrv') return fa(d.value) + ' ms · پایه ' + fa(d.baseline);
  if (k === 'rhr') return fa(d.value) + ' bpm · پایه ' + fa(d.baseline);
  if (k === 'form') return fa(d.value);
  return fa(d.value) + (k === 'body_battery' ? '' : ' / ۱۰');
}

/** Tiny trend line for a test's last results; higher on screen = better, whatever the test's direction. */
function Spark({ points, lower }: { points: Json[]; lower: boolean }) {
  if (points.length < 2) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>;
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs),
    hi = Math.max(...vs),
    span = hi - lo || 1;
  const W = 96,
    H = 28;
  const xy = vs.map((v, i) => {
    const y = lower ? ((v - lo) / span) * (H - 4) + 2 : H - 2 - ((v - lo) / span) * (H - 4);
    return [(i / (vs.length - 1)) * (W - 4) + 2, y];
  });
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ direction: 'ltr' }} aria-hidden="true">
      <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--viz-1, var(--brand-primary))" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--viz-1, var(--brand-primary))" />
    </svg>
  );
}

function TestBoard({ athlete, board }: { athlete: { id: string; name: string }; board: Json[] }) {
  const [open, setOpen] = useState(false);
  const defs = useQuery('tests', () => remote.tests());
  const fmt = (v: number, unit: string) =>
    unit === 'min' ? fa(Math.floor(v)) + ':' + fa(String(Math.round((v % 1) * 60)).padStart(2, '0')) : fa(+v.toFixed(2)) + ' ' + unitLabel(unit);
  const cell = { padding: '10px 8px', borderTop: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' as const };
  return (
    <Card
      title="آزمون‌های اختصاصی مربی"
      subtitle="همه آزمون‌هایی که طراحی کرده‌اید، با آخرین نتیجه، بهترین رکورد و روند"
      action={{ label: 'ثبت یا طراحی آزمون', icon: 'plus', onClick: () => defs.data && setOpen(true) }}
    >
      {board.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'start' }}>
                {['آزمون', 'آخرین', 'بهترین', 'تغییر از اولین', 'روند', 'دفعات'].map((h) => (
                  <th key={h} style={{ padding: '6px 8px', fontWeight: 500, textAlign: 'start' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.map((t) => (
                <tr key={t.testId}>
                  <td style={cell} title={t.protocol || undefined}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(TEST_CAT[t.category] || 'سایر') + ' · ' + (t.better === 'lower' ? 'کمتر بهتر' : 'بیشتر بهتر') + (t.protocol ? ' · پروتکل دارد' : '')}
                    </div>
                  </td>
                  <td style={cell}>
                    {t.latest ? (
                      <>
                        <div>{fmt(t.latest.value, t.unit)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{faDayMonth(new Date(t.latest.date + 'T12:00:00'))}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>ثبت نشده</span>
                    )}
                  </td>
                  <td style={cell}>{t.best ? fmt(t.best.value, t.unit) : '—'}</td>
                  <td style={{ ...cell, fontWeight: 600, color: t.improved == null ? 'var(--text-muted)' : t.improved ? 'var(--success)' : 'var(--error)' }}>
                    {t.changePct == null ? '—' : (t.changePct > 0 ? '+' : '') + fa(t.changePct) + '٪'}
                  </td>
                  <td style={cell}>
                    <Spark points={t.points} lower={t.better === 'lower'} />
                  </td>
                  <td style={cell}>{fa(t.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>هنوز آزمونی طراحی نکرده‌اید. با «ثبت یا طراحی آزمون» اولین آزمون را بسازید.</p>
      )}
      {open && defs.data ? <TestLogModal athlete={athlete} tests={defs.data} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

export function PerformancePanel({ athlete }: { athlete: { id: string; name: string } }) {
  const athleteId = athlete.id;
  const q = useQuery('analytics:performance:' + athleteId, () => remote.analytics(athleteId, 'performance'));
  const d = q.data;
  if (!d) return null;
  const r = d.readiness;
  const lvl = r.level ? LEVEL[r.level] : null;
  const st = d.status.status ? STATUS[d.status.status] : null;
  const load: Json = d.load;
  const now: Json = load.now;
  const cons = d.consistency;
  const weeks: Json[][] = [];
  for (let i = 0; i < cons.days.length; i += 7) weeks.push(cons.days.slice(i, i + 7));
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <Card title="آمادگی امروز (Training Readiness)" subtitle={r.date ? 'از چک‌این ' + faDayMonth(new Date(r.date + 'T12:00:00')) : 'چک‌این امروز ثبت نشده'}>
          {r.score != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 44, fontWeight: 700, color: lvl?.[1] }}>{fa(r.score)}</span>
                <span style={{ fontWeight: 600, color: lvl?.[1] }}>{lvl?.[0]}</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lvl?.[2]}</span>
              {r.factors.map((f: Json) => (
                <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span>{FACTOR[f.key] || f.key}</span>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                    <div style={{ width: f.score + '%', height: '100%', background: f.score >= 60 ? 'var(--success)' : f.score >= 40 ? 'var(--warning)' : 'var(--error)' }} />
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>{detail(f.key, f.detail)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              با چک‌این صبح (خواب، کوفتگی، خستگی) و در صورت وجود ساعت ورزشی (HRV، ضربان استراحت، Body Battery) محاسبه می‌شود.
            </p>
          )}
        </Card>
        <Card title="وضعیت تمرین (Training Status)" subtitle="روند آمادگی در ۷ روز اخیر">
          {st ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{st[0]}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{st[1]}</span>
              <div className="bl-keep-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
                {[
                  ['بار ۷ روز اخیر', now.load != null ? fa(now.load) : '—', ''],
                  ['میانگین هفتگی', now.average != null ? fa(now.average) : '—', '۴ هفته قبل'],
                  ['نسبت', now.ratio != null ? fa(now.ratio) : '—', now.zone ? ZONE[now.zone].label : ''],
                ].map(([label, val, sub]) => (
                  <div key={label} style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>برای وضعیت تمرین، مدت و RPE جلسات چند هفته لازم است.</p>
          )}
        </Card>
        <Card title="تداوم" subtitle={'۱۲ هفته اخیر · هدف ' + fa(cons.target) + ' جلسه در هفته'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 3, direction: 'ltr', justifyContent: 'flex-end' }}>
              {weeks.map((wk, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {wk.map((c) => (
                    <div
                      key={c.date}
                      title={faDayMonth(new Date(c.date + 'T12:00:00')) + (c.status ? ' · ' + c.status : '')}
                      style={{ width: 14, height: 14, borderRadius: 3, background: CELL[c.status] || 'var(--surface-sunken)' }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{fa(cons.streakWeeks)} هفته</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>پشت سر هم به هدف جلسات هفتگی رسیده است.</span>
            <ChartLegend
              items={[
                { label: 'کامل', color: 'success', shape: 'bar' },
                { label: 'ناقص', color: 'warning', shape: 'bar' },
                { label: 'از دست رفته', color: 'error', shape: 'bar' },
              ]}
            />
          </div>
        </Card>
      </div>
      <ChartContainer
        table={loadTable(load.weeks)}
        title="بار تمرین هفتگی"
        summary={
          now.zone
            ? 'این هفته: ' + ZONE[now.zone].label + ' (' + fa(now.ratio) + ' برابر میانگین ۴ هفته قبل) — ' + ZONE[now.zone].advice
            : 'بار هر هفته در مقایسه با حد معمول خود ورزشکار'
        }
        footnote={
          'بار هر جلسه = مدت (دقیقه) × سختی (RPE ۱ تا ۱۰). نوار سبز کم‌رنگ = محدوده معمول هر هفته (۰٫۸ تا ۱٫۳ برابر میانگین ۴ هفته قبل).' +
          (load.nextRange ? ' پیشنهاد ۷ روز آینده: بار ' + fa(load.nextRange[0]) + ' تا ' + fa(load.nextRange[1]) + '.' : '') +
          (load.untimedSessions ? ' ' + fa(load.untimedSessions) + ' جلسه در ۴ هفته اخیر مدت ثبت‌شده ندارد و حساب نشده.' : '')
        }
      >
        {load.weeks.some((w: Json) => w.load) ? (
          <>
            <LoadChart weeks={load.weeks} />
            <ChartLegend
              items={[
                { label: ZONE.low.label, color: 'viz-muted', shape: 'bar' },
                { label: ZONE.optimal.label, color: 'success', shape: 'bar' },
                { label: ZONE.high.label, color: 'warning', shape: 'bar' },
                { label: ZONE.danger.label, color: 'error', shape: 'bar' },
              ]}
            />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            هنوز جلسه‌ای با مدت ثبت نشده. وقتی ورزشکار بعد از هر تمرین مدت و سختی (RPE) را ثبت کند، بار هفتگی و محدوده مناسب اینجا نشان داده می‌شود.
          </p>
        )}
      </ChartContainer>
      <TestBoard athlete={athlete} board={d.tests || []} />
    </section>
  );
}
