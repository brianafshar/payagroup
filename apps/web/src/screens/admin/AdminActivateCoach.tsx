// Create coach, step 3 of 3: review the account and branding, then send the invite (or copy its link).
// The coach becomes «دعوت‌شده» and turns active when they accept the invite and set a password.
// A coach who already has a password (e.g. created in Django admin) is activated directly.
import { useState } from 'react';
import { SPORT_LABEL } from '@/data/exercises';
import { PanelLayout } from '@/app/PanelLayout';
import { pending } from '@/app/pending';
import { api, faError } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import type { Coach } from '@/data/types';
import { BrandMark, Button, Card, DescriptionList, PageHeader, Sidebar, StepIndicator, TopBar } from '@/ds';
import { faDigits } from '@/lib/format';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { validityBadge } from './AdminCoaches';

export default function AdminActivateCoachPage() {
  const id = param('id') || '';
  const coach = useQuery('coach:' + id, () => api.coaches.get(id));
  const wait = pending(coach);
  if (wait) return wait;
  return <AdminActivateCoach key={id} coach={coach.data as Coach} />;
}

function AdminActivateCoach({ coach: c }: { coach: Coach }) {
  const [busy, setBusy] = useState<'send' | 'copy' | 'activate' | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const who = { kind: 'coach' as const, id: c.id, userId: c.userId };
  const direct = c.hasAccount !== false; // already has a password → no invite needed
  const done = c.status === 'active';

  const account = [
    { label: 'نام', value: c.name },
    { label: 'ایمیل', value: c.email },
    { label: 'نام اپ', value: c.branding.appName },
    { label: 'رشته', value: SPORT_LABEL[c.sport] || c.sport },
    { label: 'سقف ورزشکار', value: c.athleteCap ? faDigits(c.athleteCap) + ' ورزشکار' : 'نامحدود' },
    { label: 'مدت اعتبار', value: c.validity.kind === 'unlimited' ? 'نامحدود' : faDigits(c.validity.days) + ' روز از فعال‌سازی' },
    { label: 'یادآوری انقضا', value: c.validity.kind === 'unlimited' ? '—' : faDigits(c.reminderDays) + ' روز قبل' },
    { label: 'وضعیت فعلی', value: validityBadge(c).label },
  ];

  const send = async () => {
    setBusy('send');
    try {
      await api.auth.inviteLink(who, { send: true });
      go('admin:coach?id=' + c.id, { title: 'دعوت‌نامه ارسال شد', desc: 'بعد از ساخت رمز توسط ' + c.name + '، حساب خودکار فعال می‌شود.' });
    } catch (e) {
      setBusy(null);
      toast('ارسال نشد', faError(e), 'error');
    }
  };
  const copy = async () => {
    setBusy('copy');
    try {
      const r = await api.auth.inviteLink(who, { send: false });
      setUrl(r.url);
      if (r.url) await navigator.clipboard?.writeText(r.url).catch(() => {});
      setCopied(true);
      toast('لینک دعوت کپی شد', 'لینک ۷ روز و یک بار معتبر است.');
    } catch (e) {
      toast('لینک ساخته نشد', faError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const activate = async () => {
    setBusy('activate');
    try {
      await api.coaches.setStatus(c.id, 'active');
      go('admin:coach?id=' + c.id, { title: 'مربی فعال شد', desc: c.name + ' اکنون می‌تواند وارد پنل شود.' });
    } catch (e) {
      setBusy(null);
      toast('فعال نشد', faError(e), 'error');
    }
  };

  const box = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    minWidth: 0,
  };
  return (
    <PanelLayout
      sidebar={<Sidebar app="admin" active="coaches" brandSub="مدیریت پلتفرم" user={panelUser({ name: 'مدیر', role: 'مدیر' })} />}
      topBar={<TopBar breadcrumbs={[{ label: 'مربیان', to: 'admin:coaches' }, c.name, 'بازبینی و فعال‌سازی']} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
    >
      <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title={'بازبینی و فعال‌سازی · ' + c.name} subtitle="مرحله ۳ از ۳ · اطلاعات را بررسی کنید و دعوت‌نامه را بفرستید" back="مربیان" backTo="admin:coaches" />
        <StepIndicator current={3} steps={['حساب', 'برندینگ', 'بازبینی و فعال‌سازی']} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Card title="حساب و فضای کاری">
              <DescriptionList columns={2} items={account} />
            </Card>
            <div data-theme={c.branding.theme || 'brand'} style={{ ['--brand-primary' as string]: c.branding.primary, ['--brand-secondary' as string]: c.branding.secondary }}>
              <Card title="برندینگ" actionLabel="ویرایش" actionTo={'admin:branding?id=' + c.id}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <BrandMark name={c.branding.appName} initials={c.branding.initials} src={c.branding.logoUrl || undefined} sub="اپ ورزشکار" size="lg" />
                  {[
                    ['اصلی', 'var(--brand-primary)', c.branding.primary],
                    ['ثانویه', 'var(--brand-secondary)', c.branding.secondary],
                  ].map(([label, bg, hex]) => (
                    <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: bg }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                        <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {hex}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" icon="arrow-right" to={'admin:branding?id=' + c.id}>
                بازگشت
              </Button>
              <Button variant="secondary" to={'admin:coach?id=' + c.id}>
                بعداً
              </Button>
              {done ? (
                <Button variant="primary" icon="check" to={'admin:coach?id=' + c.id}>
                  مربی فعال است
                </Button>
              ) : direct ? (
                <Button variant="primary" icon="check" loading={busy === 'activate'} onClick={activate}>
                  فعال‌سازی حساب
                </Button>
              ) : (
                <Button variant="primary" icon="send" loading={busy === 'send'} onClick={send}>
                  ارسال دعوت‌نامه و فعال‌سازی
                </Button>
              )}
            </div>
          </div>
          <div style={box}>
            {direct ? (
              <>
                <h3 style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>فعال‌سازی مستقیم</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--text-secondary)' }}>
                  {c.name} قبلاً رمز عبور دارد، پس دعوت‌نامه لازم نیست. با فعال‌سازی، مدت اعتبار از امروز شمرده می‌شود و مربی با همان ایمیل و رمز وارد پنل می‌شود.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>پیش‌نمایش دعوت‌نامه</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{'موضوع: دعوت به ' + c.branding.appName}</p>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                  {'سلام ' +
                    c.name +
                    '، شما دعوت شده‌اید تا به پنل مربی ' +
                    c.branding.appName +
                    ' بپیوندید. برای ساخت رمز عبور و فعال‌سازی حساب روی لینک ایمیل بزنید. این لینک ۷ روز معتبر است و فقط یک بار قابل استفاده است.'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  {'گیرنده: '}
                  <span dir="ltr" style={{ fontFamily: 'var(--font-mono)' }}>
                    {c.email}
                  </span>
                </p>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>یا لینک را خودتان بفرستید</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div
                    dir="ltr"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-sunken)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {url || 'لینک پس از «کپی لینک» ساخته می‌شود'}
                  </div>
                  <Button variant="secondary" size="sm" icon={copied ? 'check' : 'copy'} loading={busy === 'copy'} onClick={copy}>
                    {copied ? 'کپی شد' : 'کپی لینک'}
                  </Button>
                </div>
                <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)' }}>
                  مثلاً در واتس‌اپ یا تلگرام. با ساخت لینک، مربی «دعوت‌شده» می‌شود و بعد از ساخت رمز فعال می‌شود.
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </PanelLayout>
  );
}
