// Account security (live mode): two-factor login and password. Admins land here when the platform
// requires 2FA; anyone whose password was reset with «force change» lands here to pick a new one.
import { AuthShell } from '@/app/auth';
import { ChangePasswordForm } from '@/app/ChangePasswordForm';
import { DeviceSessions } from '@/app/DeviceSessions';
import { TwoFactorPanel } from '@/app/TwoFactorPanel';
import { logout, refreshUser, useSessionUser } from '@/data/session';
import { Banner, Button } from '@/ds';
import { navigate } from '@/lib/nav';

export default function AccountSecurity() {
  const user = useSessionUser();
  if (!user) {
    navigate('/coach/login');
    return null;
  }
  const home = user.role === 'admin' ? '/admin' : '/coach';
  const blocked = user.mfaSetupRequired || user.forcePasswordChange;

  return (
    <AuthShell title="امنیت حساب" description={user.name + ' · ' + user.email}>
      {user.forcePasswordChange ? (
        <Banner tone="warning" icon="key" title="رمز عبور را تغییر دهید" description="برای حساب شما رمز موقت گذاشته شده است. قبل از ادامه یک رمز جدید انتخاب کنید." />
      ) : null}
      {user.mfaSetupRequired ? (
        <Banner tone="warning" icon="shield" title="ورود دومرحله‌ای الزامی است" description="برای ادامه کار در پنل مدیریت، ورود دومرحله‌ای را فعال کنید." />
      ) : null}
      {user.role !== 'athlete' ? <TwoFactorPanel onEnabled={() => void refreshUser()} /> : null}
      <div style={{ height: 1, background: 'var(--border-subtle)' }} />
      <strong>تغییر رمز عبور</strong>
      <ChangePasswordForm />
      <div style={{ height: 1, background: 'var(--border-subtle)' }} />
      <strong>دستگاه‌های واردشده</strong>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -8 }}>اگر دستگاهی را نمی‌شناسید یا گوشی‌تان گم شده، از همین‌جا از آن خارج شوید.</span>
      <DeviceSessions />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <Button variant="primary" disabled={blocked} onClick={() => navigate(home)}>
          ادامه به پنل
        </Button>
        <Button
          variant="ghost"
          icon="log-out"
          onClick={async () => {
            const role = user.role;
            await logout();
            navigate(role === 'admin' ? '/admin/login' : '/coach/login');
          }}
        >
          خروج
        </Button>
      </div>
    </AuthShell>
  );
}
