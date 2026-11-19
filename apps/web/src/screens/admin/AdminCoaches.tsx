// Ported from design handoff: project/A03 Admin Coaches.dc.html
import { Fragment } from 'react';
import { SPORTS } from '@/data/exercises';
import { Button, DataTable, PageHeader, SearchField, Select, Sidebar, Tag, TopBar, type Column, type MenuItem, type Row } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { ChangePasswordModal, type PasswordTarget } from '@/app/modals/ChangePasswordModal';
import { ShareLinkModal, type LinkTarget } from '@/app/modals/ShareLinkModal';
import { api } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { Coach } from '@/data/types';
import { daysUntil, faDate, faDayMonth, faDigits, faLastSeen } from '@/lib/format';
import { go } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { deleteCoach } from '@/lib/deletions';
import { downloadCsv } from '@/lib/csv';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

const PAGE = 8;
const FILTERS: Array<[string, string]> = [
  ['all', 'همه'],
  ['active', 'فعال'],
  ['draft', 'پیش‌نویس'],
  ['invited', 'دعوت‌شده'],
  ['inactive', 'غیرفعال'],
];

/** Account-validity badge: days left + end date (green; orange ≤ 7 days; red expired → auto-inactive). */
export function validityBadge(c: Coach): { label: string; tone: string; icon: string } {
  const v = c.validity;
  if (v.kind === 'unlimited') return { label: 'نامحدود', tone: 'neutral', icon: 'check' };
  if (!v.expiresAt)
    return c.status === 'invited'
      ? { label: faDigits(v.days) + ' روز از فعال‌سازی', tone: 'neutral', icon: 'clock' }
      : { label: 'پس از فعال‌سازی', tone: 'neutral', icon: 'clock' };
  const left = daysUntil(v.expiresAt);
  const end = faDayMonth(new Date(v.expiresAt));
  if (left < 0) return { label: 'منقضی · ' + end, tone: 'error', icon: 'x' };
  return { label: faDigits(left) + ' روز · تا ' + end, tone: left <= 7 ? 'warning' : 'success', icon: left <= 7 ? 'alert-triangle' : 'calendar' };
}

/** Data container: loads coaches from the API and renders the screen. */
export default function AdminCoachesPage(props: { brand?: string }) {
  const coaches = useQuery('coaches', api.coaches.list);
  return <AdminCoaches {...props} coaches={coaches.data} loading={coaches.loading && !coaches.data} error={!!coaches.error} onRetry={coaches.refetch} />;
}

interface Props {
  brand?: string;
  coaches?: Coach[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

class AdminCoaches extends Screen {
  declare props: Props;
  state: ScreenState = { filter: 'all', q: '', sport: 'all', page: 0, sort: { key: 'a', dir: 'asc' }, pw: null, link: null };

  renderVals() {
    const { filter, q: rawQ, sport, page, sort } = this.state;
    const coaches = this.props.coaches || [];
    const q = rawQ.trim().toLowerCase();
    const withStatus = coaches.map((c) => ({ c, st: c.status }));
    const count = (id: string) => (id === 'all' ? withStatus.length : withStatus.filter((x) => x.st === id).length);
    const matched = withStatus
      .filter(({ c, st }) => (filter === 'all' || st === filter) && (sport === 'all' || c.sport === sport) && (!q || (c.name + ' ' + c.branding.appName).toLowerCase().includes(q)))
      .sort((x, y) => {
        const d = sort.dir === 'desc' ? -1 : 1;
        if (sort.key === 'n') return ((x.c.athleteCount ?? -1) - (y.c.athleteCount ?? -1)) * d;
        return x.c.name.localeCompare(y.c.name, 'fa') * d;
      });
    const pages = Math.max(1, Math.ceil(matched.length / PAGE));
    const pg = Math.min(page, pages - 1);
    const rows: Row[] = matched.slice(pg * PAGE, pg * PAGE + PAGE).map(({ c, st }) => {
      const actions: MenuItem[] = [
        { label: 'مشاهده جزئیات', icon: 'eye', onClick: () => go('admin:coach?id=' + c.id) },
        { label: 'تنظیم برندینگ', icon: 'palette', onClick: () => go('admin:branding?id=' + c.id) },
        { label: 'تغییر رمز', icon: 'key', onClick: () => this.setState({ pw: { id: c.id, userId: c.userId, name: c.name, email: c.email } }) },
        ...(c.userId ? [{ label: 'فعالیت و دستگاه‌ها', icon: 'activity', onClick: () => go('admin:activity?user=' + c.userId) }] : []),
        {
          label: 'تمدید ۳۰ روز',
          icon: 'calendar',
          onClick: () => api.coaches.extend(c.id, 30).then(() => toast('اعتبار تمدید شد', c.name + ' · ۳۰ روز')),
        },
      ];
      if (st === 'invited')
        actions.push({ label: 'لینک دعوت', icon: 'link', onClick: () => this.setState({ link: { kind: 'invite', id: c.id, name: c.name, email: c.email, inviteKind: 'coach' } }) });
      if (st !== 'draft')
        actions.push({
          label: 'لینک بازنشانی رمز',
          icon: 'link',
          onClick: () => this.setState({ link: { kind: 'reset', id: c.id, userId: c.userId, name: c.name, email: c.email } }),
        });
      actions.push({ divider: true });
      actions.push(
        st === 'inactive'
          ? { label: 'فعال‌سازی دوباره', icon: 'check', onClick: () => api.coaches.setStatus(c.id, 'active').then(() => toast('حساب فعال شد', c.name)) }
          : {
              label: 'غیرفعال کردن',
              icon: 'x',
              destructive: true,
              onClick: () => api.coaches.setStatus(c.id, 'inactive').then(() => toast('حساب غیرفعال شد', c.name + ' و ورزشکارانش دیگر نمی‌توانند وارد شوند.')),
            },
        // #102
        { label: 'حذف برای همیشه', icon: 'trash', destructive: true, onClick: () => void deleteCoach({ id: c.id, name: c.name, athletes: c.athleteCount }) },
      );
      return {
        id: c.id,
        a: { name: c.name, sub: c.branding.appName },
        s: st,
        n: c.athleteCount,
        exp: validityBadge(c),
        l: c.status === 'draft' ? '—' : faLastSeen(c.lastLoginAt),
        c: faDate(new Date(c.createdAt)),
        x: '',
        muted: st === 'inactive',
        actions,
        to: (c.status === 'draft' ? 'admin:branding?id=' : 'admin:coach?id=') + c.id,
      };
    });
    const columns: Column[] = [
      { key: 'a', label: 'مربی · اپ', type: 'person', sortable: true },
      { key: 's', label: 'وضعیت', type: 'status' },
      { key: 'n', label: 'ورزشکاران', type: 'number', align: 'right', sortable: true, empty: '—' },
      { key: 'exp', label: 'اعتبار حساب', type: 'badge' },
      { key: 'l', label: 'آخرین ورود' },
      { key: 'c', label: 'تاریخ ایجاد' },
      { key: 'x', label: '', type: 'actions', width: 48 },
    ];
    const from = matched.length ? pg * PAGE + 1 : 0;
    const to = Math.min(matched.length, pg * PAGE + PAGE);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: ['مربیان'],
      subtitle: faDigits(count('all')) + ' مربی · ' + faDigits(count('active')) + ' فعال',
      setQ: (v: string) => this.setState({ q: v, page: 0 }),
      setSport: (v: string) => this.setState({ sport: v, page: 0 }),
      exportCsv: () => {
        downloadCsv(
          'coaches.csv',
          ['name', 'email', 'app', 'sport', 'status', 'athletes', 'cap', 'expires_at', 'last_login'],
          matched.map(({ c, st }) => [
            c.name,
            c.email,
            c.branding.appName,
            c.sport,
            st,
            c.athleteCount ?? '',
            c.athleteCap ?? '',
            c.validity.kind === 'limited' ? c.validity.expiresAt || '' : '',
            c.lastLoginAt || '',
          ]),
        );
        toast('خروجی آماده شد', faDigits(matched.length) + ' مربی');
      },
      filters: FILTERS.map(([id, label]) => ({ label, count: faDigits(count(id)), on: id === filter, pick: () => this.setState({ filter: id, page: 0 }) })),
      sportOpts: [{ value: 'all', label: 'همه رشته‌ها' }, ...SPORTS.map(([value, label]) => ({ value, label }))],
      sort,
      onSort: (key: string, dir: 'asc' | 'desc') => this.setState({ sort: { key, dir }, page: 0 }),
      columns,
      rows,
      pagination: {
        label: faDigits(from) + '–' + faDigits(to) + ' از ' + faDigits(matched.length),
        prevDisabled: pg === 0,
        nextDisabled: pg >= pages - 1,
        onPrev: () => this.setState({ page: pg - 1 }),
        onNext: () => this.setState({ page: pg + 1 }),
      },
    };
  }

  render() {
    const v = this.vals();
    const { pw, link } = this.state as { pw: PasswordTarget | null; link: LinkTarget | null };
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="coaches" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
        overlays={
          <>
            {pw ? <ChangePasswordModal target={pw} roleLabel="مربی" onClose={() => this.setState({ pw: null })} /> : null}
            {link ? <ShareLinkModal target={link} onClose={() => this.setState({ link: null })} /> : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="مربیان" subtitle={v.subtitle}>
            <Button variant="secondary" icon="download" onClick={v.exportCsv}>
              خروجی
            </Button>
            <Button variant="primary" icon="plus" to="admin:create-coach">
              ایجاد مربی
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '320px' }}>
              <SearchField placeholder="جستجو با نام مربی یا اپ" onChange={v.setQ} />
            </div>
            {v.filters.map((f: { label: string; count: string; on: boolean; pick: () => void }) => (
              <Fragment key={f.label}>
                <div onClick={f.pick} style={{ display: 'flex', cursor: 'pointer' }}>
                  <Tag variant="filter" selected={f.on} count={f.count}>
                    {f.label}
                  </Tag>
                </div>
              </Fragment>
            ))}
            <div style={{ flex: '1' }}></div>
            <div style={{ width: '180px' }}>
              <Select value="all" options={v.sportOpts} onChange={v.setSport} />
            </div>
          </div>
          <DataTable
            sort={v.sort}
            onSort={v.onSort}
            columns={v.columns}
            rows={v.rows}
            pagination={v.pagination}
            loading={this.props.loading}
            error={this.props.error}
            onRetry={this.props.onRetry}
            emptyTitle="مربی‌ای یافت نشد"
            emptyDescription="عبارت جستجو یا فیلتر را تغییر دهید."
          />
        </div>
      </PanelLayout>
    );
  }
}
