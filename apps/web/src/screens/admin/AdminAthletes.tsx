// Ported from design handoff: project/A06 Admin Athletes.dc.html
import { Banner, Button, DataTable, PageHeader, SearchField, Select, Sidebar, TopBar, type BulkAction, type Column, type MenuItem, type Row } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { ChangePasswordModal, type PasswordTarget } from '@/app/modals/ChangePasswordModal';
import { CoachPickerModal } from '@/app/modals/CoachPickerModal';
import { ShareLinkModal, type LinkTarget } from '@/app/modals/ShareLinkModal';
import { AdminAddAthleteModal } from '@/app/modals/AdminAddAthleteModal';
import { api } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { Athlete, Coach, Program } from '@/data/types';
import { faDigits, faLastActive, yearsSince } from '@/lib/format';
import { go } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { deleteAthlete } from '@/lib/deletions';
import { downloadCsv } from '@/lib/csv';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

const PAGE = 10;

/** Data container: athletes across all coaches (account data only — never health data). */
export default function AdminAthletesPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const coaches = useQuery('coaches', api.coaches.list);
  const programs = useQuery('programs', () => api.programs.list());
  return (
    <AdminAthletes
      {...props}
      athletes={athletes.data}
      coaches={coaches.data}
      programs={programs.data}
      loading={athletes.loading && !athletes.data}
      error={!!athletes.error}
      onRetry={athletes.refetch}
    />
  );
}

interface Props {
  brand?: string;
  athletes?: Athlete[];
  coaches?: Coach[];
  programs?: Program[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

class AdminAthletes extends Screen {
  declare props: Props;
  state: ScreenState = { sel: [], q: '', coach: 'all', status: 'all', page: 0, pw: null, link: null, transfer: null, transferTo: null };

  renderVals() {
    const { sel, q, coach, status, page } = this.state;
    const athletes = this.props.athletes || [];
    const coaches = this.props.coaches || [];
    const programs = this.props.programs || [];
    const coachName = (id: string) => coaches.find((c) => c.id === id)?.name ?? '—';
    const program = (a: Athlete) => {
      const p = programs.find((x) => x.id === a.programId);
      // Live admins see the program name only (programs themselves are coach data).
      if (!p) return a.programName ? { label: a.programName, sub: a.status === 'paused' ? 'متوقف' : 'هفته ' + faDigits(a.programWeek ?? 1) } : null;
      const sub = a.status === 'paused' ? 'متوقف' : 'هفته ' + faDigits(a.programWeek ?? 1) + ' از ' + faDigits(p.durationWeeks);
      return { label: p.name, sub };
    };
    const person = (a: Athlete) => {
      const g = a.gender === 'f' ? 'زن' : a.gender === 'm' ? 'مرد' : null;
      const age = a.birthDate ? faDigits(yearsSince(a.birthDate)) : null;
      return { name: a.name, sub: [g, age].filter(Boolean).join(' · ') };
    };
    const matched = athletes.filter((a) => (coach === 'all' || a.coachId === coach) && (status === 'all' || a.status === status) && (!q.trim() || a.name.includes(q.trim())));
    const pages = Math.max(1, Math.ceil(matched.length / PAGE));
    const pg = Math.min(page, pages - 1);
    const rows: Row[] = matched.slice(pg * PAGE, pg * PAGE + PAGE).map((a) => {
      const email = a.email || '';
      const noAccount = !a.userId;
      const actions: MenuItem[] = [
        ...(noAccount
          ? [{ label: 'لینک دعوت', icon: 'link', onClick: () => this.setState({ link: { kind: 'invite', inviteKind: 'athlete', id: a.id, name: a.name, email } }) }]
          : [
              { label: 'تغییر رمز', icon: 'key', onClick: () => this.setState({ pw: { id: a.id, userId: a.userId, name: a.name, email } }) },
              { label: 'لینک بازنشانی رمز', icon: 'link', onClick: () => this.setState({ link: { kind: 'reset', id: a.id, userId: a.userId, name: a.name, email } }) },
              { label: 'فعالیت و دستگاه‌ها', icon: 'activity', onClick: () => go('admin:activity?user=' + a.userId) },
            ]),
        { label: 'انتقال به مربی دیگر', icon: 'arrow-left', onClick: () => this.setState({ transfer: [a.id], transferTo: null }) },
        { divider: true },
        a.status === 'inactive'
          ? { label: 'فعال‌سازی مجدد', icon: 'refresh', onClick: () => api.athletes.setStatus([a.id], 'active').then(() => toast('حساب فعال شد', a.name)) }
          : {
              label: 'غیرفعال‌سازی',
              icon: 'minus-circle',
              destructive: true,
              onClick: () => api.athletes.setStatus([a.id], 'inactive').then(() => toast('حساب غیرفعال شد', a.name)),
            },
        // #102: gone for good, with every record and file
        { label: 'حذف برای همیشه', icon: 'trash', destructive: true, onClick: () => void deleteAthlete({ id: a.id, name: a.name }) },
      ];
      return { id: a.id, a: person(a), c: coachName(a.coachId), p: program(a), s: a.status, l: faLastActive(a.lastActiveAt), x: '', muted: a.status === 'inactive', actions };
    });
    const columns: Column[] = [
      { key: 'a', label: 'ورزشکار', type: 'person', sortable: true },
      { key: 'c', label: 'مربی' },
      { key: 'p', label: 'برنامه' },
      { key: 's', label: 'وضعیت', type: 'status' },
      { key: 'l', label: 'آخرین تمرین' },
      { key: 'x', label: '', type: 'actions', width: 48 },
    ];
    const bulk: BulkAction[] = [
      { label: 'انتقال به مربی دیگر', icon: 'arrow-left' },
      { label: 'فعال‌سازی مجدد', icon: 'refresh' },
      { label: 'غیرفعال‌سازی', icon: 'minus-circle', destructive: true },
    ];
    const from = matched.length ? pg * PAGE + 1 : 0;
    const coachesWithAthletes = coaches.filter((c) => athletes.some((a) => a.coachId === c.id));
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: ['ورزشکاران'],
      subtitle: faDigits(athletes.length) + ' ورزشکار در ' + faDigits(coaches.length) + ' مربی',
      coachOpts: [{ value: 'all', label: 'همه مربیان' }, ...coachesWithAthletes.map((c) => ({ value: c.id, label: c.name }))],
      statusOpts: [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'active', label: 'فعال' },
        { value: 'invited', label: 'دعوت‌شده' },
        { value: 'paused', label: 'متوقف' },
        { value: 'inactive', label: 'غیرفعال' },
      ],
      selected: sel,
      setQ: (v: string) => this.setState({ q: v, page: 0 }),
      setCoach: (v: string) => this.setState({ coach: v, page: 0 }),
      setStatus: (v: string) => this.setState({ status: v, page: 0 }),
      onSel: (ids: string[]) => this.setState({ sel: ids }),
      exportCsv: () => {
        downloadCsv(
          'athletes.csv',
          ['name', 'email', 'phone', 'coach', 'program', 'status', 'last_active'],
          matched.map((a) => [a.name, a.email || '', a.phone || '', coachName(a.coachId), a.programName || '', a.status, a.lastActiveAt || '']),
        );
        toast('خروجی آماده شد', faDigits(matched.length) + ' ورزشکار');
      },
      onBulk: (a: BulkAction, ids: string[]) => {
        if (a.label === 'انتقال به مربی دیگر') return this.setState({ transfer: ids, transferTo: null });
        const st = a.label === 'غیرفعال‌سازی' ? 'inactive' : 'active';
        api.athletes.setStatus(ids, st).then(() => {
          this.setState({ sel: [] });
          toast(a.label + ' انجام شد', faDigits(ids.length) + ' ورزشکار به‌روزرسانی شد.');
        });
      },
      bulk,
      columns,
      rows,
      pagination: {
        label: faDigits(from) + '–' + faDigits(Math.min(matched.length, pg * PAGE + PAGE)) + ' از ' + faDigits(matched.length),
        prevDisabled: pg === 0,
        nextDisabled: pg >= pages - 1,
        onPrev: () => this.setState({ page: pg - 1 }),
        onNext: () => this.setState({ page: pg + 1 }),
      },
    };
  }

  transfer = async (transferTo: string) => {
    const ids = (this.state as { transfer: string[] }).transfer;
    await Promise.all(ids.map((id) => api.athletes.transfer(id, transferTo)));
    const name = this.props.coaches?.find((c) => c.id === transferTo)?.name ?? '';
    this.setState({ transfer: null, sel: [] });
    toast('انتقال انجام شد', faDigits(ids.length) + ' ورزشکار به ' + name + ' منتقل شد.');
  };

  render() {
    const v = this.vals();
    const { pw, link, transfer } = this.state as { pw: PasswordTarget | null; link: LinkTarget | null; transfer: string[] | null };
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="athletes" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
        overlays={
          <>
            {pw ? <ChangePasswordModal target={pw} roleLabel="ورزشکار" onClose={() => this.setState({ pw: null })} /> : null}
            {link ? <ShareLinkModal target={link} onClose={() => this.setState({ link: null })} /> : null}
            {this.state.add ? <AdminAddAthleteModal coaches={this.props.coaches || []} onClose={() => this.setState({ add: false })} /> : null}
            {transfer ? (
              <CoachPickerModal
                coaches={this.props.coaches || []}
                count={transfer.length}
                // The athletes' current coach (when they all have the same one) isn't a destination.
                exclude={
                  [...new Set((this.props.athletes || []).filter((a) => transfer.includes(a.id)).map((a) => a.coachId))].length === 1
                    ? [(this.props.athletes || []).find((a) => transfer.includes(a.id))!.coachId]
                    : []
                }
                onPick={this.transfer}
                onClose={() => this.setState({ transfer: null })}
              />
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="ورزشکاران" subtitle={v.subtitle}>
            <Button variant="secondary" icon="download" onClick={v.exportCsv}>
              خروجی
            </Button>
            <Button variant="primary" icon="plus" onClick={() => this.setState({ add: true })}>
              افزودن ورزشکار
            </Button>
          </PageHeader>
          <Banner
            tone="info"
            title="فقط اطلاعات حساب"
            description="مدیران می‌توانند حساب ورزشکاران را منتقل، متوقف یا غیرفعال کنند. اطلاعات سلامت، یادداشت‌ها و جزئیات تمرین فقط برای ورزشکار و مربی‌اش قابل مشاهده است."
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '300px' }}>
              <SearchField placeholder="جستجوی ورزشکار" onChange={v.setQ} />
            </div>
            <div style={{ width: '200px' }}>
              <Select value="all" options={v.coachOpts} onChange={v.setCoach} />
            </div>
            <div style={{ width: '160px' }}>
              <Select value="all" options={v.statusOpts} onChange={v.setStatus} />
            </div>
          </div>
          <DataTable
            selectable
            selected={v.selected}
            onSelectChange={v.onSel}
            onBulkAction={v.onBulk}
            bulkActions={v.bulk}
            emptyTitle="ورزشکاری یافت نشد"
            columns={v.columns}
            rows={v.rows}
            pagination={v.pagination}
            loading={this.props.loading}
            error={this.props.error}
            onRetry={this.props.onRetry}
          />
        </div>
      </PanelLayout>
    );
  }
}
