// Ported from design handoff: project/C25 Coach Recovery Plan.dc.html
import { Fragment } from 'react';
import { Banner, Button, Card, IconButton, PageHeader, Select, Sidebar, Slider, Switch, Table, Tag, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { NoAthletePage, pending } from '@/app/pending';
import { api, faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { AthleteSwitcher } from './AthleteSwitcher';
import { RecoveryTrends, WatchTrends } from './RecoveryTrends';
import { go, param } from '@/lib/nav';
import { panelUser } from '@/data/session';
import { Screen } from '../Screen';

/** UI key ↔ API check name, and the weekday codes (UI sa…fr ↔ API sat…fri). */
const CHECK = { s: 'sleep', q: 'quality', e: 'energy', t: 'stress', o: 'soreness', f: 'fatigue' };
/** Optional numbers from a sports watch (#54): asked only when switched on. */
const WATCH: Array<[string, string]> = [
  ['rhr', 'ضربان استراحت (bpm)'],
  ['hrv', 'HRV شبانه (ms)'],
  ['sleep_score', 'امتیاز خواب ساعت (۰–۱۰۰)'],
  ['body_battery', 'Body Battery صبح (۰–۱۰۰)'],
  ['spo2', 'اکسیژن خون SpO₂ (٪)'],
  ['steps', 'قدم‌های دیروز'],
];
const KINDS = [
  { value: 'scale', label: 'امتیاز ۱ تا ۱۰' },
  { value: 'number', label: 'عدد' },
  { value: 'yesno', label: 'بله / خیر' },
  { value: 'text', label: 'متن کوتاه' },
];
const DAY = { sa: 'sat', su: 'sun', mo: 'mon', tu: 'tue', we: 'wed', th: 'thu', fr: 'fri' };
const invert = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));

/** Data container: the athlete in `?id=` (or the first one), their recovery plan and last check-ins. */
export default function CoachRecoveryPlanPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const id = param('id') || athletes.data?.find((a) => a.userId)?.id || '';
  const plan = useQuery('recovery-plan:' + id, () => (id ? remote.recoveryPlan(id) : Promise.resolve(null)));
  const recent = useQuery('recovery-analytics:' + id + ':30', () => (id ? remote.analytics(id, 'recovery', 30) : Promise.resolve(null)));
  const wait = pending(athletes, plan, recent);
  if (wait) return wait;
  if (!id) return <NoAthletePage active="recovery" title="ریکاوری" />;
  return <CoachRecoveryPlan key={id} {...props} athlete={athletes.data?.find((a) => a.id === id)} athletes={athletes.data} livePlan={plan.data} recent={recent.data} />;
}

function toState(p) {
  const days = invert(DAY);
  return {
    sleep: p.sleepHours,
    water: p.waterL,
    stretch: p.stretchMin,
    rest: (p.restDays || []).map((d) => days[d]).filter(Boolean),
    note: p.note || '',
    checks: Object.fromEntries(Object.keys(CHECK).map((k) => [k, (p.checks || []).includes(CHECK[k])])),
    watch: Object.fromEntries(WATCH.map(([k]) => [k, (p.checks || []).includes(k)])),
    custom: (p.customFields || []).map((f) => ({ ...f })),
    alertAt: String(p.sorenessAlert),
  };
}

class CoachRecoveryPlan extends Screen {
  constructor(p) {
    super(p);
    const plan = toState(p.livePlan);
    this.state = { plan, saved: plan, saving: false };
  }
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const { plan, saved, saving } = this.state;
    const who = this.props.athlete;
    const first = who.name.split(' ')[0];
    const set = (patch) => this.setState({ plan: { ...plan, ...patch } });
    const DAYS = [
      ['sa', 'شنبه'],
      ['su', 'یکشنبه'],
      ['mo', 'دوشنبه'],
      ['tu', 'سه‌شنبه'],
      ['we', 'چهارشنبه'],
      ['th', 'پنجشنبه'],
      ['fr', 'جمعه'],
    ];
    const CH = [
      ['s', 'ساعت خواب', 'خواب'],
      ['q', 'کیفیت خواب (۱–۱۰)', 'کیفیت'],
      ['e', 'انرژی (۱–۱۰)', 'انرژی'],
      ['t', 'استرس (۱–۱۰)', 'استرس'],
      ['o', 'کوفتگی (۱–۱۰)', 'کوفتگی'],
      ['f', 'خستگی (۱–۱۰)', 'خستگی'],
    ];
    // Last five days, newest first (empty = not checked in).
    const rowsApi = [...this.props.recent.days].reverse().slice(0, 5);
    const n = (v) => (v == null ? '' : fa(v));
    const DATA = rowsApi.map((r) => ({
      d: new Date(r.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }),
      s: r.sleepHours == null ? '' : fa(r.sleepHours) + ' ساعت',
      q: n(r.sleepQuality),
      e: n(r.energy),
      t: n(r.stress),
      o: n(r.soreness),
      f: n(r.fatigue),
      ov: r.soreness ?? null,
      date: r.date,
    }));
    const th = +plan.alertAt,
      on = plan.checks;
    const hit = on.o && DATA.length > 1 && DATA[0].ov >= th && DATA[1].ov >= th;
    const active = CH.filter((c) => on[c[0]]);
    const dirty = JSON.stringify(plan) !== JSON.stringify(saved);
    const logged = this.props.recent.logged30d;
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'ورزشکاران', to: 'coach:athletes' }, { label: who.name, to: 'coach:athlete?id=' + who.id }, 'ریکاوری'],
      who,
      whoTo: 'coach:athlete?id=' + who.id,
      title: 'ریکاوری · ' + who.name,
      badges: dirty ? [{ label: 'ذخیره‌نشده', tone: 'warning', icon: 'edit' }] : [],
      clean: !dirty,
      saving,
      save: async () => {
        this.setState({ saving: true });
        try {
          const savedPlan = await remote.saveRecoveryPlan(who.id, {
            sleepHours: plan.sleep,
            waterL: plan.water,
            stretchMin: plan.stretch,
            restDays: plan.rest.map((d) => DAY[d]),
            note: plan.note,
            checks: [
              ...Object.keys(CHECK)
                .filter((k) => plan.checks[k])
                .map((k) => CHECK[k]),
              ...WATCH.filter(([k]) => plan.watch[k]).map(([k]) => k),
            ],
            customFields: plan.custom,
            sorenessAlert: +plan.alertAt,
          });
          const next = toState(savedPlan);
          this.setState({ saving: false, plan: next, saved: next });
          toast('برنامه ریکاوری ذخیره شد', 'چک‌این فردای ' + first + ' با تنظیمات جدید است.');
        } catch (e) {
          this.setState({ saving: false });
          toast('ذخیره نشد', faError(e), 'error');
        }
      },
      alert: hit,
      alertTitle: first + ' دو روز پشت سر هم کوفتگی شدید گزارش کرده',
      alertDesc: hit
        ? 'در چک‌این صبح ' +
          DATA[1].d +
          ' و ' +
          DATA[0].d +
          '، به کوفتگی عضلاتش نمره ' +
          fa(Math.min(DATA[0].ov, DATA[1].ov)) +
          ' یا بیشتر از ۱۰ داده است. پیشنهاد: در جلسه بعدی تعداد ست‌ها را کمتر کنید تا بدنش ریکاوری شود.'
        : '',
      n0: 0,
      n1: 1,
      n2: 2,
      n5: 5,
      n10: 10,
      n60: 60,
      half: 0.5,
      quarter: 0.25,
      sleep: plan.sleep,
      water: plan.water,
      stretch: plan.stretch,
      setSleep: (v) => set({ sleep: v }),
      setWater: (v) => set({ water: v }),
      setStretch: (v) => set({ stretch: v }),
      days: DAYS.map(([k, label]) => ({
        label,
        on: plan.rest.includes(k),
        toggle: () => set({ rest: plan.rest.includes(k) ? plan.rest.filter((x) => x !== k) : [...plan.rest, k] }),
      })),
      restNote: plan.rest.length ? fa(plan.rest.length) + ' روز استراحت · ' + fa(7 - plan.rest.length) + ' روز تمرین در هفته' : 'هیچ روز استراحتی انتخاب نشده',
      note: plan.note,
      setNote: (v) => set({ note: v }),
      checkIntro: 'انتخاب کنید ' + first + ' هر صبح چه چیزهایی را امتیاز دهد. همه موارد برای او اختیاری است؛ پاسخ‌های خالی «ثبت نشده» نمایش داده می‌شوند.',
      checks: CH.map(([k, label]) => ({ label, on: !!on[k], toggle: (v) => set({ checks: { ...on, [k]: v } }) })),
      alertAt: plan.alertAt,
      noSoreness: !on.o,
      alertOpts: ['6', '7', '8', '9'].map((v) => ({ value: v, label: fa(v) + ' یا بیشتر، دو روز پشت سر هم' })),
      setAlertAt: (v) => set({ alertAt: v }),
      checkNote: active.length
        ? fa(active.length) + ' سؤال · حدود ' + fa(Math.max(1, Math.round(active.length * 0.25))) + ' دقیقه برای ورزشکار'
        : 'چک‌این خاموش است؛ ' + first + ' سؤالی دریافت نمی‌کند.',
      recentSub: 'چک‌این ' + fa(logged) + ' روز از ۳۰ روز اخیر',
      toAnalytics: () => go('coach:recovery-analytics?id=' + who.id),
      cols: [
        { key: 'd', label: 'تاریخ' },
        ...CH.filter((c) => on[c[0]] && c[0] !== 'q' && c[0] !== 'f').map((c) => ({ key: c[0], label: c[2], empty: c[0] === 's' ? 'ثبت نشده' : '—' })),
      ],
      rows: DATA.map((r, i) => ({ id: String(i), ...r, highlight: on.o && r.ov != null && r.ov >= th })),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="recovery" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader back={v.who.name} backTo={v.whoTo} title={v.title} subtitle="اهداف برنامه و چک‌این روزانه‌ای که در اپ پر می‌کند" badges={v.badges}>
            <Button variant="primary" icon="save" disabled={v.clean} loading={v.saving} onClick={v.save}>
              ذخیره برنامه
            </Button>
          </PageHeader>
          {this.props.athletes?.length > 1 ? <AthleteSwitcher athletes={this.props.athletes} current={this.props.athlete?.id} route="coach:recovery" /> : null}
          <RecoveryTrends days={this.props.recent.days} sleepTarget={this.props.recent.sleepTarget} sorenessAlert={this.props.recent.sorenessAlert} />
          <WatchTrends days={this.props.recent.days} customFields={this.props.recent.customFields} />
          {v.alert ? (
            <>
              <Banner tone="warning" title={v.alertTitle} description={v.alertDesc} />
            </>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                minWidth: '0',
              }}
            >
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>برنامه</h3>
              <Slider label="هدف خواب" value={v.sleep} min={v.n5} max={v.n10} step={v.half} unit="ساعت" lowLabel="۵ ساعت" highLabel="۱۰ ساعت" onChange={v.setSleep} />
              <Slider label="آب" value={v.water} min={v.n1} max={v.n5} step={v.quarter} unit="لیتر" lowLabel="۱ لیتر" highLabel="۵ لیتر" onChange={v.setWater} />
              <Slider label="کشش" value={v.stretch} min={v.n0} max={v.n60} step={v.n5} unit="دقیقه در روز" lowLabel="۰" highLabel="۶۰ دقیقه" onChange={v.setStretch} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>روزهای استراحت</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(v.days || []).map((d: any, $index: number) => (
                    <Fragment key={$index}>
                      <div onClick={d?.toggle} style={{ display: 'flex', cursor: 'pointer' }}>
                        <Tag variant="filter" selected={d?.on}>
                          {d?.label}
                        </Tag>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.restNote}</span>
              </div>
              <TextField
                label="یادداشت برای ورزشکار"
                multiline
                rows={v.n2}
                value={v.note}
                placeholder="مثلاً جمعه استراحت کامل است؛ ۲۰ دقیقه پیاده‌روی اشکالی ندارد."
                onChange={v.setNote}
              />
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minWidth: '0',
              }}
            >
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>چک‌این روزانه</h3>
              <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{v.checkIntro}</p>
              {(v.checks || []).map((c: any, $index: number) => (
                <Fragment key={$index}>
                  <Switch label={c?.label} checked={c?.on} onChange={c?.toggle} />
                </Fragment>
              ))}
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <strong style={{ fontSize: '14px' }}>از ساعت ورزشی (اختیاری)</strong>
              <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
                اگر ورزشکار ساعت Garmin، Polar، Apple Watch یا مشابه دارد، این اعداد را هر صبح از اپ ساعت وارد می‌کند. در «آمادگی امروز» و تحلیل ریکاوری استفاده می‌شوند.
              </span>
              {WATCH.map(([k, label]) => (
                <Switch
                  key={k}
                  label={label}
                  checked={!!this.state.plan.watch[k]}
                  onChange={(on) => this.setState({ plan: { ...this.state.plan, watch: { ...this.state.plan.watch, [k]: on } } })}
                />
              ))}
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <strong style={{ fontSize: '14px' }}>سؤال‌های شما</strong>
              {this.state.plan.custom.map((f, i) => (
                <div key={f.key} style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>
                    {f.label}{' '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      · {KINDS.find((k) => k.value === f.kind)?.label}
                      {f.unit ? ' · ' + f.unit : ''}
                    </span>
                  </span>
                  <IconButton
                    icon="trash"
                    label="حذف"
                    size="sm"
                    variant="ghost"
                    onClick={() => this.setState({ plan: { ...this.state.plan, custom: this.state.plan.custom.filter((_, j) => j !== i) } })}
                  />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '8px', alignItems: 'end' }}>
                <TextField
                  label="سؤال جدید"
                  placeholder="مثلاً درد زانو، انگیزه، دمای بدن"
                  value={this.state.nf?.label || ''}
                  onChange={(x) => this.setState({ nf: { ...(this.state.nf || { kind: 'scale' }), label: x } })}
                />
                <Select label="نوع پاسخ" value={this.state.nf?.kind || 'scale'} options={KINDS} onChange={(x) => this.setState({ nf: { ...(this.state.nf || {}), kind: x } })} />
              </div>
              {this.state.nf?.kind === 'number' ? (
                <TextField
                  label="واحد"
                  optional
                  placeholder="مثلاً °C یا kg"
                  value={this.state.nf?.unit || ''}
                  onChange={(x) => this.setState({ nf: { ...this.state.nf, unit: x } })}
                />
              ) : null}
              <div>
                <Button
                  variant="secondary"
                  icon="plus"
                  size="sm"
                  disabled={!(this.state.nf?.label || '').trim() || this.state.plan.custom.length >= 12}
                  onClick={() => {
                    const nf = this.state.nf;
                    const key = 'c_' + Date.now().toString(36);
                    this.setState({
                      plan: { ...this.state.plan, custom: [...this.state.plan.custom, { key, label: nf.label.trim(), kind: nf.kind || 'scale', unit: nf.unit || '' }] },
                      nf: null,
                    });
                  }}
                >
                  افزودن سؤال
                </Button>
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <Select label="هشدار به من وقتی کوفتگی" value={v.alertAt} options={v.alertOpts} onChange={v.setAlertAt} disabled={v.noSoreness} />
              <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.checkNote}</span>
            </div>
            <Card title="آخرین چک‌این‌ها" subtitle={v.recentSub} actionLabel="تحلیل ریکاوری" onAction={v.toAnalytics} padding="none">
              <Table columns={v.cols} rows={v.rows} dense />
            </Card>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
