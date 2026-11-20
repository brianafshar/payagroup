// Ported from design handoff: project/C11 Coach Athletes.dc.html
import { Fragment } from 'react';
import { Avatar, Badge, Button, DataTable, Modal, PageHeader, SearchField, SegmentedControl, Select, Sidebar, Tag, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { api, faError } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { Athlete, AttentionFlag, Goal, Program } from '@/data/types';
import { faDigits, faLastActive } from '@/lib/format';
import { go } from '@/lib/nav';
import { deleteAthlete } from '@/lib/deletions';
import { toast } from '@/lib/toast';
import { downloadCsv } from '@/lib/csv';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

export const GOAL_LABEL: Record<Goal, string> = { gain: 'عضله‌سازی', loss: 'کاهش چربی', str: 'قدرتی', gen: 'آمادگی عمومی' };

const FLAG: Record<AttentionFlag, { label: string; tone: string; icon: string }> = {
  pr: { label: 'رکورد جدید', tone: 'record', icon: 'trophy' },
  missed: { label: 'غیبت در تمرین', tone: 'error', icon: 'x-circle' },
  down: { label: 'افت عملکرد', tone: 'warning', icon: 'trend-down' },
  soreness: { label: 'کوفتگی شدید', tone: 'warning', icon: 'activity' },
  nutrition: { label: 'تغذیه', tone: 'warning', icon: 'utensils' },
};

const PAGE = 10;

/** List row shape the screen renders (derived from `Athlete` + its program). */
function toRow(a: Athlete, programs: Program[]) {
  const p = programs.find((x) => x.id === a.programId);
  const week = faDigits(a.programWeek ?? 1);
  const flag = a.stats?.flag ? { ...FLAG[a.stats.flag] } : null;
  if (flag && a.stats?.flag === 'nutrition' && a.stats.flagValue != null) flag.label = 'تغذیه ' + faDigits(a.stats.flagValue) + '٪';
  return {
    id: a.id,
    email: a.email || '',
    a: { name: a.name, sub: a.goal ? GOAL_LABEL[a.goal] : '' },
    p: p
      ? { label: p.name, sub: a.status === 'paused' ? 'متوقف در هفته ' + week : 'هفته ' + week + ' از ' + faDigits(p.durationWeeks) + (a.customized ? ' · شخصی‌سازی‌شده' : '') }
      : null,
    s: a.status,
    adh: a.stats?.adherencePct ?? null,
    l: faLastActive(a.lastActiveAt),
    d: a.stats?.strengthChangePct ?? null,
    f: flag,
    attn: !!flag,
    muted: a.status === 'paused',
  };
}

/** Data container: the signed-in coach's athletes. */
export default function CoachAthletesPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const programs = useQuery('programs', () => api.programs.list());
  const setStatus = async (r: { id: string; a: { name: string } }, status: 'active' | 'paused' | 'inactive') => {
    try {
      await api.athletes.setStatus([r.id], status);
      toast({ active: 'ورزشکار فعال شد', paused: 'ورزشکار متوقف شد', inactive: 'ورزشکار غیرفعال شد' }[status], r.a.name);
    } catch (e) {
      toast('انجام نشد', faError(e), 'error');
    }
  };
  return (
    <CoachAthletes
      {...props}
      setStatus={setStatus}
      athletes={athletes.data}
      programs={programs.data}
      loading={athletes.loading && !athletes.data}
      error={!!athletes.error}
      onRetry={athletes.refetch}
    />
  );
}

class CoachAthletes extends Screen {
  state: ScreenState = { filter: 'all', q: '', program: 'all', view: 'list', sort: { key: 'adh', dir: 'asc' }, page: 0 };
  renderVals() {
    const fa = faDigits;
    const programs: Program[] = this.props.programs || [];
    const all = ((this.props.athletes as Athlete[]) || []).map((x) => toRow(x, programs));
    const { filter, q, program, view, sort, page } = this.state;
    const match = (r) => filter === 'all' || (filter === 'attn' ? r.attn : r.s === filter);
    let rows = all.filter((r) => match(r) && (program === 'all' || (r.p && r.p.label === program)) && (!q.trim() || r.a.name.includes(q.trim())));
    const key = sort.key,
      dir = sort.dir === 'desc' ? -1 : 1;
    rows = rows.slice().sort((x, y) => {
      const a = key === 'a' ? x.a.name : x[key],
        b = key === 'a' ? y.a.name : y[key];
      if (a == null) return 1;
      if (b == null) return -1;
      return (typeof a === 'string' ? a.localeCompare(b, 'fa') : a - b) * dir;
    });
    const count = (id) => all.filter((r) => (id === 'all' ? true : id === 'attn' ? r.attn : r.s === id)).length;
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    const pg = Math.min(page, pages - 1);
    const total = rows.length;
    rows = rows.slice(pg * PAGE, pg * PAGE + PAGE);
    const defs = [
      ['all', 'همه'],
      ['attn', 'نیازمند توجه'],
      ['active', 'فعال'],
      ['paused', 'متوقف'],
    ];
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'داشبورد', to: 'coach:dashboard' }, 'ورزشکاران'],
      subtitle: fa(all.length) + ' ورزشکار · ' + fa(count('active')) + ' فعال',
      exportCsv: () => {
        const byId = new Map(((this.props.athletes as Athlete[]) || []).map((x) => [x.id, x]));
        downloadCsv(
          'athletes.csv',
          ['name', 'email', 'goal', 'program', 'status', 'adherence_pct', 'strength_change_pct', 'last_active'],
          rows.map((r) => {
            const x = byId.get(r.id);
            return [r.a.name, x?.email || '', r.a.sub, r.p ? r.p.label : '', r.s, r.adh ?? '', r.d ?? '', x?.lastActiveAt || ''];
          }),
        );
        toast('خروجی آماده شد', faDigits(rows.length) + ' ورزشکار');
      },
      setQ: (v) => this.setState({ q: v, page: 0 }),
      filters: defs.map(([id, label]) => ({ label, count: fa(count(id)), on: id === filter, pick: () => this.setState({ filter: id, page: 0 }) })),
      programOpts: [{ value: 'all', label: 'همه برنامه‌ها' }, ...[...new Set(programs.map((p) => p.name))].map((n) => ({ value: n, label: n }))],
      setProgram: (v) => this.setState({ program: v, page: 0 }),
      views: [
        { value: 'list', label: 'فهرست', icon: 'list' },
        { value: 'grid', label: 'کارت', icon: 'grid' },
      ],
      setView: (v) => this.setState({ view: v }),
      isList: view === 'list',
      isGrid: view === 'grid',
      sort,
      onSort: (k, d) => this.setState({ sort: { key: k, dir: d } }),
      columns: [
        { key: 'a', label: 'ورزشکار', type: 'person', sortable: true },
        { key: 'p', label: 'برنامه' },
        { key: 's', label: 'وضعیت', type: 'status' },
        { key: 'adh', label: 'تمرین‌ها، ۳۰ روز', type: 'progress', sortable: true },
        { key: 'd', label: 'قدرت، ۴ هفته', type: 'delta', align: 'right', sortable: true },
        { key: 'f', label: 'هشدار', type: 'badge' },
        { key: 'l', label: 'آخرین تمرین' },
        { key: 'x', label: '', type: 'actions', width: 48 },
      ],
      rows: rows.map((r) => ({
        ...r,
        x: '',
        to: 'coach:athlete?id=' + r.id,
        progName: r.p ? r.p.label : 'بدون برنامه',
        progSub: r.p ? r.p.sub : '',
        adhLabel: r.adh == null ? '—' : '٪' + fa(r.adh),
        actions: [
                { icon: 'user', label: 'مشاهده پروفایل', onClick: () => go('coach:athlete?id=' + r.id) },
                { icon: 'clipboard', label: r.p ? 'برنامه‌ها' : 'اختصاص برنامه', onClick: () => go('coach:programs') },
                { icon: 'calendar', label: 'سابقه تمرین', onClick: () => go('coach:history?id=' + r.id) },
                { icon: 'utensils', label: 'برنامه تغذیه', onClick: () => go('coach:nutrition?id=' + r.id) },
                { icon: 'moon', label: 'برنامه ریکاوری', onClick: () => go('coach:recovery?id=' + r.id) },
                { icon: 'progress', label: 'تحلیل‌ها', onClick: () => go('coach:analytics?id=' + r.id) },
                { divider: true },
                r.s === 'active'
                  ? { icon: 'minus-circle', label: 'توقف موقت', onClick: () => void this.props.setStatus(r, 'paused') }
                  : { icon: 'check-circle', label: 'فعال‌سازی دوباره', onClick: () => void this.props.setStatus(r, 'active') },
                ...(r.s !== 'inactive' ? [{ icon: 'x', label: 'غیرفعال کردن', destructive: true, onClick: () => void this.props.setStatus(r, 'inactive') }] : []),
                { icon: 'trash', label: 'حذف ورزشکار', destructive: true, onClick: () => void deleteAthlete({ id: r.id, name: r.a.name }) },
        ],
        open: () => go('coach:athlete?id=' + r.id),
      })),
      pagination: {
        label: total ? fa(pg * PAGE + 1) + '–' + fa(Math.min(total, pg * PAGE + PAGE)) + ' از ' + fa(total) : fa(0) + ' مورد',
        prevDisabled: pg === 0,
        nextDisabled: pg >= pages - 1,
        onPrev: () => this.setState({ page: pg - 1 }),
        onNext: () => this.setState({ page: pg + 1 }),
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="athletes" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="ورزشکاران" subtitle={v.subtitle}>
            <Button variant="secondary" icon="download" onClick={v.exportCsv}>
              خروجی
            </Button>
            <Button variant="primary" icon="plus" to="coach:create-athlete">
              افزودن ورزشکار
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '260px' }}>
              <SearchField placeholder="جستجو با نام" onChange={v.setQ} />
            </div>
            {(v.filters || []).map((f: any, $index: number) => (
              <Fragment key={$index}>
                <div onClick={f?.pick} style={{ display: 'flex', cursor: 'pointer' }}>
                  <Tag variant="filter" selected={f?.on} count={f?.count}>
                    {f?.label}
                  </Tag>
                </div>
              </Fragment>
            ))}
            <div style={{ flex: '1' }}></div>
            <div style={{ width: '200px' }}>
              <Select value="all" options={v.programOpts} onChange={v.setProgram} />
            </div>
            <SegmentedControl options={v.views} value="list" onChange={v.setView} label="نما" />
          </div>
          {v.isList ? (
            <>
              <DataTable
                sort={v.sort}
                onSort={v.onSort}
                columns={v.columns}
                rows={v.rows}
                pagination={v.pagination}
                loading={this.props.loading}
                error={this.props.error}
                onRetry={this.props.onRetry}
                emptyTitle="ورزشکاری یافت نشد"
                emptyDescription="عبارت جستجو یا فیلتر را تغییر دهید."
              />
            </>
          ) : null}
          {v.isGrid ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignContent: 'start' }}>
                {(v.rows || []).map((r: any, $index: number) => (
                  <Fragment key={$index}>
                    <div
                      className="hv-lift"
                      onClick={r?.open}
                      style={{
                        cursor: 'pointer',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        minWidth: '0',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: '0' }}>
                        <Avatar name={r?.a?.name} size="md" />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                          <span style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '600' }}>{r?.a?.name}</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{r?.a?.sub}</span>
                        </div>
                        <Badge status={r?.s} size="sm" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', lineHeight: '20px' }}>{r?.progName}</span>
                        <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{r?.progSub}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', lineHeight: '18px', color: 'var(--text-secondary)' }}>
                        <span>
                          {'آخرین تمرین: '}
                          {r?.l}
                        </span>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{r?.adhLabel}</span>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </PanelLayout>
    );
  }
}
