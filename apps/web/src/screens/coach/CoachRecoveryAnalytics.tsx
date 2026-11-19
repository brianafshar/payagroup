// Ported from design handoff: project/C30 Coach Recovery Analytics.dc.html
import { Fragment } from 'react';
import { Banner, BarChart, Button, ChartContainer, LineChart, MetricCard, PageHeader, SegmentedControl, Select, Sidebar, Tabs, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';
import { ANALYTICS_TABS, athletePicker, goSection, useAnalyticsPage } from './analytics';
import { WatchTrends } from './RecoveryTrends';

/** Data container: the athlete's last 14 days of morning check-ins. */
export default function CoachRecoveryAnalyticsPage(props: { brand?: string }) {
  const { empty, props: p } = useAnalyticsPage('recovery', 'analytics', 'ریکاوری', 14);
  return empty ?? <CoachRecoveryAnalytics key={p.athlete.id} {...props} {...p} />;
}

class CoachRecoveryAnalytics extends Screen {
  state: ScreenState = { pair: 'se' };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const { pair } = this.state;
    const { athlete: a, athletes, data: d } = this.props;
    const first = a.name.split(' ')[0];
    const rows = d.days;
    const col = (k) => rows.map((r) => r[k] ?? null);
    const S = { o: col('soreness'), e: col('energy'), t: col('stress'), f: col('fatigue') };
    const sleep = col('sleepHours');
    const days = rows.map((r) => fa(new Date(r.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric' })));
    const longDay = (i) => new Date(rows[i].date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
    const avg = (arr) => {
      const v = arr.filter((x) => x != null);
      return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
    };
    const f1 = (x) => (x == null ? 'ثبت نشده' : fa(x.toFixed(1)));
    const target = d.sleepTarget,
      th = d.sorenessAlert;
    const sl = avg(sleep),
      met = sleep.filter((x) => x != null && x >= target).length,
      logged = sleep.filter((x) => x != null).length,
      miss = sleep.length - logged;
    const flags = [];
    for (let i = rows.length - 1; i >= 1; i--)
      if (S.o[i] >= th && S.o[i - 1] >= th) {
        flags.push({
          title: first + ' دو روز پشت سر هم کوفتگی شدید گزارش کرده',
          desc:
            'در چک‌این صبح ' +
            longDay(i - 1) +
            ' و ' +
            longDay(i) +
            '، به کوفتگی عضلاتش نمره ' +
            fa(th) +
            ' یا بیشتر از ۱۰ داده است. پیشنهاد: در جلسه بعدی تعداد ست‌ها را کمتر کنید.',
          action: 'ویرایش برنامه',
          go: () => go('coach:customize?id=' + a.id),
        });
        break;
      }
    for (let i = sleep.length - 1; i >= 2; i--)
      if ([sleep[i], sleep[i - 1], sleep[i - 2]].every((x) => x != null && x < 6)) {
        flags.push({
          title: first + ' سه شب پشت سر هم کمتر از ۶ ساعت خوابیده',
          desc: 'از ' + longDay(i - 2) + ' تا ' + longDay(i) + ' خوابش زیر ۶ ساعت بوده است. پیشنهاد: با او درباره ساعت خواب صحبت کنید.',
          action: 'پیام به ورزشکار',
          go: () => go('coach:chat?a=' + a.id),
        });
        break;
      }
    const P = {
      se: [
        ['o', 'کوفتگی', 'viz-4'],
        ['e', 'انرژی', 'viz-2'],
      ],
      tf: [
        ['t', 'استرس', 'viz-3'],
        ['f', 'خستگی', 'viz-1'],
      ],
    };
    const peak = S.o.reduce((b, v, i) => (v != null && (b < 0 || v > S.o[b]) ? i : b), -1);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'تحلیل‌ها', to: 'coach:analytics?id=' + a.id }, a.name, 'ریکاوری'],
      subtitle: a.name + ' · چک‌این صبحگاهی · ' + fa(d.logged30d) + ' از ۳۰ روز ثبت شده',
      backTo: 'coach:analytics?id=' + a.id,
      planTo: 'coach:recovery?id=' + a.id,
      exportIt: () => {
        const lines = [
          'date,sleep_hours,sleep_quality,energy,stress,soreness,fatigue,resting_hr',
          ...rows.map((r) => [r.date, r.sleepHours ?? '', r.sleepQuality ?? '', r.energy ?? '', r.stress ?? '', r.soreness ?? '', r.fatigue ?? '', r.restingHr ?? ''].join(',')),
        ];
        const el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        el.download = 'recovery-' + a.id + '.csv';
        el.click();
        toast('خروجی آماده شد', 'ریکاوری-' + a.name + '.csv');
      },
      ath: a.id,
      ...athletePicker(athletes, 'recovery'),
      tabs: ANALYTICS_TABS,
      goTab: (id) => goSection(id, a.id),
      flags,
      metrics: [
        {
          label: 'میانگین خواب',
          value: f1(sl),
          unit: sl == null ? '' : 'ساعت',
          caption: 'هدف ' + fa(target) + ' ساعت',
          delta: sl != null && d.previousSleep != null ? +(sl - d.previousSleep).toFixed(1) : null,
          du: 'ساعت',
          good: 'up',
        },
        { label: 'انرژی', value: f1(avg(S.e)), unit: '/ ۱۰', caption: 'میانگین ۱۴ روز', good: 'up' },
        { label: 'استرس', value: f1(avg(S.t)), unit: '/ ۱۰', caption: 'میانگین ۱۴ روز', good: 'down' },
        { label: 'کوفتگی', value: f1(avg(S.o)), unit: '/ ۱۰', caption: peak > -1 ? 'اوج ' + longDay(peak) : 'میانگین ۱۴ روز', good: 'down' },
        { label: 'خستگی', value: f1(avg(S.f)), unit: '/ ۱۰', caption: 'میانگین ۱۴ روز', good: 'down' },
      ].map((m) => ({ delta: null, du: '', ...m })),
      days,
      n0: 0,
      n10: 10,
      n200: 200,
      n560: 560,
      sleep: [{ name: 'خواب', values: sleep, color: 'viz-1' }],
      sleepTarget: { value: target, label: 'هدف ' + fa(target) + ' ساعت' },
      sleepSummary: logged
        ? 'هدف در ' + fa(met) + ' از ' + fa(logged) + ' شب ثبت‌شده رسید' + (miss ? ' · ' + fa(miss) + ' شب ثبت نشده' : '')
        : 'در ۱۴ روز اخیر چک‌اینی ثبت نشده است.',
      pairOpts: [
        { value: 'se', label: 'کوفتگی و انرژی' },
        { value: 'tf', label: 'استرس و خستگی' },
      ],
      pair,
      setPair: (v) => this.setState({ pair: v }),
      lineTitle: P[pair].map((x) => x[1]).join(' و '),
      lineLegend: P[pair].map((x) => ({ label: x[1], color: x[2] })),
      lines: P[pair].map((x) => ({ name: x[1], values: S[x[0]], color: x[2], points: true })),
      lineSummary:
        pair === 'se'
          ? 'میانگین کوفتگی ' + f1(avg(S.o)) + ' و انرژی ' + f1(avg(S.e)) + ' از ۱۰ در ۱۴ روز اخیر.'
          : 'استرس و خستگی معمولاً همسو هستند. میانگین استرس ' + f1(avg(S.t)) + ' است.',
      ruleDesc:
        'هشدار وقتی ثبت می‌شود که کوفتگی دو روز پشت سر هم ' + fa(th) + ' یا بیشتر باشد، یا خواب سه شب پشت سر هم کمتر از ۶ ساعت. آستانه کوفتگی را در برنامه ریکاوری تغییر دهید.',
      toPlan: () => go('coach:recovery?id=' + a.id),
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
          <PageHeader title="ریکاوری" subtitle={v.subtitle} back="تحلیل‌ها" backTo={v.backTo}>
            <Button variant="secondary" icon="settings" to={v.planTo}>
              برنامه ریکاوری
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
              <Tabs variant="pill" value="recovery" tabs={v.tabs} onChange={v.goTab} />
            </div>
          </div>
          {(v.flags || []).map((f: any, $index: number) => (
            <Fragment key={$index}>
              <Banner tone="warning" title={f?.title} description={f?.desc} actionLabel={f?.action} onAction={f?.go} />
            </Fragment>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '16px', alignItems: 'stretch' }}>
            {(v.metrics || []).map((m: any, $index: number) => (
              <Fragment key={$index}>
                <MetricCard label={m?.label} value={m?.value} unit={m?.unit} caption={m?.caption} delta={m?.delta} deltaUnit={m?.du} goodDirection={m?.good} size="sm" />
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <ChartContainer title="ساعت خواب · ۱۴ روز اخیر" summary={v.sleepSummary}>
              <BarChart labels={v.days} series={v.sleep} unit="h" height={v.n200} width={v.n560} target={v.sleepTarget} yMax={v.n10} />
            </ChartContainer>
            <ChartContainer title={v.lineTitle} legend={v.lineLegend} summary={v.lineSummary}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
                <SegmentedControl options={v.pairOpts} value={v.pair} size="sm" label="مقایسه" onChange={v.setPair} />
                <LineChart labels={v.days} series={v.lines} height={v.n200} width={v.n560} yMin={v.n0} yMax={v.n10} hideLast />
              </div>
            </ChartContainer>
          </div>
          <Banner tone="info" title="هشدارها چطور کار می‌کنند" description={v.ruleDesc} actionLabel="تغییر قوانین" onAction={v.toPlan} />
          <WatchTrends title="ساعت ورزشی و سؤال‌های شما" days={this.props.data.days} customFields={this.props.data.customFields} />
        </div>
      </PanelLayout>
    );
  }
}
