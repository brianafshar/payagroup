// Ported from design handoff: project/C26 Coach Analytics Overview.dc.html
import { Fragment } from 'react';
import {
  BarChart,
  Button,
  Card,
  ChartContainer,
  ComparisonBar,
  MetricCard,
  Modal,
  PageHeader,
  SegmentedControl,
  Select,
  Sidebar,
  StatusBreakdown,
  Tabs,
  TextField,
  TopBar,
  ValueDisplay,
} from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { faError, remote } from '@/data/api';
import { faDayMonth } from '@/lib/format';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';
import { ANALYTICS_TABS, athletePicker, goSection, useAnalyticsPage } from './analytics';
import { PerformancePanel } from './PerformancePanel';
import { TrendsPanel } from './TrendsPanel';

const RANGE = { w: ['هفته', 7], m: ['ماه', 30], '3m': ['۳ ماه', 90], '6m': ['۶ ماه', 180], y: ['۱ سال', 365] } as const;
type RangeKey = keyof typeof RANGE;

/** Data container: the athlete's overview for the chosen range (`?range=`). */
export default function CoachAnalyticsOverviewPage(props: { brand?: string }) {
  const range = (param('range') as RangeKey) in RANGE ? (param('range') as RangeKey) : '6m';
  const { empty, props: p } = useAnalyticsPage('overview', 'analytics', 'تحلیل‌ها', RANGE[range][1], { tests: true });
  return empty ?? <CoachAnalyticsOverview key={p.athlete.id + range} {...props} {...p} range={range} />;
}

const CAT = {
  pow: ['توان', 'zap', 'پرش عمودی'],
  spd: ['سرعت', 'stopwatch', 'دوی سرعت'],
  mob: ['آزمون تحرک', 'activity', 'نشستن و رسیدن'],
  agi: ['آزمون چابکی', 'route', 'تی‌تست'],
};
const UNIT = { s: 'ثانیه', min: 'دقیقه', m: 'متر', km: 'کیلومتر', cm: 'cm', kg: 'kg', rep: 'تکرار', bpm: 'bpm' };

class CoachAnalyticsOverview extends Screen {
  state: ScreenState = { test: null, testId: null, testVal: '' };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const en = (v) =>
      +String(v)
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace('٫', '.');
    const { test, testId, testVal } = this.state;
    const { athlete: a, athletes, data: d, tests: defs } = this.props;
    const range: RangeKey = this.props.range;
    const since = faDayMonth(new Date(d.since + 'T12:00:00'));
    const lifts = d.lifts.map((l) => ({
      label: '1RM تخمینی ' + l.name,
      a: l.first,
      b: l.current,
      da: faDayMonth(new Date(l.firstDate + 'T12:00:00')),
      db: faDayMonth(new Date(l.currentDate + 'T12:00:00')),
    }));
    const pcts = d.lifts.filter((l) => l.first).map((l) => Math.round(((l.current - l.first) / l.first) * 100));
    const vol = d.volume.map((w) => w.tonnes);
    const volL = d.volume.map((w) => faDayMonth(new Date(w.weekStart + 'T12:00:00')));
    const lastVol = [...vol].reverse().find((x) => x > 0);
    const catDefs = test ? defs.filter((t) => t.category === test) : [];
    const picked = catDefs.find((t) => t.id === testId) || catDefs[0];
    const adh = (x) => ({
      value: x.value == null ? null : fa(x.value),
      delta: x.value != null && x.previous != null ? x.value - x.previous : undefined,
      spark: x.spark.filter((v) => v != null),
    });
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: ['تحلیل‌ها', a.name],
      subtitle: a.name + ' · ' + RANGE[range][0] + ' اخیر · مقادیر فقط از داده‌های ثبت‌شده محاسبه می‌شوند، نه پیش‌بینی.',
      exportIt: () => window.print(),
      ath: a.id,
      ...athletePicker(athletes, 'overview'),
      tabs: ANALYTICS_TABS,
      goTab: (id) => goSection(id, a.id),
      ranges: Object.keys(RANGE).map((k) => ({ value: k, label: RANGE[k][0] })),
      range,
      setRange: (v) => go('coach:analytics?id=' + a.id + '&range=' + v),
      metrics: [
        { label: 'پایبندی تمرین', v: d.adherence.training, caption: 'جلسات انجام‌شده نسبت به برنامه', to: 'coach:history?id=' + a.id },
        { label: 'پایبندی تغذیه', v: d.adherence.nutrition, caption: 'وعده‌های رعایت‌شده', to: 'coach:nutrition?id=' + a.id },
        { label: 'پایبندی ریکاوری', v: d.adherence.recovery, caption: 'چک‌این‌های تکمیل‌شده', to: 'coach:recovery-analytics?id=' + a.id },
      ].map((m) => ({ label: m.label, ...adh(m.v), caption: m.caption, go: () => go(m.to) })),
      strSummary: pcts.length
        ? 'حرکات اصلی از ' + since + ' بین ' + fa(Math.min(...pcts)) + '٪ تا ' + fa(Math.max(...pcts)) + '٪ تغییر داشته‌اند.'
        : 'در این بازه ست وزنه‌داری ثبت نشده است.',
      lifts,
      toEndurance: () => go('coach:endurance?id=' + a.id),
      tests: d.tests.map((t) => ({
        label: t.name || CAT[t.category][0],
        icon: CAT[t.category][1],
        none: t.value == null,
        value: t.value == null ? '' : fa(t.value),
        unit: t.value == null ? '' : UNIT[t.unit] || t.unit,
        add: () => this.setState({ test: t.category, testId: null, testVal: '' }),
      })),
      sessTitle: 'جلسات، ' + RANGE[range][0],
      sessSub: fa(d.sessions.completed + d.sessions.partial + d.sessions.missed) + ' جلسه ثبت‌شده',
      sess: [
        { status: 'completed', value: d.sessions.completed },
        { status: 'partial', value: d.sessions.partial },
        { status: 'missed', value: d.sessions.missed },
      ],
      toHistory: () => go('coach:history?id=' + a.id),
      volSummary: lastVol != null ? fa(lastVol) + ' تن در آخرین هفته تمرینی' : 'در این بازه حجمی ثبت نشده است.',
      volLabels: volL,
      volSeries: [{ name: 'حجم', values: vol, color: 'viz-1' }],
      n180: 180,
      n1100: 1100,
      n36: 36,
      testOpen: !!test,
      testTitle: test ? 'افزودن ' + CAT[test][0] : '',
      testKind: picked ? String(picked.id) : '',
      testKinds: catDefs.map((t) => ({ value: String(t.id), label: t.name })),
      noTestDefs: test && !catDefs.length,
      setTestKind: (v) => this.setState({ testId: +v }),
      testVal,
      testUnit: picked ? UNIT[picked.unit] || picked.unit : '',
      setTestVal: (v) => this.setState({ testVal: v }),
      noTestVal: !testVal.trim() || !picked || !(en(testVal) > 0),
      saveTest: async () => {
        const today = new Date();
        const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        try {
          await remote.addTestResult(a.id, picked.id, en(testVal), iso);
        } catch (e) {
          return toast('ثبت نشد', faError(e), 'error');
        }
        this.setState({ test: null, testId: null });
        toast('آزمون ثبت شد', picked.name + ': ' + testVal.trim() + ' ' + (UNIT[picked.unit] || picked.unit));
      },
      closeTest: () => this.setState({ test: null, testId: null }),
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
            {v.testOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title={v.testTitle}
                    description="نتیجه آزمون امروز ثبت می‌شود و در روند تحلیل نمایش داده می‌شود."
                    primaryLabel="ثبت"
                    primaryDisabled={v.noTestVal}
                    secondaryLabel="انصراف"
                    onPrimary={v.saveTest}
                    onClose={v.closeTest}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }}>
                      {v.noTestDefs ? (
                        <p style={{ margin: 0, gridColumn: 'span 2', fontSize: 13, color: 'var(--text-muted)' }}>ابتدا در تنظیمات › آزمون‌ها یک آزمون در این دسته تعریف کنید.</p>
                      ) : null}
                      <Select label="آزمون" value={v.testKind} options={v.testKinds} onChange={v.setTestKind} />
                      <TextField label="نتیجه" value={v.testVal} suffix={v.testUnit} placeholder="مثلاً ۱۲" onChange={v.setTestVal} />
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="تحلیل‌ها" subtitle={v.subtitle}>
            <Button variant="secondary" icon="download" onClick={v.exportIt}>
              خروجی
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '220px' }}>
              <Select value={v.ath} icon="user" options={v.athOpts} onChange={v.setAth} />
            </div>
            <div style={{ minWidth: '0', flex: '1 1 auto', overflowX: 'auto' }}>
              <Tabs variant="pill" value="overview" tabs={v.tabs} onChange={v.goTab} />
            </div>
            <SegmentedControl options={v.ranges} value={v.range} size="sm" label="بازه زمانی" onChange={v.setRange} />
          </div>
          <PerformancePanel athlete={this.props.athlete} />
          <TrendsPanel athleteId={this.props.athlete.id} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            {(v.metrics || []).map((m: any, $index: number) => (
              <Fragment key={$index}>
                <div onClick={m?.go} style={{ cursor: 'pointer', minWidth: '0' }}>
                  <MetricCard label={m?.label} value={m?.value} emptyLabel="ثبت نشده" unit="٪" delta={m?.delta} caption={m?.caption} spark={m?.spark} />
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <ChartContainer title="قدرت از اولین آزمون" summary={v.strSummary} tableToggle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }}>
                  {(v.lifts || []).map((l: any, $index: number) => (
                    <Fragment key={$index}>
                      <ComparisonBar label={l?.label} first={l?.a} current={l?.b} unit="kg" firstDate={l?.da} currentDate={l?.db} />
                    </Fragment>
                  ))}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" size="sm" icon="trending-up" to={'coach:strength?id=' + v.ath}>
                      تحلیل قدرت
                    </Button>
                    <Button variant="ghost" size="sm" icon="trophy" to={'coach:records?id=' + v.ath}>
                      رکوردهای شخصی
                    </Button>
                  </div>
                </div>
              </ChartContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <Card title="توان، سرعت، تحرک، چابکی" actionLabel="استقامت و سرعت" onAction={v.toEndurance}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '0' }}>
                  {(v.tests || []).map((t: any, $index: number) => (
                    <Fragment key={$index}>
                      <ValueDisplay
                        label={t?.label}
                        icon={t?.icon}
                        value={t?.value}
                        unit={t?.unit}
                        notRecorded={t?.none}
                        notRecordedLabel="هنوز آزمونی ثبت نشده"
                        addLabel="افزودن آزمون"
                        onAdd={t?.add}
                        layout="row"
                      />
                    </Fragment>
                  ))}
                </div>
              </Card>
              <Card title={v.sessTitle} subtitle={v.sessSub} actionLabel="سابقه تمرین" onAction={v.toHistory}>
                <StatusBreakdown items={v.sess} />
              </Card>
            </div>
          </div>
          <ChartContainer title="حجم تمرین هفتگی" summary={v.volSummary} footnote="حجم = Σ وزنه × تکرار در همه ست‌های ثبت‌شده.">
            <BarChart labels={v.volLabels} series={v.volSeries} unit="t" height={v.n180} width={v.n1100} maxBar={v.n36} />
          </ChartContainer>
        </div>
      </PanelLayout>
    );
  }
}
