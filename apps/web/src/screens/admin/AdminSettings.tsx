// Admin settings: own account (name, phone), password, two-factor login, appearance and sign-out.
import { useState, type ReactNode } from 'react';
import { AppearanceSettings } from '@/app/AppearanceSettings';
import { ChangePasswordForm } from '@/app/ChangePasswordForm';
import { PanelLayout } from '@/app/PanelLayout';
import { TwoFactorPanel } from '@/app/TwoFactorPanel';
import { ApiError, faError, remote } from '@/data/api';
import { logout, panelUser, refreshUser, useSessionUser } from '@/data/session';
import { Button, PageHeader, Sidebar, TextField, TopBar } from '@/ds';
import { faDigits, faLastSeen } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { toast } from '@/lib/toast';

const enDigits = (v: string) => v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section
      style={{
        maxWidth: 560,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>{title}</h3>
        {subtitle ? <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function AdminSettings() {
  // The panel route guard guarantees a session; the empty fallback only keeps the page renderable without one.
  const user = useSessionUser() ?? { name: '', email: '', phone: '', lastLogin: null };
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(faDigits(user.phone || ''));
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);
  const me = panelUser({ name: user.name, role: 'مدیر' });
  const dirty = name.trim() !== user.name || enDigits(phone).replace(/\s/g, '') !== (user.phone || '');

  const save = async () => {
    if (!name.trim()) return setErr({ name: 'نام را وارد کنید.' });
    setSaving(true);
    setErr({});
    try {
      await remote.updateMe({ name: name.trim(), phone: enDigits(phone).replace(/\s/g, '') });
      await refreshUser();
      toast('ذخیره شد', 'اطلاعات حساب به‌روز شد.');
    } catch (e) {
      if (e instanceof ApiError && (e.fields.phone || e.fields.name)) setErr({ phone: e.fields.phone && 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.', name: e.fields.name });
      else toast('ذخیره نشد', faError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelLayout
      sidebar={<Sidebar app="admin" active="settings" brandSub="مدیریت پلتفرم" user={me} />}
      topBar={<TopBar breadcrumbs={[{ label: 'نمای کلی', to: 'admin:dashboard' }, 'تنظیمات']} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
    >
      <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader title="تنظیمات" subtitle="حساب کاربری، رمز عبور، ورود دومرحله‌ای و ظاهر پنل" />
        <Section title="حساب کاربری" subtitle={me.role + (user.lastLogin ? ' · آخرین ورود ' + faLastSeen(user.lastLogin) : '')}>
          <TextField label="نام و نام خانوادگی" value={name} onChange={setName} error={err.name} />
          <TextField label="ایمیل" value={user.email} readOnly hint="ایمیل ورود را فقط مدیر ارشد دیگری می‌تواند تغییر دهد." />
          <TextField label="تلفن" optional placeholder="۰۹۱۲۱۲۳۴۵۶۷" value={phone} onChange={setPhone} error={err.phone} />
          <div>
            <Button variant="primary" icon="save" loading={saving} disabled={!dirty} onClick={save}>
              ذخیره تغییرات
            </Button>
          </div>
        </Section>
        <Section title="تغییر رمز عبور" subtitle="بعد از تغییر رمز، از همه دستگاه‌های دیگر خارج می‌شوید.">
          <ChangePasswordForm />
        </Section>
        <Section title="ورود دومرحله‌ای">
          <TwoFactorPanel onEnabled={() => void refreshUser()} />
        </Section>
        <AppearanceSettings />
        <div>
          <Button
            variant="ghost"
            icon="log-out"
            onClick={async () => {
              await logout();
              navigate('/admin/login');
            }}
          >
            خروج از حساب
          </Button>
        </div>
      </div>
    </PanelLayout>
  );
}
