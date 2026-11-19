import { useState } from 'react';
import { ApiError, faError, remote } from '@/data/api';
import { signIn } from '@/data/session';
import { Button, TextField } from '@/ds';
import { toast } from '@/lib/toast';

/** Own password change (current + new twice). Other sessions end; this one continues with fresh tokens. */
export function ChangePasswordForm() {
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Remounting the fields clears them after a successful change.
  const [round, setRound] = useState(0);

  const submit = async () => {
    if (p1.length < 8) return setErr('رمز جدید باید حداقل ۸ کاراکتر باشد.');
    if (p1 !== p2) return setErr('تکرار رمز با رمز جدید یکی نیست.');
    setBusy(true);
    setErr(null);
    try {
      const r = await remote.changePassword(cur, p1);
      signIn(r as Parameters<typeof signIn>[0]);
      toast('رمز عبور تغییر کرد', 'نشست‌های دیگر شما بسته شد.');
      setCur('');
      setP1('');
      setP2('');
      setRound((n) => n + 1);
    } catch (e) {
      setErr(e instanceof ApiError && e.fields.currentPassword ? 'رمز فعلی درست نیست.' : e instanceof ApiError && e.fields.newPassword ? e.fields.newPassword : faError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField label="رمز فعلی" type="password" onChange={setCur} />
      <TextField label="رمز جدید" type="password" hint="حداقل ۸ کاراکتر" onChange={setP1} />
      <TextField label="تکرار رمز جدید" type="password" onChange={setP2} error={err ?? undefined} />
      <div>
        <Button variant="secondary" icon="key" loading={busy} disabled={!cur || !p1 || !p2} onClick={submit}>
          تغییر رمز
        </Button>
      </div>
    </div>
  );
}
