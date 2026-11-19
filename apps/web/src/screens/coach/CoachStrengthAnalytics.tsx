// Ported from design handoff: project/C27 Coach Strength Analytics.dc.html
import { Fragment } from 'react';
import { BarChart, Button, Card, ChartContainer, LineChart, MetricCard, PRCard, PageHeader, SegmentedControl, Select, Sidebar, Table, Tabs, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { faLastSeen } from '@/lib/format';
import { panelUser } from '@/data/session';
import { bandLabel } from '@/data/exercises';
import { Screen, type ScreenState } from '../Screen';
import { ANALYTICS_TABS, athletePicker, goSection, useAnalyticsPage } from './analytics';
import { StrengthVolume } from './StrengthVolume';
import { KeyLiftsModal, TestedMaxModal } from './KeyLiftsModals';

/** Data container: the athlete's strength analytics (12 months). */
export default function CoachStrengthAnalyticsPage(props: { brand?: string }) {
  const { empty, props: p } = useAnalyticsPage('strength', 'analytics', 'قدرت');
  return empty ?? <CoachStrengthAnalytics key={p.athlete.id} {...props} {...p} />;
}

const MUSCLE: Record<string, string> = { chest: 'سینه', back: 'پشت', legs: 'پا', shoulders: 'سرشانه', arms: 'بازو', conditioning: 'هوازی', power: 'توان' };
const month = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { month: 'long' });

class CoachStrengthAnalytics extends Screen {
  state: ScreenState = { lift: 0, modal: null };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const { athlete: a, athletes, data: d } = this.props;
    const lift = Math.min(this.state.lift, Math.max(0, d.lifts.length - 1));
    const pct = (f, c) => (f ? +(((c - f) / f) * 100).toFixed(1) : undefined);
    const cur = d.lifts[lift];
    const vals = cur ? cur.monthly : [];
    const last = [...vals].reverse().find((v) => v != null);
    const firstIdx = vals.findIndex((v) => v != null);
    const gaps = vals.map((v, i) => (v == null && i > firstIdx && firstIdx > -1 ? i : -1)).filter((i) => i > -1 && i < vals.length - 1);
    const labels = d.months.map(month);
    const bw = d.bodyWeight;
    const bench = d.lifts[0];
    const muscles = d.muscles.filter((m) => m.previous || m.current);
    const diffs = muscles.map((m) => [m.previous ? ((m.current - m.previous) / m.previous) * 100 : 0, MUSCLE[m.category] || m.category]);
    const down = diffs.filter((x) => x[0] < 0);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'تحلیل‌ها', to: 'coach:analytics?id=' + a.id }, a.name, 'قدرت'],
      subtitle: a.name + (bw ? ' · وزن بدن ' + fa(bw) + ' kg' : '') + ' · مقادیر فقط از داده‌های ثبت‌شده محاسبه می‌شوند.',
      exportIt: () => {
        const lines = ['exercise,' + d.months.join(','), ...d.lifts.map((l) => [l.name, ...l.monthly.map((v) => v ?? '')].join(','))];
        const el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        el.download = 'strength-' + a.id + '.csv';
        el.click();
        toast('خروجی آماده شد', 'قدرت-' + a.name + '.csv');
      },
      ath: a.id,
      ...athletePicker(athletes, 'strength'),
      tabs: ANALYTICS_TABS,
      goTab: (id) => goSection(id, a.id),
      metrics: [
        ...d.lifts.slice(0, 3).map((l) => ({
          label: '1RM ' + l.name,
          value: l.current != null ? fa(l.current) : 'ثبت نشده',
          unit: l.current != null ? 'kg' : '',
          delta: pct(l.first, l.current),
          du: '٪',
          caption: l.first != null ? 'از ' + labels[l.monthly.findIndex((v) => v != null)] + ' · ' + fa(l.first) + ' کیلوگرم' : '',
        })),
        bench && bw && bench.current
          ? {
              label: 'قدرت نسبی · ' + bench.name,
              value: fa((bench.current / bw).toFixed(2)),
              unit: '× وزن بدن',
              delta: bench.first ? +((bench.current - bench.first) / bw).toFixed(2) : undefined,
              du: '',
              caption: '1RM ÷ وزن بدن',
            }
          : { label: 'قدرت نسبی', value: 'ثبت نشده', unit: '', du: '', caption: 'نیاز به وزن بدن و ست وزنه‌دار' },
      ],
      chartTitle: cur ? cur.name + ' · 1RM تخمینی و آزمون‌شده' : 'روند 1RM حرکات شاخص',
      legend: [
        { label: '1RM تخمینی · اپلی', color: 'viz-1' },
        { label: '1RM آزمون‌شده', color: 'viz-2' },
      ],
      keyNote: d.keyLiftsCustom ? 'حرکات شاخص انتخاب مربی' : 'حرکات شاخص: پرتکرارترین حرکات وزنه‌دار (خودکار)',
      chartSummary: last != null ? '1RM تخمینی فعلی ' + fa(last) + ' kg' + (gaps.length ? ' · ماه‌های خالی = جلسه ' + cur.name + ' ثبت نشده' : '') : '',
      liftOpts: d.lifts.map((l, i) => ({ value: String(i), label: l.name })),
      lift: String(lift),
      setLift: (v) => this.setState({ lift: +v }),
      months: labels,
      line: [
        { name: '1RM تخمینی', values: vals, color: 'viz-1' },
        {
          name: '1RM آزمون‌شده',
          values: d.months.map((_, i) => {
            const t = (cur?.tested || []).filter((x) => x.month === i);
            return t.length ? Math.max(...t.map((x) => x.value)) : null;
          }),
          color: 'viz-2',
        },
      ],
      ann: (cur?.tested || []).map((t) => ({ index: t.month, label: fa(t.value) })),
      n200: 200,
      n240: 240,
      n760: 760,
      rmCols: [
        { key: 'l', label: 'حرکت' },
        { key: 'a', label: '1RM' },
        { key: 'b', label: '3RM' },
        { key: 'c', label: '5RM' },
      ],
      rmRows: d.lifts.map((l, i) => ({ id: String(i), l: l.name, a: l.rm1 != null ? fa(l.rm1) : '', b: l.rm3 != null ? fa(l.rm3) : '', c: l.rm5 != null ? fa(l.rm5) : '' })),
      muscles: muscles.map((m) => MUSCLE[m.category] || m.category),
      muscleSeries: [
        { name: '۳۰ روز قبل', values: muscles.map((m) => m.previous), color: 'viz-muted' },
        { name: '۳۰ روز اخیر', values: muscles.map((m) => m.current), color: 'viz-1' },
      ],
      muscleLegend: [
        { label: '۳۰ روز قبل (تن)', color: 'viz-muted', shape: 'bar' },
        { label: '۳۰ روز اخیر (تن)', color: 'viz-1', shape: 'bar' },
      ],
      muscleSummary: !muscles.length
        ? 'در ۶۰ روز اخیر حجمی ثبت نشده است.'
        : down.length
          ? 'حجم ' + down.map((x) => x[1] + ' ' + fa(Math.abs(Math.round(x[0]))) + '٪').join('، ') + ' کاهش داشت؛ بقیه گروه‌ها افزایش یافتند.'
          : 'حجم همه گروه‌های عضلانی نسبت به ۳۰ روز قبل افزایش یافت.',
      prs: d.records.map((r) => ({
        ex: r.exercise,
        type: /^\d+RM$/.test(r.type) ? 'حداکثر ' + fa(parseInt(r.type)) + ' تکرار' : r.type,
        date: faLastSeen(r.date, new Date(), false),
        value: fa(r.value),
        prev: r.previous != null ? fa(r.previous) + ' kg' : undefined,
        delta: pct(r.previous, r.value),
        isNew: Date.now() - Date.parse(r.date) < 7 * 86400000,
      })),
      recordsTo: 'coach:records?id=' + a.id,
      // Band exercises progress by band level and reps, not kilos.
      bandCols: [
        { key: 'n', label: 'حرکت' },
        { key: 'f', label: 'اولین' },
        { key: 'c', label: 'اکنون' },
        { key: 's', label: 'جلسه', align: 'right' },
      ],
      bandRows: (d.bands || []).map((b) => ({
        id: String(b.exerciseId),
        n: b.name,
        f: bandLabel(b.first.level) + ' × ' + fa(b.first.reps),
        c: bandLabel(b.current.level) + ' × ' + fa(b.current.reps),
        s: fa(b.points.length),
      })),
      backTo: 'coach:analytics?id=' + a.id,
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="analytics" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="قدرت" subtitle={v.subtitle} back="تحلیل‌ها" backTo={v.backTo}>
            <Button variant="secondary" icon="download" onClick={v.exportIt}>
              خروجی
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '220px' }}>
              <Select value={v.ath} icon="user" options={v.athOpts} onChange={v.setAth} />
            </div>
            <div style={{ minWidth: '0', flex: '1 1 auto', overflowX: 'auto' }}>
              <Tabs variant="pill" value="strength" tabs={v.tabs} onChange={v.goTab} />
            </div>
          </div>
          {this.props.data.weeklyTonnes ? <StrengthVolume data={this.props.data} athleteId={this.props.athlete.id} /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            {(v.metrics || []).map((m: any, $index: number) => (
              <Fragment key={$index}>
                <MetricCard label={m?.label} value={m?.value} unit={m?.unit} delta={m?.delta} deltaUnit={m?.du} caption={m?.caption} />
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <ChartContainer title={v.chartTitle} legend={v.legend} summary={v.chartSummary} footnote="اپلی: e1RM = وزنه × (۱ + تکرار ÷ ۳۰)، بهترین ست هر جلسه.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{v.keyNote}</span>
                    <Button variant="secondary" size="sm" icon="settings" onClick={() => this.setState({ modal: 'lifts' })}>
                      انتخاب حرکات شاخص
                    </Button>
                    <Button variant="secondary" size="sm" icon="trophy" disabled={!this.props.data.lifts.length} onClick={() => this.setState({ modal: 'tested' })}>
                      ثبت رکورد آزمون‌شده
                    </Button>
                  </div>
                  {v.liftOpts.length ? <SegmentedControl options={v.liftOpts} value={v.lift} size="sm" label="حرکت" onChange={v.setLift} /> : null}
                  <LineChart
                    labels={v.months}
                    series={v.line}
                    unit="kg"
                    height={v.n240}
                    width={v.n760}
                    annotations={v.ann}
                    emptyTitle={v.liftOpts.length ? 'برای این حرکت در ۱۲ ماه اخیر ست وزنه‌دار یا رکورد آزمون‌شده ثبت نشده' : 'هنوز حرکت شاخصی نیست'}
                    emptyDescription={
                      v.liftOpts.length
                        ? 'ست باید با وزنه و تکرار ثبت شده باشد، یا با «ثبت رکورد آزمون‌شده» نتیجه آزمون را وارد کنید.'
                        : 'با «انتخاب حرکات شاخص» حرکاتی را که می‌خواهید دنبال کنید انتخاب کنید.'
                    }
                  />
                </div>
              </ChartContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
              <Card title="حداکثر تکرارها (kg)" subtitle="بهترین ثبت‌شده · خالی = آزمون نشده" padding="none">
                <Table columns={v.rmCols} rows={v.rmRows} dense />
              </Card>
              {v.bandRows.length ? (
                <Card title="حرکات کش" subtitle="بهترین ست هر جلسه: شدت کش × تکرار" padding="none">
                  <Table columns={v.bandCols} rows={v.bandRows} dense />
                </Card>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <ChartContainer title="ست به تفکیک گروه عضلانی" legend={v.muscleLegend} summary={v.muscleSummary}>
                <BarChart labels={v.muscles} series={v.muscleSeries} height={v.n200} width={v.n760} valueLabels />
              </ChartContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '0' }}>
              {(v.prs || []).map((p: any, $index: number) => (
                <Fragment key={$index}>
                  <PRCard exercise={p?.ex} type={p?.type} date={p?.date} value={p?.value} unit="kg" previous={p?.prev} delta={p?.delta} isNew={p?.isNew} size="sm" />
                </Fragment>
              ))}
              <Button variant="secondary" icon="trophy" to={v.recordsTo}>
                همه رکوردهای شخصی
              </Button>
            </div>
          </div>
        </div>
        {this.state.modal === 'lifts' ? (
          <KeyLiftsModal
            athleteId={this.props.athlete.id}
            athleteName={this.props.athlete.name}
            current={this.props.data.keyLifts || []}
            custom={!!this.props.data.keyLiftsCustom}
            onClose={() => this.setState({ modal: null, lift: 0 })}
          />
        ) : null}
        {this.state.modal === 'tested' ? (
          <TestedMaxModal
            athleteId={this.props.athlete.id}
            lifts={this.props.data.lifts}
            initial={this.props.data.lifts[+v.lift]?.exerciseId}
            onClose={() => this.setState({ modal: null })}
          />
        ) : null}
      </PanelLayout>
    );
  }
}
