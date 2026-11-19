// Ported from design handoff: project/C31 Coach Personal Records.dc.html
import { Fragment } from 'react';
import { Badge, Button, DataTable, PRCard, PageHeader, SearchField, SegmentedControl, Sidebar, Tag, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { faLastSeen } from '@/lib/format';
import { param } from '@/lib/nav';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: lift PRs and coach-test bests of every athlete (or `?id=`). */
export default function CoachPersonalRecordsPage(props: { brand?: string }) {
  const id = param('id') || undefined;
  const records = useQuery('records:' + (id || 'all'), () => remote.records(id));
  const tests = useQuery('test-results:' + (id || 'all'), () => remote.testResults(id));
  const defs = useQuery('tests', remote.tests);
  const wait = pending(records, tests, defs);
  if (wait) return wait;
  return <CoachPersonalRecords {...props} records={records.data} results={tests.data} defs={defs.data} />;
}

/** API data → the design's record rows (lift PRs + best result per athlete & test). */
function liveRows(records, results, defs) {
  const day = 86400000;
  const rows = records.map((r) => ({
    id: 'r' + r.id,
    athleteId: r.athleteId,
    a: r.athleteName,
    e: r.exerciseName,
    sub: /^\d+RM$/.test(r.type) ? 'حداکثر ' + parseInt(r.type).toLocaleString('fa-IR') + ' تکرار' : r.type,
    v: r.value,
    p: r.previous ?? '—',
    u: r.unit,
    d: r.previous ? Math.round(((r.value - r.previous) / r.previous) * 1000) / 10 : 0,
    t: faLastSeen(r.date, new Date(), false),
    o: Date.parse(r.date),
    c: 'str',
    isNew: Date.now() - Date.parse(r.date) < 7 * day,
  }));
  const CAT = { spd: 'spd', end: 'end', pow: 'pow', str: 'str', agi: 'spd', mob: 'pow' };
  const groups = new Map<string, any[]>();
  results.forEach((x) => {
    const k = x.athleteId + ':' + x.testId;
    groups.set(k, [...(groups.get(k) || []), x]);
  });
  groups.forEach((list) => {
    const lower = list[0].better === 'lower';
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const better = (a, b) => (lower ? a < b : a > b);
    let best = sorted[0];
    let prev = null;
    sorted.slice(1).forEach((x) => {
      if (better(x.value, best.value)) {
        prev = best;
        best = x;
      }
    });
    const def = defs.find((d) => d.id === best.testId);
    rows.push({
      id: 't' + best.id,
      athleteId: best.athleteId,
      a: list[0].athleteName || 'ورزشکار',
      e: best.testName,
      sub: lower ? 'بهترین زمان' : 'بهترین نتیجه',
      v: best.value,
      p: prev ? prev.value : '—',
      u: best.unit,
      d: prev ? Math.round(((best.value - prev.value) / prev.value) * 1000) / 10 : 0,
      t: faLastSeen(best.date, new Date(), false),
      o: Date.parse(best.date),
      c: CAT[def?.category] || 'end',
      lower,
      isNew: Date.now() - Date.parse(best.date) < 7 * day,
    });
  });
  return rows.sort((x, y) => y.o - x.o);
}

class CoachPersonalRecords extends Screen {
  state: ScreenState = { q: '', cat: 'all', sort: 'date', sent: [], page: 0 };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const { q, cat, sort, sent, page } = this.state;
    const PAGE = 20;
    const R = liveRows(this.props.records, this.props.results, this.props.defs);
    const CATS = { all: 'همه', str: 'قدرت', spd: 'سرعت', pow: 'توان', end: 'استقامت' };
    const val = (r) => (typeof r.v === 'number' ? fa(r.v) + (r.u ? ' ' + r.u : '') : r.v);
    const pv = (r) => (typeof r.p === 'number' ? fa(r.p) + (r.u ? ' ' + r.u : '') : r.p);
    let rows = R.filter((r) => (cat === 'all' || r.c === cat) && (!q.trim() || (r.a + ' ' + r.e).includes(q.trim())));
    if (sort === 'delta') rows = [...rows].sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    else if (sort === 'name') rows = [...rows].sort((x, y) => x.a.localeCompare(y.a, 'fa'));
    const latest = R.filter((r) => r.isNew);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'تحلیل‌ها', to: 'coach:analytics' }, 'رکوردهای شخصی'],
      exportIt: () => {
        const lines = ['athlete,exercise,type,value,unit,previous,date', ...R.map((r) => [r.a, r.e, r.sub, r.v, r.u, r.p, new Date(r.o).toISOString().slice(0, 10)].join(','))];
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        a.download = 'personal-records.csv';
        a.click();
        toast('خروجی آماده شد', fa(R.length) + ' رکورد');
      },
      newSub: fa(latest.length) + ' رکورد جدید از ' + fa(new Set(latest.map((r) => r.a)).size) + ' ورزشکار',
      latest: latest.map((r) => ({
        title: r.a + ' · ' + r.e,
        type: r.sub,
        date: r.t,
        value: typeof r.v === 'number' ? fa(r.v) : r.v,
        unit: r.u,
        prev: pv(r),
        delta: r.d,
        isNew: true,
        sent: sent.includes(r.id),
        canCongrats: !sent.includes(r.id),
        to: 'coach:history?id=' + r.athleteId,
        congrats: async () => {
          try {
            await remote.sendMessage(r.athleteId, 'رکورد جدید ' + r.e + '، عالی بود! 🎉');
          } catch (e) {
            return toast('ارسال نشد', faError(e), 'error');
          }
          this.setState({ sent: [...sent, r.id] });
          toast('تبریک ارسال شد', 'پیام «رکورد جدید ' + r.e + '، عالی بود!» برای ' + r.a + ' فرستاده شد.');
        },
      })),
      setQ: (v) => this.setState({ q: v, page: 0 }),
      cats: Object.keys(CATS).map((k) => ({ label: CATS[k], on: cat === k, pick: () => this.setState({ cat: k, page: 0 }) })),
      sortOpts: [
        { value: 'date', label: 'جدیدترین' },
        { value: 'delta', label: 'بیشترین تغییر' },
        { value: 'name', label: 'ورزشکار' },
      ],
      sort,
      setSort: (v) => this.setState({ sort: v }),
      cols: [
        { key: 'a', label: 'ورزشکار', type: 'person' },
        { key: 'e', label: 'حرکت · رکورد' },
        { key: 'v', label: 'بهترین جدید' },
        { key: 'p', label: 'قبلی' },
        { key: 'd', label: 'تغییر', type: 'delta' },
        { key: 't', label: 'تاریخ' },
      ],
      rows: rows.slice(page * PAGE, page * PAGE + PAGE).map((r) => ({
        id: r.id,
        a: { name: r.a },
        e: { label: r.e, sub: r.sub },
        v: val(r),
        p: pv(r),
        d: r.d,
        t: r.t,
        highlight: !!r.isNew && sort === 'date',
        lowerIsBetter: !!r.lower,
        to: 'coach:athlete?id=' + r.athleteId,
      })),
      pag: {
        label: rows.length ? fa(page * PAGE + 1) + '–' + fa(Math.min(rows.length, page * PAGE + PAGE)) + ' از ' + fa(rows.length) + ' رکورد' : '۰ رکورد',
        prevDisabled: page === 0,
        nextDisabled: (page + 1) * PAGE >= rows.length,
        onPrev: () => this.setState({ page: Math.max(0, page - 1) }),
        onNext: () => this.setState({ page: page + 1 }),
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
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader
            title="رکوردهای شخصی"
            subtitle="وقتی ورزشکار در یک حرکت و محدوده تکرار از بهترین رکورد قبلی خودش بهتر ثبت کند، رکورد خودکار شناسایی می‌شود."
            back="تحلیل‌ها"
            backTo="coach:analytics"
          >
            <Button variant="secondary" icon="download" onClick={v.exportIt}>
              خروجی
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>رکوردهای این هفته</h3>
            <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.newSub}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'stretch' }}>
            {(v.latest || []).map((p: any, $index: number) => (
              <Fragment key={$index}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                  <PRCard exercise={p?.title} type={p?.type} date={p?.date} value={p?.value} unit={p?.unit} previous={p?.prev} delta={p?.delta} isNew={p?.isNew} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {p?.canCongrats ? (
                      <>
                        <Button variant="secondary" size="sm" icon="send" onClick={p?.congrats}>
                          تبریک گفتن
                        </Button>
                      </>
                    ) : null}
                    {p?.sent ? (
                      <>
                        <Badge tone="success" icon="check" size="sm">
                          تبریک ارسال شد
                        </Badge>
                      </>
                    ) : null}
                    <Button variant="ghost" size="sm" to={p?.to}>
                      سابقه تمرین
                    </Button>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '300px' }}>
              <SearchField placeholder="جستجوی ورزشکار یا حرکت" onChange={v.setQ} />
            </div>
            {(v.cats || []).map((c: any, $index: number) => (
              <Fragment key={$index}>
                <div onClick={c?.pick} style={{ display: 'flex', cursor: 'pointer' }}>
                  <Tag variant="filter" selected={c?.on}>
                    {c?.label}
                  </Tag>
                </div>
              </Fragment>
            ))}
            <div style={{ flex: '1' }}></div>
            <SegmentedControl options={v.sortOpts} value={v.sort} size="sm" label="مرتب‌سازی" onChange={v.setSort} />
          </div>
          <DataTable columns={v.cols} rows={v.rows} emptyTitle="رکوردی یافت نشد" pagination={v.pag} />
          <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
            در رکوردهای زمانی عدد کمتر بهتر است؛ مثلاً تغییر ۴٫۳٪− سارا در ۵ کیلومتر یعنی پیشرفت.
          </p>
        </div>
      </PanelLayout>
    );
  }
}
