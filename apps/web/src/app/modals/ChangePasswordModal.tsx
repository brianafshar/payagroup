import { useState } from 'react';
import { api, faError } from '@/data/api';
import { Button, Checkbox, Modal, TextField } from '@/ds';
import { toast } from '@/lib/toast';

export interface PasswordTarget {
  id: string;
  /** Login account id (defaults to `id`). */
  userId?: string;
  name: string;
  email: string;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

/** 12-character random password (ambiguous characters excluded). */
export function generatePassword(length = 12): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CHARS[n % CHARS.length]).join('');
}

/**
 * Admin sets a coach's/athlete's password manually (A03, A06): new + confirm (≥ 8 chars, must
 * match), auto-generate (copied to clipboard), force change on next login, email the new password.
 * Ends all of the user's sessions and is audit-logged.
 */
export function ChangePasswordModal({ target, roleLabel, onClose }: { target: PasswordTarget; roleLabel: string; onClose: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [force, setForce] = useState(true);
  const [mail, setMail] = useState(true);
  const [fieldKey, setFieldKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const short = p1.length > 0 && p1.length < 8;
  const mismatch = p2.length > 0 && p1 !== p2;
  const bad = p1.length < 8 || p1 !== p2;

  const generate = () => {
    const pw = generatePassword();
    setP1(pw);
    setP2(pw);
    setFieldKey((k) => k + 1);
    navigator.clipboard?.writeText(pw).catch(() => {});
    toast('رمز ساخته شد', pw + ' · در کلیپ‌بورد کپی شد');
  };

  const save = async () => {
    if (bad) return;
    setSaving(true);
    try {
      await api.auth.setPassword(target.userId ?? target.id, p1, { forceChange: force, emailUser: mail });
      toast('رمز تغییر کرد', target.name + (mail ? ' · رمز جدید به ایمیل فرستاده شد' : ''));
      onClose();
    } catch (e) {
      toast('رمز تغییر نکرد', faError(e, 'دوباره تلاش کنید.'), 'error');
      setSaving(false);
    }
  };

  return (
    <Modal
      title={'تغییر رمز · ' + target.name}
      description={roleLabel + ' · ' + target.email}
      primaryLabel="تغییر رمز"
      primaryDisabled={bad}
      loading={saving}
      secondaryLabel="انصراف"
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField
              key={'a' + fieldKey}
              label="رمز جدید"
              type="password"
              dir="ltr"
              value={p1}
              placeholder="حداقل ۸ نویسه"
              error={short ? 'رمز باید حداقل ۸ نویسه باشد.' : undefined}
              onChange={setP1}
            />
          </div>
          <Button variant="secondary" icon="refresh" onClick={generate}>
            ساخت خودکار
          </Button>
        </div>
        <TextField
          key={'b' + fieldKey}
          label="تکرار رمز"
          type="password"
          dir="ltr"
          value={p2}
          placeholder="رمز را دوباره وارد کنید"
          error={mismatch ? 'رمزها یکسان نیستند.' : undefined}
          onChange={setP2}
        />
        <Checkbox label="الزام تغییر رمز در ورود بعدی" description="کاربر بعد از ورود با این رمز باید رمز خودش را بسازد." checked={force} onChange={setForce} />
        <Checkbox label="ارسال رمز جدید به ایمیل کاربر" checked={mail} onChange={setMail} />
        <p style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)' }}>همه نشست‌های فعال کاربر بسته می‌شود و این اقدام در گزارش رویدادها ثبت می‌شود.</p>
      </div>
    </Modal>
  );
}
