// User activity (admins with reports permission): who is online, active users per day, recent sign-ins
// with their device, and time spent per section of the panel and the app — to see which parts people use
// and which to improve. A user opens a drawer with their sections and signed-in devices (sign one out).
import { useState } from 'react';
import { DeviceSessions } from '@/app/DeviceSessions';
import { PanelLayout } from '@/app/PanelLayout';
import { pending } from '@/app/pending';
import { remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import { Badge, Card, ChartContainer, ChartLegend, Drawer, LineChart, MetricCard, PageHeader, SegmentedControl, Sidebar, TopBar } from '@/ds';
import { faDayMonth, faDigits, faLastSeen } from '@/lib/format';
import { param } from '@/lib/nav';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');
const ROLE: Record<string, string> = { coach: 'مربی', athlete: 'ورزشکار', admin: 'مدیر' };

/** Panel route keys and app screens → readable section names. */
export const SECTION_LABEL: Record<string, string> = {
  'coach:dashboard': 'داشبورد',
  'coach:athletes': 'فهرست ورزشکاران',
  'coach:athlete': 'پروفایل ورزشکار',
  'coach:create-athlete': 'افزودن ورزشکار',
  'coach:library': 'کتابخانه حرکات',
  'coach:create-exercise': 'ساخت حرکت',
  'coach:exercise': 'جزئیات حرکت',
  'coach:programs': 'برنامه‌ها',
  'coach:create-program': 'ساخت برنامه',
  'coach:program-builder': 'برنامه‌ساز',
  'coach:program': 'جزئیات برنامه',
  'coach:assign': 'اختصاص برنامه',
  'coach:customize': 'شخصی‌سازی برنامه',
  'coach:history': 'سابقه تمرین',
  'coach:nutrition': 'برنامه تغذیه',
  'coach:recovery': 'برنامه ریکاوری',
  'coach:analytics': 'تحلیل‌ها · نمای کلی',
  'coach:strength': 'تحلیل‌ها · قدرت',
  'coach:endurance': 'تحلیل‌ها · استقامت',
  'coach:body': 'تحلیل‌ها · ترکیب بدن',
  'coach:recovery-analytics': 'تحلیل‌ها · ریکاوری',
  'coach:records': 'تحلیل‌ها · رکوردها',
  'coach:settings': 'تنظیمات',
  'coach:chat': 'گفتگو',
  'app:Home': 'خانه',
  'app:Workout': 'تمرین امروز',
  'app:Log': 'ثبت ست',
  'app:Exercise': 'ویدیو و نکات حرکت',
  'app:Complete': 'پایان تمرین',
  'app:Nutrition': 'تغذیه',
  'app:Recovery': 'ریکاوری',
  'app:Progress': 'پیشرفت',
  'app:Profile': 'پروفایل',
  'app:Measure': 'اندازه‌گیری بدن',
  'app:Records': 'رکوردها',
  'app:Health': 'پروفایل سلامت',
  'app:Chat': 'گفتگو',
  'app:Notifications': 'اعلان‌ها',
  'app:Session': 'جلسه ثبت‌شده',
  'app:Plan': 'برنامه هفته',
  'app:Password': 'تغییر رمز',
  'app:Devices': 'دستگاه‌ها',
  account: 'امنیت حساب',
};
export const sectionLabel = (s: string) => SECTION_LABEL[s] || (s.startsWith('admin:') ? 'مدیریت · ' + s.slice(6) : s.replace(/^app:/, 'اپ · ').replace(/^coach:/, 'پنل · '));
const minutes = (m: number) => (m >= 90 ? fa(Math.round(m / 6) / 10) + ' ساعت' : fa(Math.round(m)) + ' دقیقه');

/** Horizontal bars: minutes per section, biggest first. */
function SectionBars({ rows, onlyRole }: { rows: Json[]; onlyRole?: string }) {
  const list = rows.filter((r) => !onlyRole || r.role === onlyRole).slice(0, 14);
  const max = Math.max(1, ...list.map((r) => r.minutes));
  if (!list.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>هنوز داده‌ای ثبت نشده است. از این به بعد، با استفاده کاربران پر می‌شود.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((r) => (
        <div key={r.section + (r.role || '')} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 180px) 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.section}>
            {sectionLabel(r.section)}
          </span>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ width: (r.minutes / max) * 100 + '%', height: '100%', borderRadius: 5, background: 'var(--viz-1, var(--brand-primary))' }} />
          </div>
          <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {minutes(r.minutes)}
            {r.users != null ? ' · ' + fa(r.users) + ' نفر' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function UserDrawer({ userId, days, onClose }: { userId: string; days: number; onClose: () => void }) {
  const q = useQuery('admin-activity-user:' + userId + ':' + days, () => remote.userActivity(userId, days));
  const u = q.data;
  return (
    <Drawer open title={u ? u.name : 'در حال بارگذاری…'} subtitle={u ? ROLE[u.role] + ' · ' + u.email : undefined} onClose={onClose} width={520}>
      {u ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>{'بخش‌ها · ' + fa(days) + ' روز اخیر'}</strong>
            <SectionBars rows={u.sections} />
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>دستگاه‌های واردشده</strong>
            <DeviceSessions userId={userId} userName={u.name} />
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>ورودها</strong>
            {u.signIns.length ? (
              u.signIns.map((s: Json, i: number) => (
                <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <span>{s.device}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{faLastSeen(s.at) + (s.endedBy ? ' · خارج شد' : s.active ? '' : ' · منقضی')}</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ورودی در این بازه ثبت نشده.</span>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

export default function AdminActivity(props: { brand?: string }) {
  const [days, setDays] = useState('30');
  const [role, setRole] = useState('coach');
  // `?user=<id>` (from the coaches / athletes lists) opens that user's drawer.
  const [open, setOpen] = useState<string | null>(param('user'));
  const q = useQuery('admin-activity:' + days, () => remote.activity(+days));
  const wait = pending(q);
  const d = q.data;
  // Coaches and athletes only (admins using the panel aren't the audience being measured).
  const sum = (o: Json | undefined) => (o?.coach || 0) + (o?.athlete || 0);
  const split = (o: Json | undefined) => fa(o?.coach || 0) + ' مربی · ' + fa(o?.athlete || 0) + ' ورزشکار';
  return (
    <PanelLayout
      theme={props.brand ?? 'brand'}
      sidebar={<Sidebar app="admin" active="activity" brandSub="مدیریت پلتفرم" user={panelUser({ name: 'مدیر', role: 'مدیر' })} />}
      topBar={<TopBar breadcrumbs={[{ label: 'نمای کلی', to: 'admin:dashboard' }, 'فعالیت کاربران']} unread search />}
    >
      <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader title="فعالیت کاربران" subtitle="چه کسی، کی، با چه دستگاهی وارد شده و از کدام بخش‌ها بیشتر استفاده می‌شود">
          <SegmentedControl
            label="بازه"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '۷ روز' },
              { value: '30', label: '۳۰ روز' },
              { value: '90', label: '۹۰ روز' },
            ]}
          />
        </PageHeader>
        {wait || !d ? (
          wait
        ) : (
          <>
            <div className="bl-two-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
              <MetricCard label="آنلاین الان" icon="activity" value={fa(sum(d.online))} caption={split(d.online)} />
              <MetricCard label="فعال امروز" icon="users" value={fa(sum(d.activeToday))} caption={split(d.activeToday)} />
              <MetricCard label="فعال ۷ روز" icon="calendar" value={fa(sum(d.active7d))} caption={split(d.active7d)} />
              <MetricCard label={'ورودها · ' + fa(d.days) + ' روز'} icon="log-out" value={fa(d.signIns)} caption="هر ورود از یک دستگاه" />
            </div>
            <ChartContainer title="کاربران فعال در روز" summary="تعداد افرادی که هر روز از پنل یا اپ استفاده کرده‌اند">
              <LineChart
                labels={d.daily.map((x: Json, i: number) =>
                  i % Math.ceil(d.daily.length / 8) === 0 || i === d.daily.length - 1 ? faDayMonth(new Date(x.date + 'T12:00:00')) : '',
                )}
                series={[
                  { name: 'مربیان', values: d.daily.map((x: Json) => x.coach), color: 'viz-1', width: 2.5 },
                  { name: 'ورزشکاران', values: d.daily.map((x: Json) => x.athlete), color: 'viz-2' },
                ]}
                height={200}
                width={1100}
              />
              <ChartLegend
                items={[
                  { label: 'مربیان', color: 'viz-1' },
                  { label: 'ورزشکاران', color: 'viz-2' },
                ]}
              />
            </ChartContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)', gap: 16, alignItems: 'start' }}>
              <Card title="بیشترین استفاده از بخش‌ها" subtitle="مجموع زمانی که صفحه باز و در حال استفاده بوده">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SegmentedControl
                    label="نقش"
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: 'coach', label: 'مربیان (پنل)' },
                      { value: 'athlete', label: 'ورزشکاران (اپ)' },
                    ]}
                  />
                  <SectionBars rows={d.sections} onlyRole={role} />
                </div>
              </Card>
              <Card title="ورودهای اخیر" subtitle="هر ورود با دستگاه و آخرین فعالیت">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                  {d.recentLogins.length ? null : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ورودی ثبت نشده.</span>}
                  {d.recentLogins.map((s: Json, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOpen(String(s.userId))}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        padding: '6px 4px',
                        borderBottom: '1px solid var(--border-subtle, var(--border))',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{ROLE[s.role] + ' · ' + s.device + ' · ' + faLastSeen(s.at)}</span>
                      </span>
                      {s.online ? (
                        <Badge tone="success" size="sm">
                          آنلاین
                        </Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
            <Card title="کاربران" subtitle="بیشترین زمان استفاده در این بازه · برای جزئیات و دستگاه‌ها روی نام بزنید">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {['نام', 'نقش', 'زمان استفاده', 'بیشترین بخش', 'آخرین فعالیت'].map((h) => (
                        <th key={h} style={{ textAlign: 'start', fontWeight: 500, padding: '6px 8px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.users.map((u: Json) => (
                      <tr key={u.userId} onClick={() => setOpen(String(u.userId))} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '10px 8px' }}>{ROLE[u.role] || u.role}</td>
                        <td style={{ padding: '10px 8px' }}>{minutes(u.minutes)}</td>
                        <td style={{ padding: '10px 8px' }}>{u.topSection ? sectionLabel(u.topSection) : '—'}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{u.lastSeen ? faLastSeen(u.lastSeen) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.users.length ? null : <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>هنوز داده‌ای ثبت نشده است.</p>}
              </div>
            </Card>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              زمان هر بخش فقط وقتی شمرده می‌شود که صفحه باز است و کاربر در ۲ دقیقه اخیر با آن کار کرده. محتوای پیام‌ها و داده‌های تمرینی اینجا نمایش داده نمی‌شود.
            </p>
          </>
        )}
      </div>
      {open ? <UserDrawer userId={open} days={+days} onClose={() => setOpen(null)} /> : null}
    </PanelLayout>
  );
}
