// Ported from design handoff: project/A05 Admin Coach Details.dc.html
import { Badge, BrandMark, Button, Card, DataTable, DescriptionList, ListRow, MetricCard, PageHeader, Sidebar, Tabs, TopBar } from '@/ds';
import { SPORT_LABEL } from '@/data/exercises';
import { ChangePasswordModal } from '@/app/modals/ChangePasswordModal';
import { ShareLinkModal, type LinkTarget } from '@/app/modals/ShareLinkModal';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { validityBadge } from './AdminCoaches';
import { AUDIT_LABEL } from './AdminDashboard';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import type { Athlete, Coach } from '@/data/types';
import { faDate, faDayMonth, faDigits, faLastActive, faLastSeen, faTime } from '@/lib/format';
import { go, param } from '@/lib/nav';
import { deleteCoach } from '@/lib/deletions';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the coach in `?id=` and their counts. */
export default function AdminCoachDetailsPage(props: { brand?: string }) {
  const id = param('id') || '';
  const coach = useQuery('coach:' + id, () => api.coaches.get(id));
  const summary = useQuery('coach-summary:' + id, () => remote.coachSummary(id));
  const wait = pending(coach, summary);
  if (wait) return wait;
  return <AdminCoachDetails {...props} coach={coach.data} summary={summary.data} />;
}

type Tab = 'overview' | 'branding' | 'athletes' | 'access' | 'activity';
const TABS: Tab[] = ['overview', 'branding', 'athletes', 'access', 'activity'];

/** «ورزشکاران» tab: the coach's athletes, loaded when the tab opens. */
function AthletesTab({ coachId }: { coachId: string }) {
  const list = useQuery('coach-athletes:' + coachId, () => api.athletes.list({ coachId }));
  if (list.loading && !list.data) return <p style={{ color: 'var(--text-muted)' }}>در حال بارگذاری…</p>;
  if (list.error) return <p style={{ color: 'var(--error)' }}>{faError(list.error)}</p>;
  const rows = ((list.data as Athlete[]) || []).map((a) => ({ id: a.id, a: { name: a.name, sub: a.email || '—' }, s: a.status, l: faLastActive(a.lastActiveAt) }));
  return (
    <Card title="ورزشکاران این مربی" actionLabel="همه ورزشکاران" actionTo="admin:athletes">
      {rows.length ? (
        <DataTable
          columns={[
            { key: 'a', label: 'ورزشکار', type: 'person' },
            { key: 's', label: 'وضعیت', type: 'status' },
            { key: 'l', label: 'آخرین فعالیت' },
          ]}
          rows={rows}
        />
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>این مربی هنوز ورزشکاری ندارد.</p>
      )}
    </Card>
  );
}

/** «فعالیت» tab: audit events about the coach and their login account. */
function ActivityTab({ coach }: { coach: Coach }) {
  const events = useQuery('coach-audit:' + coach.id, async () => {
    const [a, b] = await Promise.all([remote.auditEventsFor('coach', coach.id), coach.userId ? remote.auditEventsFor('user', coach.userId) : Promise.resolve([])]);
    return [...a, ...b].sort((x, y) => String(y.at).localeCompare(String(x.at)));
  });
  if (events.loading && !events.data) return <p style={{ color: 'var(--text-muted)' }}>در حال بارگذاری…</p>;
  if (events.error) return <p style={{ color: 'var(--text-muted)' }}>{faError(events.error, 'گزارش رویدادها در دسترس نیست.')}</p>;
  const list = (events.data || []) as Array<{ action: string; at: string; actorName?: string | null }>;
  return (
    <Card title="فعالیت" subtitle="رویدادهای ثبت‌شده برای این مربی">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {list.length ? (
          list.map((e, i) => {
            const [icon, title] = AUDIT_LABEL[e.action] || ['clock', e.action];
            const at = new Date(e.at);
            const when = new Date().toDateString() === at.toDateString() ? faTime(at) : faDayMonth(at);
            return <ListRow key={i} icon={icon} title={title} subtitle={e.actorName ? 'توسط ' + e.actorName : 'سیستم'} value={when} chevron={false} />;
          })
        ) : (
          <ListRow icon="clock" title="رویدادی ثبت نشده" chevron={false} />
        )}
      </div>
    </Card>
  );
}

class AdminCoachDetails extends Screen {
  state: ScreenState = { tab: (TABS as string[]).includes(param('tab') || '') ? (param('tab') as Tab) : 'overview', pw: null, link: null };

  live() {
    const c: Coach = this.props.coach;
    const s = this.props.summary;
    const fa = (n: number | undefined) => (n == null ? '—' : faDigits(n));
    const st = c.status;
    const prev = s.workoutsPrevWeek;
    return {
      c,
      status: st,
      name: c.name,
      subtitle: [c.branding.appName, SPORT_LABEL[c.sport] || c.sport, 'مربی از ' + faDate(new Date(c.createdAt))].join(' · '),
      metrics: {
        athletes: fa(s.athletes),
        athletesCap: fa(s.activeAthletes) + ' فعال' + (c.athleteCap ? ' · سقف ' + faDigits(c.athleteCap) : ''),
        programs: fa(s.templates),
        programsCap: 'قالب · ' + fa(s.assigned) + ' نسخه اختصاص‌یافته',
        workouts: fa(s.workoutsWeek),
        workoutsDelta: prev ? Math.round(((s.workoutsWeek - prev) / prev) * 1000) / 10 : undefined,
        login: c.lastLoginAt ? faLastSeen(c.lastLoginAt) : 'هرگز',
      },
      account: [
        { label: 'ایمیل', value: c.email },
        { label: 'نام اپ', value: c.branding.appName },
        { label: 'رشته', value: SPORT_LABEL[c.sport] || c.sport },
        { label: 'سقف ورزشکار', value: c.athleteCap ? fa(s.athletes) + ' از ' + faDigits(c.athleteCap) + ' استفاده‌شده' : 'نامحدود' },
        { label: 'اعتبار حساب', value: validityBadge(c).label },
        { label: 'یادآوری انقضا', value: faDigits(c.reminderDays) + ' روز قبل' },
        { label: 'تأیید دومرحله‌ای', value: s.twoFactor ? 'فعال' : 'غیرفعال' },
      ],
      branding: c.branding,
    };
  }

  renderVals() {
    const L = this.live();
    const act = L.status === 'active';
    // Still being set up: activation goes through step 3 (invite), not the status toggle.
    const setup = L.status === 'draft' || L.status === 'invited';
    return {
      L,
      setup,
      deactLabel: act ? 'غیرفعال‌سازی' : 'فعال‌سازی مجدد',
      deactivate: async () => {
        try {
          await api.coaches.setStatus(L.c.id, act ? 'inactive' : 'active');
        } catch (e) {
          return toast('انجام نشد', faError(e), 'error');
        }
        toast(act ? 'مربی غیرفعال شد' : 'مربی دوباره فعال شد', act ? 'داده‌های مربی و ورزشکارانش حفظ شد.' : 'دسترسی مربی بازگردانده شد.');
      },
      remove: async () => {
        if (await deleteCoach({ id: L.c.id, name: L.name, athletes: L.c.athleteCount })) go('admin:coaches');
      },
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: [{ label: 'مربیان', to: 'admin:coaches' }, L.name],
      badges: [{ status: L.status }],
      tabs: [
        { id: 'overview', label: 'نمای کلی' },
        { id: 'branding', label: 'برندینگ' },
        { id: 'athletes', label: 'ورزشکاران', count: L.metrics.athletes },
        { id: 'access', label: 'دسترسی' },
        { id: 'activity', label: 'فعالیت' },
      ],
      two: 2,
      account: L.account,
      tab: this.state.tab as Tab,
      setTab: (t: string) => {
        this.setState({ tab: t });
        // Keep the tab in the URL so reloading or sharing the link opens it again.
        window.history.replaceState(null, '', '?id=' + L.c.id + (t === 'overview' ? '' : '&tab=' + t));
      },
      access: [
        { label: 'وضعیت حساب', value: validityBadge(L.c).label },
        { label: 'ایمیل ورود', value: L.c.email },
        { label: 'آخرین ورود', value: L.metrics.login },
        { label: 'تأیید دومرحله‌ای', value: this.props.summary.twoFactor ? 'فعال' : 'غیرفعال' },
      ],
      openPw: () => this.setState({ pw: { id: L.c.id, userId: L.c.userId, name: L.name, email: L.c.email } }),
      openReset: () => this.setState({ link: { kind: 'reset', id: L.c.id, userId: L.c.userId, name: L.name, email: L.c.email } as LinkTarget }),
      openInvite: () => this.setState({ link: { kind: 'invite', id: L.c.id, name: L.name, email: L.c.email, inviteKind: 'coach' } as LinkTarget }),
      extend: () =>
        api.coaches.extend(L.c.id, 30).then(
          () => toast('اعتبار تمدید شد', L.name + ' · ۳۰ روز'),
          (e) => toast('انجام نشد', faError(e), 'error'),
        ),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="coaches" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
      >
        <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PageHeader back="مربیان" backTo="admin:coaches" title={v.L.name} avatar={v.L.name} subtitle={v.L.subtitle} badges={v.badges}>
            {v.setup ? (
              <Button variant="secondary" icon="send" to={'admin:activate-coach?id=' + v.L.c.id}>
                بازبینی و فعال‌سازی
              </Button>
            ) : (
              <Button variant="secondary" icon="minus-circle" onClick={v.deactivate}>
                {v.deactLabel}
              </Button>
            )}
            <Button variant="secondary" icon="trash" onClick={v.remove}>
              حذف برای همیشه
            </Button>
            <Button variant="primary" icon="edit" to={'admin:branding?id=' + v.L.c.id}>
              ویرایش مربی
            </Button>
          </PageHeader>
          <Tabs value={v.tab} tabs={v.tabs} onChange={v.setTab} />
          {v.tab === 'athletes' ? <AthletesTab coachId={v.L.c.id} /> : null}
          {v.tab === 'activity' ? <ActivityTab coach={v.L.c} /> : null}
          {v.tab === 'access' ? (
            <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="دسترسی و ورود">
                <DescriptionList columns={v.two} items={v.access} />
              </Card>
              <Card title="اقدام‌ها">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" icon="key" onClick={v.openPw}>
                    تغییر رمز
                  </Button>
                  {v.L.status === 'invited' ? (
                    <Button variant="secondary" icon="mail" onClick={v.openInvite}>
                      لینک دعوت
                    </Button>
                  ) : (
                    <Button variant="secondary" icon="link" onClick={v.openReset}>
                      لینک بازنشانی رمز
                    </Button>
                  )}
                  <Button variant="secondary" icon="calendar" onClick={v.extend}>
                    تمدید ۳۰ روز
                  </Button>
                  {v.setup ? null : (
                    <Button variant="ghost" icon="minus-circle" onClick={v.deactivate}>
                      {v.deactLabel}
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          ) : null}
          {v.tab === 'overview' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
              <MetricCard label="ورزشکاران" value={v.L.metrics.athletes} caption={v.L.metrics.athletesCap} icon="users" />
              <MetricCard label="برنامه‌ها" value={v.L.metrics.programs} caption={v.L.metrics.programsCap} icon="clipboard" />
              <MetricCard label="تمرین‌های این هفته" value={v.L.metrics.workouts} delta={v.L.metrics.workoutsDelta} caption="نسبت به هفته قبل" icon="dumbbell" />
              <MetricCard label="آخرین ورود" value={v.L.metrics.login} icon="clock" />
            </div>
          ) : null}
          {v.tab === 'overview' || v.tab === 'branding' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
              {v.tab === 'overview' ? (
                <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
                  <Card title="حساب" actionLabel="ویرایش" actionTo={'admin:branding?id=' + v.L.c.id}>
                    <DescriptionList columns={v.two} items={v.account} />
                  </Card>
                </div>
              ) : null}
              <div
                data-theme={v.L.branding.theme || 'brand'}
                style={{ display: 'contents', ['--brand-primary' as string]: v.L.branding.primary, ['--brand-secondary' as string]: v.L.branding.secondary }}
              >
                <Card title="برندینگ" actionLabel="پیکربندی" actionTo={'admin:branding?id=' + v.L.c.id}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                    <BrandMark name={v.L.branding.appName} initials={v.L.branding.initials} sub="اپ ورزشکار" size="lg" />
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-primary)' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)' }}>اصلی</p>
                          <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '20px' }}>
                            {v.L.branding.primary}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-secondary)' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)' }}>ثانویه</p>
                          <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '20px' }}>
                            {v.L.branding.secondary}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge tone="success" icon="check-circle" size="sm">
                      کنتراست AA روی همه سطوح
                    </Badge>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
        </div>
        {this.state.pw ? <ChangePasswordModal target={this.state.pw} roleLabel="مربی" onClose={() => this.setState({ pw: null })} /> : null}
        {this.state.link ? <ShareLinkModal target={this.state.link} onClose={() => this.setState({ link: null })} /> : null}
      </PanelLayout>
    );
  }
}
