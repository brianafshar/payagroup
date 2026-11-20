import { useState } from 'react';
import { ApiError, faError, remote } from '@/data/api';
import { setUser, type SessionUser, useSessionUser } from '@/data/session';
import { Button, TextField } from '@/ds';
import { toast } from '@/lib/toast';

/** Own username change (new username + current password). The signed-in session continues. */
export function ChangeUsernameForm() {
  const me = useSessionUser();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  const submit = async () => {
    const next = name.trim();
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(next)) return setErr('نام کاربری ۳ تا ۴۰ نویسه و فقط حروف انگلیسی، عدد و _ . - باشد.');
    setBusy(true);
    setErr(null);
    try {
      const user = await remote.changeUsername(next, pw);
      setUser(user as unknown as SessionUser);
      toast('نام کاربری تغییر کرد', 'از این پس با «' + next + '» وارد شوید.');
      setName('');
      setPw('');
      setRound((n) => n + 1);
    } catch (e) {
      setErr(
        e instanceof ApiError && e.fields.currentPassword
          ? 'رمز عبور درست نیست.'
          : e instanceof ApiError && e.fields.username
            ? e.fields.username
            : faError(e),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField label="نام کاربری فعلی" value={me?.username ?? ''} dir="ltr" readOnly />
      <TextField label="نام کاربری جدید" dir="ltr" onChange={setName} />
      <TextField label="رمز عبور فعلی" type="password" onChange={setPw} error={err ?? undefined} />
      <div>
        <Button variant="secondary" icon="user" loading={busy} disabled={!name.trim() || !pw} onClick={submit}>
          تغییر نام کاربری
        </Button>
      </div>
    </div>
  );
}
