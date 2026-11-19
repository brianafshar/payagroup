// Ported from design handoff: project/C29 Coach Body Composition.dc.html
import { Fragment } from 'react';
import { Badge, Button, ChartContainer, LineChart, Modal, PageHeader, RadioGroup, Select, Sidebar, StatCard, Tabs, Tag, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { faDayMonth } from '@/lib/format';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';
import { ANALYTICS_TABS, athletePicker, goSection, useAnalyticsPage } from './analytics';

/** Data container: the athlete's measurements, goal weight and measurement schedule. */
export default function CoachBodyCompositionPage(props: { brand?: string }) {
  const { empty, props: p } = useAnalyticsPage('body', 'analytics', 'ترکیب بدن');
  return empty ?? <CoachBodyComposition key={p.athlete.id} {...props} {...p} />;
}

const F: Array<[string, string, string, string, string | null]> = [
  // ui key, API metric, label, unit, good direction
  ['w', 'weight', 'وزن', 'kg', null],
  ['f', 'bodyFat', 'چربی بدن', '٪', 'down'],
  ['m', 'muscleMass', 'توده عضلانی', 'kg', 'up'],
  ['ch', 'chest', 'سینه', 'cm', null],
  ['wa', 'waist', 'دور کمر', 'cm', 'down'],
  ['ar', 'arm', 'بازو', 'cm', null],
  ['th', 'thigh', 'ران', 'cm', null],
  ['hi', 'hip', 'باسن', 'cm', null],
  ['ca', 'calf', 'ساق', 'cm', null],
  ['ne', 'neck', 'گردن', 'cm', null],
];
const DEFAULT_SCHEDULE = { freq: 'w1', n: 6, day: 'fr', remind: 'morning', req: ['w', 'f', 'wa'] };
const JS_DAY = { sa: 6, su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5 };
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (s: string) => new Date(s + 'T12:00:00');

class CoachBodyComposition extends Screen {
  state: ScreenState = { log: false, draft: {}, sOpen: false, sDraft: null, saving: false };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const en = (s) =>
      String(s || '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace('٫', '.')
        .replace(/[^\d.]/g, '');
    const { log, draft, sOpen, sDraft, saving } = this.state;
    const { athlete: a, athletes, data: d } = this.props;
    const DAYN = { sa: 'شنبه', su: 'یکشنبه', mo: 'دوشنبه', tu: 'سه‌شنبه', we: 'چهارشنبه', th: 'پنجشنبه', fr: 'جمعه' };
    const FREQ = { w1: ['هر هفته', 1], w2: ['هر ۲ هفته', 2], w3: ['هر ۳ هفته', 3], m1: ['هر ماه', 4], custom: ['سفارشی', 0] };
    const cfg = { ...DEFAULT_SCHEDULE, ...(d.schedule || {}) };
    const sd = sDraft || cfg;
    const wk = cfg.freq === 'custom' ? cfg.n : FREQ[cfg.freq][1];
    const freqLabel = (c) => (c.freq === 'custom' ? 'هر ' + fa(c.n) + ' هفته' : FREQ[c.freq][0]);
    const FL = { w: 'وزن', f: 'چربی', m: 'عضله', ch: 'سینه', wa: 'کمر', ar: 'بازو', th: 'ران', hi: 'باسن', ca: 'ساق', ne: 'گردن' };
    const entries = d.entries.slice(-8);
    const dates = entries.map((e) => faDayMonth(day(e.date)));
    const ser = (metric) => entries.map((e) => e.values[metric] ?? null);
    // Next due date: the schedule's weekday, `wk` weeks after the last measurement (or the next one from today).
    const last = d.entries.length ? day(d.entries[d.entries.length - 1].date) : null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    let next = new Date(last && cfg.freq !== 'm1' ? last.getTime() + (wk * 7 - 6) * 86400000 : today.getTime());
    if (cfg.freq === 'm1' && last) next = new Date(last.getFullYear(), last.getMonth() + 1, 1, 12);
    if (next < today) next = today;
    while (next.getDay() !== JS_DAY[cfg.day]) next = new Date(next.getTime() + 86400000);
    const daysAhead = Math.round((next.getTime() - today.getTime()) / 86400000);
    const doneThisCycle = !!last && (today.getTime() - last.getTime()) / 86400000 < 7;
    const stats = F.map(([, metric, label, unit, good]) => {
      const v = ser(metric);
      const idx = v.map((x, i) => (x != null ? i : -1)).filter((i) => i > -1);
      const li = idx[idx.length - 1],
        pi = idx[idx.length - 2];
      if (li == null) return { label, unit, none: true, cur: '', date: '', prev: '', prevDate: '', change: null, cu: '', good: good || 'none', spark: [] };
      return {
        label,
        unit,
        none: false,
        cur: fa(v[li]),
        date: dates[li],
        prev: pi != null ? fa(v[pi]) : '',
        prevDate: pi != null ? dates[pi] : '',
        change: pi != null ? +(v[li] - v[pi]).toFixed(1) : null,
        cu: metric === 'bodyFat' ? 'واحد' : unit,
        good: good || 'none',
        spark: ['weight', 'bodyFat', 'muscleMass'].includes(metric) ? v.filter((x) => x != null).slice(-6) : [],
      };
    });
    const w = ser('weight').filter((x) => x != null),
      f = ser('bodyFat').filter((x) => x != null);
    const spanWeeks = entries.length > 1 ? Math.max(1, (day(entries[entries.length - 1].date).getTime() - day(entries[0].date).getTime()) / (7 * 86400000)) : 1;
    const dW = w.length > 1 ? +(w[w.length - 1] - w[0]).toFixed(1) : 0,
      dF = f.length > 1 ? +(f[f.length - 1] - f[0]).toFixed(1) : 0;
    const perWeek = Math.abs(dW / spanWeeks).toFixed(1);
    const goal = d.goalWeightKg;
    const period = entries.length ? 'از ' + dates[0] : '';
    const setSD = (patch) => this.setState({ sDraft: { ...sd, ...patch } });
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'تحلیل‌ها', to: 'coach:analytics?id=' + a.id }, a.name, 'ترکیب بدن'],
      subtitle: a.name + ' · اندازه‌گیری ' + freqLabel(cfg) + '، ' + DAYN[cfg.day] + ' · مقادیر فقط از داده‌های ثبت‌شده نمایش داده می‌شوند.',
      backTo: 'coach:analytics?id=' + a.id,
      exportIt: () => {
        const lines = ['date,recorded_by,' + F.map((x) => x[1]).join(','), ...d.entries.map((e) => [e.date, e.recordedBy, ...F.map((x) => e.values[x[1]] ?? '')].join(','))];
        const el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        el.download = 'body-' + a.id + '.csv';
        el.click();
        toast('خروجی آماده شد', 'ترکیب-بدن-' + a.name + '.csv');
      },
      ath: a.id,
      ...athletePicker(athletes, 'body'),
      tabs: ANALYTICS_TABS,
      goTab: (id) => goSection(id, a.id),
      schedTitle: 'اندازه‌گیری ' + freqLabel(cfg) + ' · ' + DAYN[cfg.day] + (cfg.freq === 'm1' ? ' اول هر ماه' : '') + (d.customSchedule ? '' : ' · پیش‌فرض شما'),
      schedSub:
        'اندازه‌گیری بعدی: ' +
        next.toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }) +
        ' · ' +
        fa(cfg.req.length) +
        ' شاخص · ' +
        (cfg.remind === 'off' ? 'بدون یادآوری' : 'یادآوری ' + { eve: 'شب قبل', morning: 'صبح همان روز', both: 'شب قبل و صبح همان روز' }[cfg.remind]),
      dueLabel: doneThisCycle ? 'انجام شد' : daysAhead <= 3 ? fa(daysAhead) + ' روز مانده' : 'برنامه‌ریزی‌شده',
      dueTone: doneThisCycle ? 'success' : daysAhead <= 3 ? 'warning' : 'neutral',
      schedOpen: sOpen,
      schedDesc: 'برای ' + a.name + '. ورزشکار در روز تعیین‌شده یادآوری می‌گیرد و خودش اندازه‌ها را ثبت می‌کند.',
      openSched: () => this.setState({ sOpen: true, sDraft: { ...cfg } }),
      closeSched: () => this.setState({ sOpen: false, sDraft: null }),
      saveSched: async () => {
        try {
          await api.athletes.update(a.id, { measureSchedule: { freq: sd.freq, n: sd.n, day: sd.day, remind: sd.remind, req: sd.req } });
        } catch (e) {
          return toast('ذخیره نشد', faError(e), 'error');
        }
        this.setState({ sOpen: false, sDraft: null });
        toast('زمان‌بندی ذخیره شد', a.name + ' · ' + freqLabel(sd) + '، ' + DAYN[sd.day]);
      },
      sFreq: sd.freq,
      freqOpts: Object.keys(FREQ).map((k) => ({
        value: k,
        label: FREQ[k][0],
        description: k === 'custom' ? 'تعداد هفته را خودتان تعیین کنید' : k === 'm1' ? 'روز انتخاب‌شده در هفته اول هر ماه' : undefined,
      })),
      setFreq: (v) => setSD({ freq: v }),
      isCustom: sd.freq === 'custom',
      nLabel: 'هر ' + fa(sd.n) + ' هفته',
      nDec: () => setSD({ n: Math.max(2, sd.n - 1) }),
      nInc: () => setSD({ n: Math.min(12, sd.n + 1) }),
      dayLabel: sd.freq === 'm1' ? 'روز (هفته اول ماه)' : 'روز اندازه‌گیری',
      sDay: sd.day,
      dayOpts: Object.keys(DAYN).map((k) => ({ value: k, label: DAYN[k] })),
      setDay: (v) => setSD({ day: v }),
      sRemind: sd.remind,
      remindOpts: [
        { value: 'eve', label: 'شب قبل' },
        { value: 'morning', label: 'صبح همان روز' },
        { value: 'both', label: 'هر دو' },
        { value: 'off', label: 'بدون یادآوری' },
      ],
      setRemind: (v) => setSD({ remind: v }),
      reqChips: Object.keys(FL).map((k) => ({
        label: FL[k],
        on: sd.req.includes(k),
        toggle: () => setSD({ req: sd.req.includes(k) ? sd.req.filter((x) => x !== k) : [...sd.req, k] }),
      })),
      reqNote: sd.req.length ? fa(sd.req.length) + ' شاخص اجباری · بقیه برای ورزشکار اختیاری است' : 'همه شاخص‌ها اختیاری است',
      stats,
      n200: 200,
      n170: 170,
      n560: 560,
      dates,
      wSeries: [{ name: 'وزن', values: ser('weight') }],
      wTarget: goal ? { value: goal, label: 'هدف ' + fa(goal) + ' kg' } : undefined,
      wSummary:
        w.length < 2
          ? 'برای نمایش روند حداقل دو اندازه‌گیری وزن لازم است.'
          : (dW === 0
              ? 'وزن ' + period + ' تغییری نکرده است.'
              : 'وزن ' + period + ' ' + fa(Math.abs(dW)) + ' کیلوگرم ' + (dW > 0 ? 'افزایش' : 'کاهش') + ' یافته، یعنی هفته‌ای حدود ' + fa(perWeek) + ' کیلوگرم.') +
            (goal ? ' هدف: ' + fa(goal) + ' کیلوگرم.' : ''),
      fSeries: [{ name: 'چربی بدن', values: ser('bodyFat'), color: 'viz-3' }],
      fSummary:
        f.length < 2
          ? 'برای نمایش روند حداقل دو اندازه‌گیری چربی لازم است.'
          : (dF === 0 ? 'درصد چربی ' + period + ' تغییری نکرده است.' : 'درصد چربی ' + period + ' ' + fa(Math.abs(dF)) + ' درصد ' + (dF > 0 ? 'افزایش' : 'کاهش') + ' یافته است.') +
            (dW > 0 && dF < 0
              ? ' چون وزن بالا رفته ولی چربی کم شده، بیشتر وزن اضافه‌شده عضله است.'
              : dW < 0 && dF < 0
                ? ' همراه با کم شدن وزن؛ یعنی بیشتر کاهش وزن از چربی بوده است.'
                : ''),
      logOpen: log,
      logDesc: 'معمولاً ' + a.name + ' خودش در اپ ثبت می‌کند. این اندازه‌گیری با برچسب «ثبت توسط مربی» ذخیره می‌شود. فیلدهای خالی «ثبت نشده» می‌مانند.',
      openLog: () => this.setState({ log: true, draft: {} }),
      closeLog: () => this.setState({ log: false }),
      logFields: F.map(([k, metric, label, unit]) => {
        const v = ser(metric).filter((x) => x != null);
        return { label, unit, value: draft[k] || '', ph: v.length ? fa(v[v.length - 1]) : '', set: (val) => this.setState({ draft: { ...this.state.draft, [k]: val } }) };
      }),
      logEmpty: !Object.values(draft).some((v) => +en(v) > 0) || saving,
      saveLog: async () => {
        const values = F.filter(([k]) => +en(draft[k]) > 0).map(([k, metric]) => ({ metric, value: +en(draft[k]) }));
        this.setState({ saving: true });
        try {
          await remote.addMeasurements(a.id, iso(new Date()), values);
        } catch (e) {
          this.setState({ saving: false });
          return toast('ثبت نشد', faError(e), 'error');
        }
        this.setState({ log: false, saving: false });
        toast('اندازه‌گیری ثبت شد', fa(values.length) + ' شاخص برای ' + a.name);
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="analytics" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {v.schedOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal title="زمان‌بندی اندازه‌گیری" description={v.schedDesc} primaryLabel="ذخیره" secondaryLabel="انصراف" onPrimary={v.saveSched} onClose={v.closeSched}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <RadioGroup label="تناوب" value={v.sFreq} options={v.freqOpts} onChange={v.setFreq} />
                      {v.isCustom ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '220px' }}>
                            <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>هر چند هفته یک‌بار</span>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '40px',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface)',
                                overflow: 'hidden',
                              }}
                            >
                              <button
                                type="button"
                                onClick={v.nDec}
                                aria-label="کاهش"
                                style={{
                                  width: '40px',
                                  height: '100%',
                                  border: '0',
                                  background: 'var(--surface-sunken)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  font: "600 18px/1 'Vazirmatn',sans-serif",
                                }}
                              >
                                −
                              </button>
                              <span style={{ flex: '1', textAlign: 'center', font: "600 15px/1 'Vazirmatn',sans-serif" }}>{v.nLabel}</span>
                              <button
                                type="button"
                                onClick={v.nInc}
                                aria-label="افزایش"
                                style={{
                                  width: '40px',
                                  height: '100%',
                                  border: '0',
                                  background: 'var(--surface-sunken)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  font: "600 18px/1 'Vazirmatn',sans-serif",
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }}>
                        <Select label={v.dayLabel} value={v.sDay} options={v.dayOpts} onChange={v.setDay} />
                        <Select label="یادآوری در اپ ورزشکار" value={v.sRemind} options={v.remindOpts} onChange={v.setRemind} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>شاخص‌هایی که ورزشکار باید ثبت کند</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(v.reqChips || []).map((c: any, $index: number) => (
                            <Fragment key={$index}>
                              <div onClick={c?.toggle} style={{ display: 'flex', cursor: 'pointer' }}>
                                <Tag variant="filter" selected={c?.on}>
                                  {c?.label}
                                </Tag>
                              </div>
                            </Fragment>
                          ))}
                        </div>
                        <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.reqNote}</span>
                      </div>
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
            {v.logOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title="ثبت اندازه‌گیری"
                    description={v.logDesc}
                    primaryLabel="ثبت"
                    primaryDisabled={v.logEmpty}
                    secondaryLabel="انصراف"
                    onPrimary={v.saveLog}
                    onClose={v.closeLog}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '12px' }}>
                      {(v.logFields || []).map((f: any, $index: number) => (
                        <Fragment key={$index}>
                          <TextField label={f?.label} value={f?.value} suffix={f?.unit} placeholder={f?.ph} optional onChange={f?.set} size="sm" />
                        </Fragment>
                      ))}
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="ترکیب بدن" subtitle={v.subtitle} back="تحلیل‌ها" backTo={v.backTo}>
            <Button variant="secondary" icon="calendar" onClick={v.openSched}>
              زمان‌بندی اندازه‌گیری
            </Button>
            <Button variant="secondary" icon="plus" onClick={v.openLog}>
              ثبت اندازه‌گیری
            </Button>
            <Button variant="secondary" icon="download" onClick={v.exportIt}>
              خروجی
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '220px' }}>
              <Select value={v.ath} icon="user" options={v.athOpts} onChange={v.setAth} />
            </div>
            <div style={{ minWidth: '0', flex: '1 1 auto', overflowX: 'auto' }}>
              <Tabs variant="pill" value="body" tabs={v.tabs} onChange={v.goTab} />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              minWidth: '0',
            }}
          >
            <span
              style={{
                width: '36px',
                height: '36px',
                flexShrink: '0',
                borderRadius: '10px',
                background: 'var(--brand-primary-subtle)',
                color: 'var(--brand-primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              ⏲
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
              <span style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '600' }}>{v.schedTitle}</span>
              <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.schedSub}</span>
            </div>
            <Badge tone={v.dueTone} size="sm">
              {v.dueLabel}
            </Badge>
            <Button variant="ghost" size="sm" icon="edit" onClick={v.openSched}>
              تغییر
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '16px', alignItems: 'stretch' }}>
            {(v.stats || []).map((s: any, $index: number) => (
              <Fragment key={$index}>
                <StatCard
                  label={s?.label}
                  current={s?.cur}
                  unit={s?.unit}
                  date={s?.date}
                  previous={s?.prev}
                  previousDate={s?.prevDate}
                  change={s?.change}
                  changeUnit={s?.cu}
                  goodDirection={s?.good}
                  spark={s?.spark}
                  sparkWidth={v.n170}
                  notRecorded={s?.none}
                />
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <ChartContainer title="وزن بدن" summary={v.wSummary}>
              <LineChart labels={v.dates} series={v.wSeries} unit="kg" height={v.n200} width={v.n560} target={v.wTarget} area />
            </ChartContainer>
            <ChartContainer title="درصد چربی" summary={v.fSummary}>
              <LineChart labels={v.dates} series={v.fSeries} unit="٪" height={v.n200} width={v.n560} />
            </ChartContainer>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
