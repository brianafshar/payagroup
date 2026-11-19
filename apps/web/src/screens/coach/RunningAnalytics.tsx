// Running analytics (#44), Garmin Connect–style, for C28: weekly distance, pace, training load
// (acute:chronic), heart-rate zones, VO₂max (VDOT) and race predictions — all from logged runs.
// The coach can correct any run's inputs (distance, time, HR, cadence, elevation, RPE) and the athlete's max HR.
import { useState } from 'react';
import { BarChart, Button, Card, ChartContainer, LineChart, MetricCard, Modal, Table, TextField } from '@/ds';
import { api, faError, remote } from '@/data/api';
import { faDayMonth, faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');
const en = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('٫', '.');
/** 5.25 (min) → «۵:۱۵» */
export function mmss(min: number | null | undefined): string {
  if (min == null) return '—';
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return fa((h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'));
}
const RACE: Record<string, string> = { '5k': '۵ کیلومتر', '10k': '۱۰ کیلومتر', half: 'نیمه‌ماراتن', marathon: 'ماراتن' };
const LOAD: Record<string, [string, string]> = {
  low: ['کم', 'بار این هفته کمتر از میانگین ۴ هفته است؛ آمادگی ممکن است افت کند.'],
  optimal: ['بهینه', 'بار این هفته با میانگین ۴ هفته هماهنگ است (۰٫۸ تا ۱٫۳).'],
  high: ['زیاد', 'افزایش سریع بار (۱٫۳ تا ۱٫۵)؛ ریکاوری را زیر نظر بگیرید.'],
  very_high: ['پرخطر', 'بار بیش از ۱٫۵ برابر میانگین؛ ریسک آسیب بالاست.'],
};
const ZONE = ['ناحیه ۱ · گرم‌کردن', 'ناحیه ۲ · آسان', 'ناحیه ۳ · هوازی', 'ناحیه ۴ · آستانه', 'ناحیه ۵ · حداکثر'];
const ZONE_COLOR = ['var(--viz-5, #9aa4b2)', 'var(--viz-2)', 'var(--viz-1)', 'var(--warning)', 'var(--error)'];

const FIELDS: Array<[string, string, string]> = [
  ['km', 'مسافت', 'km'],
  ['minutes', 'مدت', 'دقیقه'],
  ['avgHr', 'میانگین ضربان', 'bpm'],
  ['maxHr', 'حداکثر ضربان', 'bpm'],
  ['cadence', 'کادنس', 'قدم/دقیقه'],
  ['elevation', 'صعود', 'متر'],
  ['rpe', 'RPE', '۱–۱۰'],
  // from the athlete's watch
  ['aerobicTe', 'Training Effect هوازی', '۰–۵'],
  ['anaerobicTe', 'Training Effect بی‌هوازی', '۰–۵'],
  ['ltHr', 'ضربان آستانه لاکتات', 'bpm'],
  ['ltPace', 'سرعت آستانه لاکتات', 'دقیقه/کیلومتر'],
];
const DECIMAL = new Set(['km', 'aerobicTe', 'anaerobicTe', 'ltPace']);
const API_KEY: Record<string, string> = {
  km: 'distanceKm',
  minutes: 'durationMin',
  avgHr: 'avgHr',
  maxHr: 'maxHr',
  cadence: 'cadenceSpm',
  elevation: 'elevationM',
  rpe: 'rpe',
  aerobicTe: 'aerobicTe',
  anaerobicTe: 'anaerobicTe',
  ltHr: 'ltHr',
  ltPace: 'ltPace',
};

export function RunningAnalytics({ data: r, athlete, onChanged }: { data: Json; athlete: Json; onChanged?: () => void }) {
  const [edit, setEdit] = useState<Json | null>(null);
  const [hrOpen, setHrOpen] = useState(false);
  const [hrVal, setHrVal] = useState('');
  const [saving, setSaving] = useState(false);
  const t = r.totals;
  const runs: Json[] = r.runs || [];
  if (!runs.length && !r.weeks.some((w: Json) => w.km))
    return (
      <Card title="تحلیل دویدن" subtitle="از جلسات دویدن ثبت‌شده">
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          هنوز دویدنی ثبت نشده. وقتی ورزشکار جلسه‌ای با حرکت دویدن (مسافت) تمام کند یا مسافت را وارد کند، مسافت هفتگی، پیس، بار تمرینی، نواحی ضربان، VO₂max و پیش‌بینی مسابقه اینجا
          نمایش داده می‌شود.
        </p>
      </Card>
    );

  const load = r.load.status ? LOAD[r.load.status] : null;
  const zoneTotal = r.hr.zones.reduce((a: number, b: number) => a + b, 0);
  const paced = runs.filter((x) => x.pace);

  const saveRun = async () => {
    if (!edit) return;
    setSaving(true);
    const body: Json = {};
    for (const [k] of FIELDS) {
      const raw = en(String(edit[k] ?? '')).trim();
      body[API_KEY[k]] = raw === '' ? null : DECIMAL.has(k) ? Number(raw) : Math.round(Number(raw));
    }
    try {
      await remote.updateSessionMetrics(edit.id, body);
      toast('جلسه به‌روز شد', faDayMonth(new Date(edit.date + 'T12:00:00')));
      setEdit(null);
      onChanged?.();
    } catch (e) {
      toast('ذخیره نشد', faError(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  const saveMaxHr = async () => {
    const n = Number(en(hrVal));
    setSaving(true);
    try {
      await api.athletes.update(athlete.id, { maxHr: hrVal.trim() ? Math.round(n) : null });
      toast('حداکثر ضربان ذخیره شد', hrVal.trim() ? fa(Math.round(n)) + ' bpm' : 'از تخمین سنی استفاده می‌شود');
      setHrOpen(false);
      onChanged?.();
    } catch (e) {
      toast('ذخیره نشد', faError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, lineHeight: '28px', fontWeight: 600 }}>تحلیل دویدن</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
        <MetricCard label="مسافت ۷ روز" value={fa(t.km7d)} unit="km" caption={'۳۰ روز: ' + fa(t.km30d) + ' km · ' + fa(t.runs30d) + ' دویدن'} icon="activity" />
        <MetricCard
          label="میانگین پیس"
          value={t.avgPace ? mmss(t.avgPace) : null}
          unit="/km"
          caption={t.bestPace ? 'بهترین: ' + mmss(t.bestPace) + ' /km' : undefined}
          icon="clock"
        />
        <MetricCard
          label="VO₂max تخمینی"
          value={r.vo2max ? fa(r.vo2max) : null}
          unit="ml/kg/min"
          caption={r.best ? 'از ' + fa(r.best.km) + ' km در ' + mmss(r.best.minutes) + ' · ' + faDayMonth(new Date(r.best.date + 'T12:00:00')) : undefined}
          emptyLabel="دویدن ۳ کیلومتر به بالا لازم است"
          icon="heart"
        />
        <MetricCard
          label="بار تمرینی (حاد : مزمن)"
          value={r.load.ratio != null ? fa(r.load.ratio) : null}
          caption={load ? load[0] + ' · ' + load[1] : undefined}
          emptyLabel="RPE و مدت جلسات لازم است"
          icon="gauge"
        />
        <MetricCard label="طولانی‌ترین دویدن" value={t.longestKm ? fa(t.longestKm) : null} unit="km" caption="در ۹۰ روز اخیر" icon="trending-up" />
        <MetricCard label="کادنس میانگین" value={t.avgCadence ? fa(t.avgCadence) : null} unit="قدم/دقیقه" caption="هدف معمول ۱۷۰–۱۸۰" emptyLabel="ثبت نشده" icon="activity" />
        <MetricCard label="صعود ۳۰ روز" value={t.elevation30d ? fa(t.elevation30d) : null} unit="متر" emptyLabel="ثبت نشده" icon="trending-up" />
        <MetricCard
          label="حداکثر ضربان"
          value={r.hr.max ? fa(r.hr.max) : null}
          unit="bpm"
          caption={r.hr.max ? (r.hr.estimated ? 'تخمین از سن (۲۰۸ − ۰٫۷ × سن)' : 'اندازه‌گیری‌شده') : undefined}
          emptyLabel="تاریخ تولد یا حداکثر ضربان لازم است"
          icon="heart"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <ChartContainer title="مسافت هفتگی" summary={'۱۲ هفته اخیر · مجموع ' + fa(Math.round(r.weeks.reduce((a: number, w: Json) => a + w.km, 0))) + ' km'}>
          <BarChart
            labels={r.weeks.map((w: Json) => faDayMonth(new Date(w.weekStart + 'T12:00:00')))}
            series={[{ name: 'مسافت', values: r.weeks.map((w: Json) => w.km), color: 'viz-1' }]}
            unit="km"
            height={200}
            width={560}
            maxBar={28}
          />
        </ChartContainer>
        <ChartContainer title="پیس هر دویدن" summary="دقیقه در هر کیلومتر · پایین‌تر = سریع‌تر" footnote="پیس = مدت ÷ مسافت">
          <LineChart
            labels={paced.map((x) => faDayMonth(new Date(x.date + 'T12:00:00')))}
            series={[{ name: 'پیس', values: paced.map((x) => x.pace), color: 'viz-2' }]}
            unit="min/km"
            height={200}
            width={560}
            points
          />
        </ChartContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <Card
          title="نواحی ضربان قلب"
          subtitle={'دقیقه‌ها در هر ناحیه (بر اساس میانگین ضربان هر جلسه)' + (r.hr.max ? ' · حداکثر ' + fa(r.hr.max) + ' bpm' : '')}
          actionLabel="تنظیم حداکثر ضربان"
          onAction={() => (setHrVal(athlete.maxHr ? fa(athlete.maxHr) : ''), setHrOpen(true))}
        >
          {zoneTotal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.hr.zones.map((m: number, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <span>{ZONE[i]}</span>
                  <div style={{ height: 10, borderRadius: 5, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                    <div style={{ width: (m / zoneTotal) * 100 + '%', height: '100%', background: ZONE_COLOR[i] }} />
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {fa(m)} دقیقه · ٪{fa(Math.round((m / zoneTotal) * 100))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>برای نواحی ضربان، میانگین ضربان جلسات و حداکثر ضربان (یا تاریخ تولد) لازم است.</p>
          )}
        </Card>
        <Card title="پیش‌بینی زمان مسابقه" subtitle={r.best ? 'از بهترین دویدن اخیر (فرمول ریگل)' : 'به یک دویدن ۳ کیلومتر به بالا با زمان ثبت‌شده نیاز است'}>
          {r.predictions.length ? (
            <Table
              columns={[
                { key: 'race', label: 'مسافت' },
                { key: 'time', label: 'زمان پیش‌بینی', type: 'mono' },
                { key: 'pace', label: 'پیس', type: 'mono' },
              ]}
              rows={r.predictions.map((p: Json) => ({ race: RACE[p.race], time: mmss(p.minutes), pace: mmss(p.minutes / p.km) + ' /km' }))}
            />
          ) : null}
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        <Card title="بهترین رکوردها (Best efforts)" subtitle="سریع‌ترین پیس در دویدن‌های هم‌اندازه یا بلندتر · ۹۰ روز">
          {r.bestEfforts?.length ? (
            <Table
              columns={[
                { key: 'race', label: 'مسافت' },
                { key: 'time', label: 'زمان', type: 'mono' },
                { key: 'date', label: 'تاریخ' },
              ]}
              rows={r.bestEfforts.map((b: Json) => ({
                race: RACE[b.race] || (b.race === '1k' ? '۱ کیلومتر' : b.race),
                time: mmss(b.minutes),
                date: faDayMonth(new Date(b.date + 'T12:00:00')),
              }))}
            />
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>هنوز دویدنی با زمان ثبت نشده.</p>
          )}
        </Card>
        <Card title="تمرکز بار (Load focus)" subtitle="دقیقه‌ها بر اساس ناحیه ضربان — تعادل هوازی پایه، هوازی شدید و بی‌هوازی">
          {r.loadFocus && r.loadFocus.lowAerobic + r.loadFocus.highAerobic + r.loadFocus.anaerobic > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(
                [
                  ['lowAerobic', 'هوازی پایه (ناحیه ۱–۲)', 'var(--viz-2)'],
                  ['highAerobic', 'هوازی شدید (ناحیه ۳–۴)', 'var(--viz-1)'],
                  ['anaerobic', 'بی‌هوازی (ناحیه ۵)', 'var(--error)'],
                ] as const
              ).map(([k, label, color]) => {
                const tot = r.loadFocus.lowAerobic + r.loadFocus.highAerobic + r.loadFocus.anaerobic;
                return (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span>{label}</span>
                    <div style={{ height: 10, borderRadius: 5, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                      <div style={{ width: (r.loadFocus[k] / tot) * 100 + '%', height: '100%', background: color }} />
                    </div>
                    <span>٪{fa(Math.round((r.loadFocus[k] / tot) * 100))}</span>
                  </div>
                );
              })}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>برای دونده‌های استقامتی معمولاً حدود ۸۰٪ هوازی پایه توصیه می‌شود.</span>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>با ثبت میانگین ضربان دویدن‌ها نمایش داده می‌شود.</p>
          )}
        </Card>
        <ChartContainer title="مسافت ماهانه" summary="۶ ماه اخیر">
          <BarChart
            labels={(r.months || []).map((m: Json) => new Date(m.month + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { month: 'short' }))}
            series={[{ name: 'مسافت', values: (r.months || []).map((m: Json) => m.km), color: 'viz-2' }]}
            unit="km"
            height={160}
            width={340}
            maxBar={28}
          />
        </ChartContainer>
      </div>
      <Card title="دویدن‌های اخیر" subtitle="برای اصلاح مسافت، زمان، ضربان، کادنس یا RPE روی «ویرایش» بزنید.">
        <Table
          columns={[
            { key: 'd', label: 'تاریخ' },
            { key: 'f', label: 'جلسه' },
            { key: 'km', label: 'مسافت' },
            { key: 'tm', label: 'زمان', type: 'mono' },
            { key: 'p', label: 'پیس', type: 'mono' },
            { key: 'hr', label: 'ضربان (میانگین/حداکثر)' },
            { key: 'cad', label: 'کادنس' },
            { key: 'st', label: 'طول گام' },
            { key: 'rpe', label: 'RPE' },
            { key: 'x', label: '', type: 'actions', width: 48 },
          ]}
          rows={runs
            .slice()
            .reverse()
            .map((x) => ({
              id: String(x.id),
              d: faDayMonth(new Date(x.date + 'T12:00:00')),
              f: x.focus || 'دویدن',
              km: fa(x.km) + ' km',
              tm: x.minutes ? mmss(x.minutes) : '—',
              p: x.pace ? mmss(x.pace) : '—',
              hr: x.avgHr || x.maxHr ? (x.avgHr ? fa(x.avgHr) : '—') + ' / ' + (x.maxHr ? fa(x.maxHr) : '—') : 'ثبت نشده',
              cad: x.cadence ? fa(x.cadence) : '—',
              st: x.strideM ? fa(x.strideM) + ' m' : '—',
              rpe: x.rpe ? fa(x.rpe) : '—',
              x: '',
              actions: [{ icon: 'edit', label: 'ویرایش', onClick: () => setEdit({ ...x, ...Object.fromEntries(FIELDS.map(([k]) => [k, x[k] != null ? fa(x[k]) : ''])) }) }],
            }))}
        />
      </Card>
      {edit ? (
        <Modal
          title={'ویرایش دویدن · ' + faDayMonth(new Date(edit.date + 'T12:00:00'))}
          description="تغییرات در همه تحلیل‌ها اعمال می‌شود."
          primaryLabel="ذخیره"
          secondaryLabel="انصراف"
          onPrimary={saveRun}
          onClose={() => setEdit(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
            {FIELDS.map(([k, label, suffix]) => (
              <TextField key={k} label={label} suffix={suffix} value={edit[k]} inputMode="decimal" optional onChange={(v) => setEdit((e) => ({ ...e, [k]: v }))} />
            ))}
          </div>
          {saving ? <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>در حال ذخیره…</p> : null}
        </Modal>
      ) : null}
      {hrOpen ? (
        <Modal
          title="حداکثر ضربان قلب"
          description="اگر از آزمون یا ساعت ورزشی مقدار واقعی را دارید وارد کنید؛ خالی = تخمین از سن."
          primaryLabel="ذخیره"
          secondaryLabel="انصراف"
          onPrimary={saveMaxHr}
          onClose={() => setHrOpen(false)}
        >
          <TextField label="حداکثر ضربان" suffix="bpm" value={hrVal} inputMode="numeric" optional onChange={setHrVal} />
        </Modal>
      ) : null}
      <div>
        <Button
          variant="ghost"
          icon="help"
          onClick={() => toast('روش محاسبه', 'VO₂max: فرمول دنیلز (VDOT) · پیش‌بینی: ریگل (T₂ = T₁ × (D₂/D₁)^۱٫۰۶) · بار: مدت × RPE (فاستر) · نواحی: درصد حداکثر ضربان.', 'info')}
        >
          روش محاسبه
        </Button>
      </div>
    </section>
  );
}
