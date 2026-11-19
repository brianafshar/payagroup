// Ported from design handoff: project/C28 Coach Endurance Speed.dc.html
import { Fragment } from 'react';
import { Button, Card, ChartContainer, LineChart, MetricCard, PageHeader, Select, Sidebar, Table, Tabs, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { faDayMonth } from '@/lib/format';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';
import { ANALYTICS_TABS, athletePicker, goSection, useAnalyticsPage } from './analytics';
import { RunningAnalytics } from './RunningAnalytics';
import { TestLogModal, unitLabel } from './TestLogModal';

/** Data container: the athlete's field tests and cardio sessions, and the coach's test definitions. */
export default function CoachEnduranceSpeedPage(props: { brand?: string }) {
  const { empty, props: p } = useAnalyticsPage('endurance', 'analytics', 'استقامت و سرعت', undefined, { tests: true });
  return empty ?? <CoachEnduranceSpeed key={p.athlete.id} {...props} {...p} />;
}

const dayLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });

class CoachEnduranceSpeed extends Screen {
  state: ScreenState = { log: false };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const mmss = (m) => {
      const mm = Math.floor(m),
        ss = Math.round((m - mm) * 60);
      return fa(mm) + ':' + fa(String(ss).padStart(2, '0'));
    };
    const { log } = this.state;
    const { athlete: a, athletes, data: d } = this.props;
    const tests = d.tests;
    const speed = tests.find((t) => t.category === 'spd');
    const timed = tests.find((t) => t.category === 'end' && t.unit === 'min');
    const cooper = tests.find((t) => t.category === 'end' && t.unit === 'm');
    const ends = (t) => (t && t.results.length ? [t.results[0], t.results[t.results.length - 1]] : null);
    const sp = ends(speed),
      tm = ends(timed),
      cp = cooper && cooper.results.length ? cooper.results[cooper.results.length - 1] : null;
    const vo2 = cp ? ((cp.value - 504.9) / 44.73).toFixed(1) : null;
    const pct = (x, y) => +(((y - x) / x) * 100).toFixed(1);
    const series = timed ? timed.results.slice(-6) : [];
    const hrRows = d.sessions.filter((x) => x.avgHr).reverse();
    const rows = [
      ...tests.flatMap((t) =>
        t.results
          .filter((r) => Date.now() - Date.parse(r.date) < 30 * 86400000)
          .map((r) => ({
            date: r.date,
            id: 't' + r.id,
            t: 'آزمون ' + t.name,
            u: t.unit === 'min' ? mmss(r.value) : fa(r.value) + ' ' + unitLabel(t.unit),
            k: '',
            h: '',
            r: r.note || '',
            highlight: true,
          })),
      ),
      ...d.sessions.map((x) => ({
        date: x.date,
        id: 's' + x.id,
        t: x.focus || 'جلسه هوازی',
        u: x.durationMin ? fa(x.durationMin) + ' دقیقه' : '',
        k: '',
        h: x.avgHr ? fa(x.avgHr) + ' bpm' : '',
        r: x.rpe ? fa(x.rpe) : '',
      })),
    ].sort((x, y) => y.date.localeCompare(x.date));
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'تحلیل‌ها', to: 'coach:analytics?id=' + a.id }, a.name, 'استقامت و سرعت'],
      subtitle: a.name + ' · جلسات هوازی و آزمون‌های میدانی · مقادیر فقط از داده‌های ثبت‌شده محاسبه می‌شوند.',
      backTo: 'coach:analytics?id=' + a.id,
      exportIt: () => {
        const lines = ['test,date,value,unit', ...tests.flatMap((t) => t.results.map((r) => [t.name, r.date, r.value, t.unit].join(',')))];
        const el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        el.download = 'endurance-' + a.id + '.csv';
        el.click();
        toast('خروجی آماده شد', 'استقامت-' + a.name + '.csv');
      },
      ath: a.id,
      ...athletePicker(athletes, 'endurance'),
      tabs: ANALYTICS_TABS,
      goTab: (id) => goSection(id, a.id),
      metrics: [
        sp
          ? {
              label: speed.name,
              value: fa(sp[1].value),
              unit: unitLabel(speed.unit),
              delta: sp[0] !== sp[1] ? pct(sp[0].value, sp[1].value) : null,
              du: '٪',
              good: speed.better === 'lower' ? 'down' : 'up',
              caption: 'نسبت به ' + fa(sp[0].value) + ' در ' + faDayMonth(new Date(sp[0].date + 'T12:00:00')),
            }
          : { label: 'سرعت', none: true, hint: 'هنوز آزمون سرعتی ثبت نشده.' },
        tm
          ? {
              label: timed.name,
              value: mmss(tm[1].value),
              delta: tm[0] !== tm[1] ? pct(tm[0].value, tm[1].value) : null,
              du: '٪',
              good: 'down',
              caption: 'آخرین: ' + faDayMonth(new Date(tm[1].date + 'T12:00:00')),
            }
          : { label: 'آزمون زمانی', none: true, hint: 'هنوز آزمون استقامتی زمانی ثبت نشده.' },
        d.longest
          ? { label: 'طولانی‌ترین جلسه', value: fa(d.longest.durationMin), unit: 'دقیقه', caption: d.longest.focus }
          : { label: 'طولانی‌ترین جلسه', none: true, hint: 'جلسه هوازی در ۹۰ روز اخیر ثبت نشده.' },
        d.restingHr.current != null
          ? {
              label: 'ضربان استراحت',
              value: fa(d.restingHr.current),
              unit: 'bpm',
              delta: d.restingHr.previous != null ? d.restingHr.current - d.restingHr.previous : null,
              du: 'bpm',
              good: 'down',
              caption: 'میانگین ۱۴ روز · نسبت به ۳ ماه پیش',
            }
          : { label: 'ضربان استراحت', none: true, hint: 'در چک‌این صبح ثبت می‌شود.' },
        { label: 'ضربان ریکاوری', none: true, hint: 'برای ثبت، ورزشکار باید حین جلسه کمربند ضربان ببندد.' },
        vo2
          ? { label: 'VO₂ max', value: fa(vo2), unit: 'ml/kg/min', caption: 'از ' + cooper.name + ' · ' + faDayMonth(new Date(cp.date + 'T12:00:00')) }
          : { label: 'VO₂ max', none: true, hint: 'بعد از آزمون میدانی (مثلاً کوپر ۱۲ دقیقه) نمایش داده می‌شود.' },
      ].map((m) => ({ value: '', unit: '', delta: null, du: '', good: 'up', caption: '', none: false, hint: '', ...m })),
      timedTitle: timed ? 'زمان ' + timed.name : 'آزمون استقامتی زمانی',
      months: series.map((r) => faDayMonth(new Date(r.date + 'T12:00:00'))),
      five: [{ name: timed ? timed.name : '', values: series.map((r) => r.value) }],
      fiveSummary:
        series.length > 1
          ? mmss(Math.abs(series[0].value - series[series.length - 1].value)) +
            (series[series.length - 1].value <= series[0].value ? ' کاهش' : ' افزایش') +
            ' از ' +
            faDayMonth(new Date(series[0].date + 'T12:00:00'))
          : 'هنوز آزمون استقامتی زمانی ثبت نشده است.',
      noHr: hrRows.length < 2,
      hrLabels: hrRows.map((x) => faDayMonth(new Date(x.date + 'T12:00:00'))),
      hr: [{ name: 'میانگین ضربان', values: hrRows.map((x) => x.avgHr) }],
      hrSummary: hrRows.length >= 2 ? fa(hrRows.length) + ' جلسه با ضربان ثبت‌شده' : '',
      n200: 200,
      n560: 560,
      sessSub: fa(rows.length) + ' جلسه و آزمون در ۳۰ روز اخیر',
      cols: [
        { key: 'd', label: 'تاریخ' },
        { key: 't', label: 'جلسه' },
        { key: 'u', label: 'مدت / نتیجه' },
        { key: 'h', label: 'میانگین ضربان', empty: 'ثبت نشده' },
        { key: 'r', label: 'RPE / یادداشت', empty: 'ثبت نشده' },
      ],
      rows: rows.map((x) => ({ ...x, d: dayLabel(x.date) })),
      logOpen: log,
      openLog: () => this.setState({ log: true }),
      closeLog: () => this.setState({ log: false }),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="analytics" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={<>{v.logOpen ? <TestLogModal athlete={this.props.athlete} tests={this.props.tests} categories={['end', 'spd']} onClose={v.closeLog} /> : null}</>}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="استقامت و سرعت" subtitle={v.subtitle} back="تحلیل‌ها" backTo={v.backTo}>
            <Button variant="secondary" icon="plus" onClick={v.openLog}>
              ثبت آزمون
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
              <Tabs variant="pill" value="endurance" tabs={v.tabs} onChange={v.goTab} />
            </div>
          </div>
          {this.props.data.running ? <RunningAnalytics data={this.props.data.running} athlete={this.props.athlete} /> : null}
          <h2 style={{ margin: 0, fontSize: '18px', lineHeight: '28px', fontWeight: 600 }}>آزمون‌های میدانی و جلسات هوازی</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: '16px', alignItems: 'stretch' }}>
            {(v.metrics || []).map((m: any, $index: number) => (
              <Fragment key={$index}>
                <MetricCard
                  label={m?.label}
                  value={m?.value}
                  unit={m?.unit}
                  delta={m?.delta}
                  deltaUnit={m?.du}
                  goodDirection={m?.good}
                  caption={m?.caption}
                  notRecorded={m?.none}
                  emptyHint={m?.hint}
                  size="sm"
                />
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <ChartContainer title={v.timedTitle} summary={v.fiveSummary} footnote="به دقیقه اعشاری؛ ۲۴٫۵ = ۲۴:۳۰. عدد کمتر بهتر است.">
              <LineChart labels={v.months} series={v.five} unit="min" height={v.n200} width={v.n560} points />
            </ChartContainer>
            <ChartContainer
              title="ضربان قلب در جلسات"
              empty={v.noHr}
              emptyTitle="هنوز داده ضربان قلب ثبت نشده"
              emptyDescription="ضربان قلب اختیاری است. جلسات همچنان در پایبندی حساب می‌شوند."
              height={v.n200}
              summary={v.hrSummary}
            >
              <LineChart labels={v.hrLabels} series={v.hr} unit="bpm" height={v.n200} width={v.n560} points />
            </ChartContainer>
          </div>
          <Card title="جلسات هوازی" subtitle={v.sessSub} padding="none">
            <Table columns={v.cols} rows={v.rows} dense />
          </Card>
        </div>
      </PanelLayout>
    );
  }
}
