// Signed-in devices (sign-in sessions): your own on the account page, or a user's for admins. Ending one
// signs that device out (its notifications stop too); signing in is never limited.
import { Badge, Button } from '@/ds';
import { faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { logout } from '@/data/session';
import { confirmDialog } from '@/lib/confirm';
import { faLastSeen } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { toast } from '@/lib/toast';

export function DeviceSessions({ userId, userName }: { userId?: string; userName?: string }) {
  const admin = !!userId;
  const q = useQuery('sessions:' + (userId || 'me'), () => remote.sessions(userId));
  const rows = q.data || [];
  const endOne = async (s: (typeof rows)[number]) => {
    const ok = await confirmDialog({
      title: 'خروج از «' + s.device + '»',
      description: s.current
        ? 'از همین دستگاه خارج می‌شوید.'
        : (admin ? userName + ' ' : '') + 'روی این دستگاه از حساب خارج می‌شود و اعلان‌هایش قطع می‌شود. ورود دوباره با رمز ممکن است.',
      confirmLabel: 'خروج از دستگاه',
      destructive: true,
      action: () => remote.endSession(s.id, userId),
    });
    if (!ok) return;
    if (s.current && !admin) {
      await logout();
      return navigate('/coach/login');
    }
    toast('از دستگاه خارج شد', s.device);
  };
  const endAll = async () => {
    const ok = await confirmDialog({
      title: admin ? 'خروج ' + userName + ' از همه دستگاه‌ها' : 'خروج از دستگاه‌های دیگر',
      description: admin ? 'روی همه دستگاه‌ها از حساب خارج می‌شود؛ می‌تواند دوباره با رمز وارد شود.' : 'همه دستگاه‌ها به‌جز همین یکی از حساب شما خارج می‌شوند.',
      confirmLabel: 'خروج',
      destructive: true,
      action: () => remote.endOtherSessions(userId),
    });
    if (ok) toast(admin ? 'از همه دستگاه‌ها خارج شد' : 'دستگاه‌های دیگر خارج شدند');
  };
  const others = rows.filter((r) => !r.current).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {q.error ? <p style={{ margin: 0, fontSize: 13, color: 'var(--error)' }}>{faError(q.error)}</p> : null}
      {!q.loading && !rows.length ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>دستگاه فعالی ثبت نشده است.</p> : null}
      {rows.map((s) => (
        <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
              {s.device}
              {s.current ? (
                <Badge tone="success" size="sm">
                  این دستگاه
                </Badge>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {'آخرین فعالیت ' + faLastSeen(s.lastSeenAt) + ' · ورود ' + faLastSeen(s.createdAt, new Date(), false) + (s.ip ? ' · ' : '')}
              {s.ip ? <span dir="ltr">{s.ip}</span> : null}
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="log-out" onClick={() => void endOne(s)}>
            خروج
          </Button>
        </div>
      ))}
      {admin ? (
        rows.length ? (
          <Button variant="secondary" icon="log-out" onClick={() => void endAll()}>
            خروج از همه دستگاه‌ها
          </Button>
        ) : null
      ) : others ? (
        <Button variant="secondary" icon="log-out" onClick={() => void endAll()}>
          {'خروج از ' + others.toLocaleString('fa-IR') + ' دستگاه دیگر'}
        </Button>
      ) : null}
    </div>
  );
}
