// Password reset link landing page (live mode). The link is single-use and valid for 24 hours.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AuthShell } from '@/app/auth';
import { faError, remote } from '@/data/api';
import { Banner, Button, TextField } from '@/ds';
import { navigate } from '@/lib/nav';

export default function ResetPassword() {
  const { token = '' } = useParams();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const save = async () => {
    if (p1.length < 8) return setErr('رمز باید حداقل ۸ کاراکتر باشد.');
    if (p1 !== p2) return setErr('تکرار رمز با رمز یکی نیست.');
    setBusy(true);
    try {
      await remote.resetPassword(token, p1);
      setDone(true);
    } catch (e) {
      setErr(faError(e));
      setBusy(false);
    }
  };

  if (done)
    return (
      <AuthShell title="رمز عبور تغییر کرد" description="همه نشست‌های قبلی بسته شد. حالا با رمز جدید وارد شوید (ورزشکاران از داخل اپ).">
        <Banner tone="success" icon="check" title="انجام شد" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={() => navigate('/coach/login')}>
            ورود مربی
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/login')}>
            ورود مدیر
          </Button>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell title="ساخت رمز عبور جدید" description="این لینک ۲۴ ساعت و فقط یک بار معتبر است.">
      <TextField label="رمز جدید" type="password" hint="حداقل ۸ کاراکتر" onChange={setP1} />
      <TextField label="تکرار رمز جدید" type="password" onChange={setP2} error={err ?? undefined} />
      <Button variant="primary" size="lg" fullWidth loading={busy} onClick={save}>
        ذخیره رمز
      </Button>
    </AuthShell>
  );
}
