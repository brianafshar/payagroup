import { useState } from 'react';
import { api, faError } from '@/data/api';
import { Button, Modal, TextField } from '@/ds';
import { toast } from '@/lib/toast';

export interface LinkTarget {
  kind: 'invite' | 'reset';
  /** Coach / athlete / admin id. */
  id: string;
  /** Login account id (needed for reset links). */
  userId?: string;
  name: string;
  email: string;
  inviteKind?: 'coach' | 'athlete' | 'admin';
}

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Invite / password-reset link for someone else (A03, A06, A08): send to an email *or* copy the
 * link and send it manually. Reset links: 24h single use; invites: 7 days single use. Copying is
 * audit-logged. (Self-service "forgot password" on login pages only emails — never shows — the link.)
 */
export function ShareLinkModal({ target, onClose }: { target: LinkTarget; onClose: () => void }) {
  const invite = target.kind === 'invite';
  const [email, setEmail] = useState(target.email);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const who = { kind: target.inviteKind || 'coach', id: target.id, userId: target.userId };
  const request = (opts: { send: boolean; email?: string }) => (invite ? api.auth.inviteLink(who, opts) : api.auth.resetLink(who, opts));
  const e = email.trim();
  const ok = EMAIL.test(e);

  /** The link is created only when asked for (creating one revokes older links and is audit-logged). */
  const copy = async () => {
    let link = url;
    if (!link) {
      setBusy(true);
      try {
        link = (await request({ send: false })).url || '';
        setUrl(link);
      } catch (err) {
        toast('لینک ساخته نشد', faError(err), 'error');
        return;
      } finally {
        setBusy(false);
      }
    }
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    toast('لینک کپی شد', 'آن را در پیام‌رسان برای ' + target.name + ' بفرستید.');
  };
  const send = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await request({ send: true, email: e });
      onClose();
      toast(invite ? 'دعوت ارسال شد' : 'لینک بازنشانی ارسال شد', target.name + ' · ' + e);
    } catch (err) {
      toast('ارسال نشد', faError(err), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={(invite ? 'لینک دعوت · ' : 'لینک بازنشانی رمز · ') + target.name}
      description={
        invite ? 'لینک دعوت را به ایمیل بفرستید یا کپی کنید و از پیام‌رسان برای خود کاربر بفرستید.' : 'لینک تغییر رمز را به ایمیل بفرستید یا کپی کنید و مستقیم برای کاربر بفرستید.'
      }
      primaryLabel="ارسال به ایمیل"
      primaryDisabled={!ok || busy}
      secondaryLabel="بستن"
      onPrimary={send}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="ایمیل" dir="ltr" value={email} placeholder="name@example.com" error={e && !ok ? 'این ایمیل معتبر نیست.' : undefined} onChange={setEmail} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 12, lineHeight: '18px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>یا لینک را خودتان بفرستید</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField key={url} label="لینک" dir="ltr" readOnly value={url} placeholder="برای ساخت لینک روی دکمه بزنید" />
          </div>
          <Button variant={copied ? 'secondary' : 'primary'} icon={copied ? 'check' : url ? 'copy' : 'link'} loading={busy && !url} onClick={copy}>
            {copied ? 'کپی شد' : url ? 'کپی لینک' : 'ساخت و کپی لینک'}
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)' }}>
          {invite ? 'لینک دعوت ۷ روز و فقط یک بار معتبر است.' : 'لینک ۲۴ ساعت و فقط یک بار معتبر است. کپی کردن لینک در گزارش رویدادها ثبت می‌شود.'}
        </p>
      </div>
    </Modal>
  );
}
