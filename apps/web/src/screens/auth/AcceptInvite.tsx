// Invite link landing page (live mode): shows who the invite is for, sets a password and signs in.
// Coaches and admins continue to their panel; athletes are told to open the app.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthShell } from '@/app/auth';
import { faError, remote } from '@/data/api';
import { signIn } from '@/data/session';
import { Banner, Button, TextField } from '@/ds';
import { navigate } from '@/lib/nav';

type Info = { kind: 'admin' | 'coach' | 'athlete'; email: string; name: string; expired: boolean; used: boolean; coachName: string | null; branding: { appName: string } | null };

export default function AcceptInvite() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneAthlete, setDoneAthlete] = useState(false);

  useEffect(() => {
    remote.invite(token).then((i) => setInfo(i as Info), () => setFailed(true));
  }, [token]);

  const accept = async () => {
    if (p1.length < 8) return setErr('رمز باید حداقل ۸ کاراکتر باشد.');
    if (p1 !== p2) return setErr('تکرار رمز با رمز یکی نیست.');
    setBusy(true);
    setErr(null);
    try {
      const r = (await remote.acceptInvite(token, p1)) as Parameters<typeof signIn>[0];
      if (r.user.role === 'athlete') return setDoneAthlete(true);
      signIn(r);
      navigate(r.user.mfaSetupRequired ? '/account' : r.user.role === 'admin' ? '/admin' : '/coach');
    } catch (e) {
      setErr(faError(e));
      setBusy(false);
    }
  };

  if (failed || (info && (info.expired || info.used)))
    return (
      <AuthShell title="لینک دعوت معتبر نیست" description="این لینک منقضی شده یا قبلاً استفاده شده است. از کسی که شما را دعوت کرده بخواهید دعوت تازه‌ای بفرستد.">
        <Button variant="secondary" onClick={() => navigate('/coach/login')}>
          ورود
        </Button>
      </AuthShell>
    );
  if (!info) return <AuthShell title="در حال بررسی دعوت…" />;
  if (doneAthlete)
    return (
      <AuthShell title="حساب شما فعال شد" description={`اپ ${info.branding?.appName ?? 'indow'} را روی گوشی باز کنید و با ${info.email} وارد شوید.`}>
        <Banner tone="success" icon="check" title="آماده‌اید" description="برنامه تمرینی و پیام‌های مربی در اپ منتظر شماست." />
      </AuthShell>
    );

  const place = info.kind === 'admin' ? 'پنل مدیریت indow' : info.kind === 'coach' ? `فضای کاری ${info.branding?.appName ?? ''}` : `${info.branding?.appName ?? 'indow'} (مربی: ${info.coachName})`;
  return (
    <AuthShell title={`سلام ${info.name}`} description={`به ${place} دعوت شده‌اید. برای فعال‌سازی حساب یک رمز عبور بسازید.`}>
      <TextField label="ایمیل" dir="ltr" value={info.email} readOnly />
      <TextField label="رمز عبور" type="password" hint="حداقل ۸ کاراکتر" onChange={setP1} />
      <TextField label="تکرار رمز عبور" type="password" onChange={setP2} error={err ?? undefined} />
      <Button variant="primary" size="lg" fullWidth loading={busy} onClick={accept}>
        فعال‌سازی حساب
      </Button>
    </AuthShell>
  );
}
