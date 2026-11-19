/**
 * Two-factor login (TOTP) for the signed-in admin/coach: scan a QR code with an authenticator app,
 * confirm with a code, save the one-time recovery codes; later turn it off or renew the codes.
 */
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { faError, remote } from '@/data/api';
import { refreshUser } from '@/data/session';
import { Badge, Button, TextField } from '@/ds';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

type Status = { enabled: boolean; required: boolean; recoveryCodesLeft: number };

export function TwoFactorPanel({ onEnabled }: { onEnabled?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [fieldKey, setFieldKey] = useState(0);

  const load = () => remote.mfaStatus().then(setStatus, () => setStatus({ enabled: false, required: false, recoveryCodesLeft: 0 }));
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(faError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const s = await remote.mfaSetup();
      setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 196 }) });
      setOtp('');
      setFieldKey((k) => k + 1);
    });

  const enable = () =>
    run(async () => {
      const r = await remote.mfaEnable(otp);
      setCodes(r.recoveryCodes);
      setSetup(null);
      await refreshUser();
      await load();
      toast('ورود دومرحله‌ای فعال شد', 'کدهای بازیابی را جای امنی نگه دارید.');
    });

  const disable = () =>
    run(async () => {
      await remote.mfaDisable(password, otp);
      setDisabling(false);
      setPassword('');
      setOtp('');
      await refreshUser();
      await load();
      toast('ورود دومرحله‌ای غیرفعال شد');
    });

  const renew = () =>
    run(async () => {
      const r = await remote.mfaRecoveryCodes(otp);
      setCodes(r.recoveryCodes);
      setOtp('');
      setFieldKey((k) => k + 1);
      await load();
    });

  if (!status) return null;

  if (codes)
    return (
      <div style={box}>
        <strong>کدهای بازیابی</strong>
        <p style={muted}>اگر گوشی‌تان در دسترس نبود، با هر کدام از این کدها یک بار می‌توانید وارد شوید. فقط همین حالا نمایش داده می‌شوند.</p>
        <div dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 14 }}>
          {codes.map((c) => (
            <code key={c} style={{ padding: '6px 10px', background: 'var(--surface-sunken)', borderRadius: 6 }}>
              {c}
            </code>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            icon="copy"
            onClick={() => {
              navigator.clipboard?.writeText(codes.join('\n')).catch(() => {});
              toast('کدها کپی شد');
            }}
          >
            کپی کدها
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setCodes(null);
              onEnabled?.();
            }}
          >
            ذخیره کردم
          </Button>
        </div>
      </div>
    );

  if (status.enabled)
    return (
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>ورود دومرحله‌ای</strong>
          <Badge tone="success" icon="shield">
            فعال
          </Badge>
        </div>
        <p style={muted}>
          هنگام ورود، کد اپ احراز هویت هم خواسته می‌شود. {faDigits(status.recoveryCodesLeft)} کد بازیابی باقی مانده است.
          {status.required ? ' برای مدیران الزامی است و غیرفعال نمی‌شود.' : ''}
        </p>
        <TextField key={'otp' + fieldKey} label="کد فعلی اپ" dir="ltr" inputMode="numeric" placeholder="۱۲۳ ۴۵۶" onChange={setOtp} error={err ?? undefined} />
        {disabling ? <TextField label="رمز عبور" type="password" onChange={setPassword} /> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="refresh" loading={busy && !disabling} disabled={!otp} onClick={renew}>
            کدهای بازیابی جدید
          </Button>
          {status.required ? null : disabling ? (
            <Button variant="destructive" loading={busy} disabled={!otp || !password} onClick={disable}>
              غیرفعال کن
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setDisabling(true)}>
              غیرفعال کردن…
            </Button>
          )}
        </div>
      </div>
    );

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>ورود دومرحله‌ای</strong>
        <Badge tone={status.required ? 'warning' : 'neutral'}>{status.required ? 'الزامی' : 'غیرفعال'}</Badge>
      </div>
      <p style={muted}>با اپ‌هایی مثل Google Authenticator یا Microsoft Authenticator، علاوه بر رمز یک کد ۶ رقمی هم لازم می‌شود.</p>
      {setup ? (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img src={setup.qr} alt="QR code for the authenticator app" width={196} height={196} style={{ borderRadius: 8, background: '#fff', padding: 4 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 180px' }}>
              <span style={muted}>کد QR را با اپ اسکن کنید، یا این کلید را دستی وارد کنید:</span>
              <code dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, wordBreak: 'break-all' }}>
                {setup.secret}
              </code>
            </div>
          </div>
          <TextField key={'setup' + fieldKey} label="کد ۶ رقمی اپ" dir="ltr" inputMode="numeric" placeholder="۱۲۳ ۴۵۶" onChange={setOtp} error={err ?? undefined} />
          <Button variant="primary" icon="shield" loading={busy} disabled={!otp} onClick={enable}>
            تأیید و فعال‌سازی
          </Button>
        </>
      ) : (
        <div>
          <Button variant="primary" icon="shield" loading={busy} onClick={start}>
            فعال‌سازی ورود دومرحله‌ای
          </Button>
          {err ? <p style={{ ...muted, color: 'var(--error)' }}>{err}</p> : null}
        </div>
      )}
    </div>
  );
}

const box = { display: 'flex', flexDirection: 'column', gap: 12 } as const;
const muted = { margin: 0, fontSize: 13, lineHeight: '22px', color: 'var(--text-secondary)' } as const;
