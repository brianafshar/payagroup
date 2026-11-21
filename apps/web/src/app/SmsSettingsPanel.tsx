import { useEffect, useState } from 'react';
import { ApiError, faError, remote } from '@/data/api';
import { Button, Switch, TextField } from '@/ds';
import { toast } from '@/lib/toast';

interface Sms {
  keySet: boolean;
  keyHint: string;
  sender: string;
  accountText: string;
  programText: string;
  siteConfigured: boolean;
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

interface Bale {
  enabled: boolean;
  tokenSet: boolean;
  tokenHint: string;
  username: string;
  link: string;
  linked: number;
  total: number;
}

/** Bale bot: token, on/off, the link athletes open to start the bot, and how many have linked. */
function BalePanel() {
  const [b, setB] = useState<Bale | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const load = () => remote.baleSettings().then((r) => setB(r as unknown as Bale)).catch((e) => setErr(faError(e)));
  useEffect(() => {
    void load();
  }, []);

  const save = async (data: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setErr(null);
    try {
      setB((await remote.saveBaleSettings(data)) as unknown as Bale);
      setToken('');
      setRound((n) => n + 1);
      toast(ok);
    } catch (e) {
      setErr(e instanceof ApiError && e.fields.token ? 'بله این توکن را نپذیرفت. توکن را دوباره از @botfather کپی کنید.' : faError(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    try {
      await remote.balePoll();
      await load();
      toast('وضعیت به‌روز شد');
    } catch (e) {
      toast('به‌روزرسانی نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!b) return <div style={card}>{err ?? 'در حال بارگذاری…'}</div>;
  return (
    <div key={round} style={card}>
      <h3 style={h3}>پیام در بله (هم‌زمان با پیامک)</h3>
      <p style={muted}>
        با فعال بودن، هر پیامی که پیامک می‌شود (ساخت حساب، اختصاص برنامه، ارسال PDF) هم‌زمان در بله هم برای شاگردی که ربات را استارت کرده می‌رود. متن پیام همان متن‌های پیامک است.
      </p>
      <ol style={{ ...muted, paddingInlineStart: 20 }}>
        <li>در بله به <bdi>@botfather</bdi> پیام بدهید، با <bdi>/newbot</bdi> یک ربات بسازید و توکنش را بگیرید.</li>
        <li>توکن را همین‌جا وارد و ذخیره کنید.</li>
        <li>لینک ربات را به شاگردها بدهید؛ آن‌ها ربات را باز می‌کنند و «اشتراک شماره من» را می‌زنند. شماره باید همان شماره‌ی ثبت‌شده‌ی شاگرد باشد.</li>
      </ol>
      <p style={muted}>{b.tokenSet ? 'توکن ذخیره شده است (…' + b.tokenHint + '). برای تغییر، توکن جدید را وارد کنید.' : 'هنوز توکنی ثبت نشده است.'}</p>
      <TextField label="توکن ربات بله" type="password" dir="ltr" placeholder={b.tokenSet ? '••••••••' : 'توکن را از BotFather کپی کنید'} onChange={setToken} error={err ?? undefined} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" icon="save" loading={busy} disabled={!token.trim()} onClick={() => void save({ token }, 'ربات بله ذخیره و فعال شد')}>
          ذخیره توکن
        </Button>
        {b.tokenSet ? (
          <Button variant="ghost" onClick={() => void save({ clearToken: true }, 'ربات بله حذف شد')}>
            حذف ربات
          </Button>
        ) : null}
      </div>
      {b.tokenSet ? (
        <>
          <Switch label="ارسال هم‌زمان در بله" checked={b.enabled} onChange={(v: boolean) => void save({ enabled: v }, v ? 'ارسال در بله فعال شد' : 'ارسال در بله خاموش شد')} />
          {b.link ? (
            <p style={muted}>
              لینک ربات برای شاگردها: <bdi dir="ltr">{b.link}</bdi>
            </p>
          ) : null}
          <p style={muted}>
            {b.linked} از {b.total} شاگردِ دارای شماره، ربات را فعال کرده‌اند.{' '}
            <Button variant="ghost" size="sm" loading={busy} onClick={() => void refresh()}>
              به‌روزرسانی
            </Button>
          </p>
        </>
      ) : null}
    </div>
  );
}

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
      const r = (await remote.smsTest(phone.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s/g, ''))) as { status: string; detail?: string };
      if (r.status === 'sent') toast('پیامک آزمایشی ارسال شد');
      else toast('ارسال نشد', r.status === 'not_configured' ? 'ابتدا کلید API را ذخیره کنید.' : 'کاوه‌نگار پیامک را نپذیرفت' + (r.detail ? ': ' + r.detail : '') + '. اگر خطا درباره‌ی ارسال‌کننده است، شماره‌ی یکی از خطوط حساب‌تان را در «شماره خط ارسال‌کننده» بنویسید.', 'error');
    } catch (e) {
      toast('ارسال نشد', faError(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!s) return <div style={card}>{err ?? 'در حال بارگذاری…'}</div>;
  return (
    <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BalePanel />
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
        {s.siteConfigured ? null : (
          <p style={{ ...muted, color: 'var(--warning, #b7791f)' }}>
            هشدار: اتصال به سایت payagroup.org هنوز تنظیم نشده است؛ لینک PDF در پیامک فقط روی همین رایانه باز می‌شود و برای شاگرد کار نمی‌کند.
          </p>
        )}
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
