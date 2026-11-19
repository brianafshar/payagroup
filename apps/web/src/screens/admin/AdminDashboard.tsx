// Ported from design handoff: project/A02 Admin Dashboard.dc.html
import { Fragment } from 'react';
import { SPORTS } from '@/data/exercises';
import { Badge, Button, Card, DataTable, DescriptionList, ListRow, MetricCard, PageHeader, Sidebar, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import { faDate, faDayMonth, faDigits, faLastSeen, faTime } from '@/lib/format';
import { pending } from '@/app/pending';
import { Screen } from '../Screen';

export const AUDIT_LABEL: Record<string, [string, string]> = {
  'coach.create': ['user', 'مربی ایجاد شد'],
  'coach.update': ['palette', 'مربی ویرایش شد'],
  'coach.extend': ['calendar', 'اعتبار مربی تمدید شد'],
  'coach.activate': ['check-circle', 'مربی فعال شد'],
  'coach.deactivate': ['minus-circle', 'مربی غیرفعال شد'],
  'coach.expired': ['clock', 'حساب مربی منقضی شد'],
  'password.change': ['key', 'رمز عبور تغییر کرد'],
  'password.forgot': ['mail', 'رمز جدید به ایمیل فرستاده شد'],
  'password.reset': ['key', 'رمز با لینک بازنشانی عوض شد'],
  'coach.renewal_request': ['calendar', 'درخواست تمدید ثبت شد'],
  'password.reset-link': ['link', 'لینک بازنشانی کپی شد'],
  'password.reset-email': ['mail', 'لینک بازنشانی ایمیل شد'],
  'invite.copy': ['link', 'لینک دعوت کپی شد'],
  'invite.send': ['mail', 'دعوت ارسال شد'],
  'invite.accept': ['check', 'دعوت پذیرفته شد'],
  'athlete.transfer': ['users', 'ورزشکار منتقل شد'],
  'athlete.status': ['users', 'وضعیت ورزشکاران تغییر کرد'],
  'admin.update': ['shield', 'نقش مدیر تغییر کرد'],
  'admin.remove': ['shield', 'دسترسی مدیر حذف شد'],
  'mfa.enable': ['shield', 'ورود دومرحله‌ای فعال شد'],
  'mfa.reset': ['shield', 'ورود دومرحله‌ای بازنشانی شد'],
  'settings.update': ['settings', 'تنظیمات پلتفرم ذخیره شد'],
  'user.session.end': ['log-out', 'کاربر از یک دستگاه خارج شد'],
  'user.sessions.end_all': ['log-out', 'کاربر از همه دستگاه‌ها خارج شد'],
  'athlete.delete': ['trash', 'ورزشکار حذف شد'],
};

/** Data container: platform KPIs and recent admin activity. */
export default function AdminDashboardPage(props: { brand?: string }) {
  const stats = useQuery('admin-stats', remote.adminStats);
  const audit = useQuery('admin-audit', () => remote.auditEvents().catch(() => []));
  const wait = pending(stats, audit);
  if (wait) return wait;
  return <AdminDashboard {...props} stats={stats.data} audit={audit.data} />;
}

class AdminDashboard extends Screen {
  live() {
    const st = this.props.stats;
    const fa = (n: number) => faDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));
    const c = st.coaches;
    const total = Object.values(c as Record<string, number>).reduce((a, b) => a + b, 0);
    const prev = st.workoutsPrev7d;
    const STATUS = { draft: 'پیش‌نویس', invited: 'دعوت‌شده', inactive: 'غیرفعال' };
    return {
      coaches: { value: fa(total), caption: `${fa(c.active)} فعال · ${fa(c.draft)} پیش‌نویس · ${fa(c.inactive)} غیرفعال` },
      athletes: { value: fa(st.athletes.total), caption: `${fa(st.athletes.newMonth)}+ در ۳۰ روز اخیر` },
      workouts: { value: fa(st.workouts7d), delta: prev ? Math.round(((st.workouts7d - prev) / prev) * 1000) / 10 : undefined, spark: st.workoutsByDay },
      logins: { value: fa(st.coachLogins7d), unit: '/ ' + fa(c.active) },
      rows: st.setup.map((x) => ({
        id: String(x.id),
        a: { name: x.name, sub: x.appName },
        s: x.status,
        n:
          x.status === 'draft'
            ? { label: 'فعال نشده', sub: 'ایجاد: ' + faDate(new Date(x.createdAt)) }
            : x.status === 'invited'
              ? { label: 'هنوز وارد نشده', sub: 'دعوت: ' + faLastSeen(x.createdAt, new Date(), false) }
              : { label: (STATUS[x.status] || x.status) + (x.expiresAt ? ' از ' + faDayMonth(new Date(x.expiresAt)) : ''), sub: fa(x.athletes) + ' ورزشکار' },
        x: '',
        to: 'admin:coach?id=' + x.id,
      })),
      sports: SPORTS.map(([key, name]) => {
        const n = st.sports?.[key] ?? 0;
        return n ? { name, tone: 'success', icon: 'check-circle', label: 'فعال · ' + fa(n) + ' مربی' } : { name, tone: 'neutral', icon: 'clock', label: 'بدون مربی فعال' };
      }),
      platform: [
        { label: 'نسخه پلتفرم', value: st.platform.version },
        { label: 'منطقه', value: st.platform.region },
        { label: 'پشتیبانی', value: st.platform.supportEmail },
      ],
      activity: this.props.audit.slice(0, 5).map((e) => {
        const [icon, title] = AUDIT_LABEL[e.action] || ['clock', e.action];
        const at = new Date(e.at);
        const today = new Date().toDateString() === at.toDateString();
        return { icon, title, subtitle: e.actorName ? 'توسط ' + e.actorName : 'سیستم', value: today ? faTime(at) : faDayMonth(at) };
      }),
    };
  }

  renderVals() {
    return {
      L: this.live(),
      today: faDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: ['نمای کلی'],
      one: 1,
      columns: [
        { key: 'a', label: 'مربی', type: 'person' },
        { key: 's', label: 'وضعیت', type: 'status' },
        { key: 'n', label: 'قدم بعدی' },
        { key: 'x', label: '', type: 'actions', width: 48 },
      ],
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="dashboard" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
      >
        <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PageHeader title="نمای کلی پلتفرم" subtitle={v.today}>
            <Button variant="primary" icon="plus" to="admin:create-coach">
              ایجاد مربی
            </Button>
          </PageHeader>
          <div className="bl-two-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <MetricCard label="مربیان" value={v.L.coaches.value} caption={v.L.coaches.caption} icon="building" />
            <MetricCard label="ورزشکاران" value={v.L.athletes.value} caption={v.L.athletes.caption} icon="users" />
            <MetricCard
              label="تمرین‌های ثبت‌شده، ۷ روز"
              value={v.L.workouts.value}
              delta={v.L.workouts.delta}
              caption="نسبت به ۷ روز قبل"
              icon="dumbbell"
              spark={v.L.workouts.spark}
            />
            <MetricCard label="ورود مربیان، ۷ روز" value={v.L.logins.value} unit={v.L.logins.unit} caption="فقط مربیان فعال" icon="user" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <Card title="مربیان نیازمند راه‌اندازی" subtitle="حساب‌هایی که هنوز کامل فعال نشده‌اند" actionLabel="همه مربیان" actionTo="admin:coaches" padding="none">
                <DataTable bare columns={v.columns} rows={v.L.rows} emptyTitle="همه مربیان فعال هستند" />
              </Card>
            </div>
            <Card title="ماژول‌های ورزشی" subtitle="حرکات، شاخص‌ها و تحلیل‌ها بر اساس رشته">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '0' }}>
                {v.L.sports.map((s: any, $index: number) => (
                  <Fragment key={$index}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <p style={{ margin: '0', flex: '1', fontSize: '14px', lineHeight: '22px', color: 'var(--text-primary)' }}>{s?.name}</p>
                      <Badge tone={s?.tone} icon={s?.icon} size="sm">
                        {s?.label}
                      </Badge>
                    </div>
                  </Fragment>
                ))}
              </div>
            </Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <Card title="فعالیت‌های اخیر مدیران" actionLabel="گزارش رویدادها" actionTo="admin:access" padding="none">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {v.L.activity.length ? (
                    v.L.activity.map((a, i) => <ListRow key={i} icon={a.icon} title={a.title} subtitle={a.subtitle} value={a.value} chevron={false} />)
                  ) : (
                    <ListRow icon="clock" title="رویدادی ثبت نشده" chevron={false} />
                  )}
                </div>
              </Card>
            </div>
            <Card title="پلتفرم">
              <DescriptionList columns={v.one} items={v.L.platform} />
            </Card>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
