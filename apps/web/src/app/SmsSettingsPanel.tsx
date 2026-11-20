import { useEffect, useState } from 'react';
import { ApiError, faError, remote } from '@/data/api';
import { Button, TextField } from '@/ds';
import { toast } from '@/lib/toast';

interface Sms {
  keySet: boolean;
  keyHint: string;
  sender: string;
  accountText: string;
  programText: string;
}

const card = {
  maxWidth: '640px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px',
};
const h3 = { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 };
const muted = { margin: 0, fontSize: 13, lineHeight: '22px', color: 'var(--text-muted)' };

/** Head coach: Kavenegar key + sender line, the two message texts, and a test send. */
export function SmsSettingsPanel() {
  const [s, setS] = useState<Sms | null>(null);
  const [key, setKey] = useState('');
  const [sender, setSender] = useState('');
  const [account, setAccount] = useState('');
  const [program, setProgram] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const fill = (r: Sms) => {
    setS(r);
    setSender(r.sender);
    setAccount(r.accountText);
    setProgram(r.programText);
  };
  useEffect(() => {
    remote.smsSettings().then((r) => fill(r as unknown as Sms)).catch((e) => setErr(faError(e)));
  }, []);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await remote.saveSmsSettings({ apiKey: key, sender, accountText: account, programText: program, ...extra });
      fill(r as unknown as Sms);
      setKey('');
      setRound((n) => n + 1);
      toast('تنظیمات پیامک ذخیره شد');
    } catch (e) {
      setErr(e instanceof ApiError && e.fields.programText ? 'متن پیامک برنامه باید شامل {link} باشد.' : faError(e));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = (await remote.smsTest(phone.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s/g, ''))) as { status: string };
      if (r.status === 'sent') toast('پیامک آزمایشی ارسال شد');
      else toast('ارسال نشد', r.status === 'not_configured' ? 'ابتدا کلید API را ذخیره کنید.' : 'کاوه‌نگار پیامک را نپذیرفت؛ کلید، شماره خط و اعتبار حساب را بررسی کنید.', 'error');
    } catch (e) {
      toast('ارسال نشد', faError(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!s) return <div style={card}>{err ?? 'در حال بارگذاری…'}</div>;
  return (
    <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <h3 style={h3}>اتصال به کاوه‌نگار</h3>
        <p style={muted}>
          {s.keySet ? 'کلید API ذخیره شده است (…' + s.keyHint + '). برای تغییر، کلید جدید را وارد کنید.' : 'هنوز کلید API ثبت نشده و پیامکی ارسال نمی‌شود.'}
        </p>
        <TextField label="کلید API" type="password" dir="ltr" placeholder={s.keySet ? '••••••••' : 'کلید را از پنل کاوه‌نگار کپی کنید'} onChange={setKey} />
        <TextField label="شماره خط ارسال‌کننده" optional dir="ltr" value={sender} hint="خالی بگذارید تا از خط پیش‌فرض کاوه‌نگار استفاده شود." onChange={setSender} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" icon="save" loading={busy} onClick={() => void save()}>
            ذخیره
          </Button>
          {s.keySet ? (
            <Button variant="ghost" onClick={() => void save({ apiKey: '', clearKey: true })}>
              حذف کلید
            </Button>
          ) : null}
        </div>
      </div>
      <div style={card}>
        <h3 style={h3}>متن پیامک‌ها</h3>
        <p style={muted}>
          جای‌نگهدارها: <bdi>{'{name}'}</bdi> نام شاگرد · <bdi>{'{brand}'}</bdi> نام برند · <bdi>{'{link}'}</bdi> لینک دانلود برنامه. متن خالی یعنی بازگشت به متن پیش‌فرض.
        </p>
        <TextField label="پیامک ساخته شدن حساب" multiline rows={3} value={account} onChange={setAccount} />
        <TextField label="پیامک اختصاص برنامه (باید شامل {link} باشد)" multiline rows={4} value={program} onChange={setProgram} error={err ?? undefined} />
        <div>
          <Button variant="primary" icon="save" loading={busy} onClick={() => void save()}>
            ذخیره متن‌ها
          </Button>
        </div>
      </div>
      <div style={card}>
        <h3 style={h3}>پیامک آزمایشی</h3>
        <p style={muted}>یک پیامک با متن «ساخته شدن حساب» به شماره‌ی زیر می‌فرستد تا اتصال را بررسی کنید.</p>
        <TextField label="شماره موبایل" dir="ltr" inputMode="tel" placeholder="۰۹۱۲ ..." onChange={setPhone} />
        <div>
          <Button variant="secondary" icon="send" loading={testing} disabled={!phone.trim()} onClick={() => void test()}>
            ارسال پیامک آزمایشی
          </Button>
        </div>
      </div>
    </div>
  );
}
