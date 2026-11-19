import { useState } from 'react';
import { api, faError } from '@/data/api';
import { Button, Modal, RadioGroup, Select, TextField } from '@/ds';
import type { Coach, Goal } from '@/data/types';
import { toast } from '@/lib/toast';

const EMAIL = /^\S+@\S+\.\S+$/;
const GOALS: Array<[Goal | '', string]> = [
  ['', 'انتخاب نشده'],
  ['loss', 'کاهش وزن'],
  ['gain', 'عضله‌سازی'],
  ['str', 'قدرت'],
  ['gen', 'آمادگی عمومی'],
];

/**
 * Admin adds an athlete for a coach (#96). The athlete joins that coach; the invite is in the coach's
 * name and app. «لینک» returns the link to copy and send by hand; «ایمیل» emails it.
 */
export function AdminAddAthleteModal({ coaches, onClose }: { coaches: Coach[]; onClose: () => void }) {
  const [f, setF] = useState({ coach: '', name: '', email: '', phone: '', goal: '' as Goal | '', invite: 'link' as 'link' | 'email' });
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<{ name: string; coach: string; url: string | null; sent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const errs = {
    coach: f.coach ? '' : 'مربی ورزشکار را انتخاب کنید.',
    name: f.name.trim() ? '' : 'نام را وارد کنید.',
    email: EMAIL.test(f.email.trim()) ? '' : 'برای دعوت، ایمیل معتبر لازم است.',
  };
  const coachName = coaches.find((c) => c.id === f.coach)?.name || '';

  const save = async () => {
    setTried(true);
    if (errs.coach || errs.name || errs.email) return;
    setBusy(true);
    try {
      const a = await api.athletes.create({
        coach: f.coach,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim() || undefined,
        goal: f.goal || undefined,
        invite: f.invite,
      });
      setDone({ name: a.name, coach: coachName, url: a.inviteLink?.url ?? null, sent: f.invite === 'email' });
    } catch (e) {
      toast('ورزشکار اضافه نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!done?.url) return;
    try {
      await navigator.clipboard.writeText(done.url);
      setCopied(true);
      toast('لینک کپی شد', 'آن را برای ' + done.name + ' بفرستید.');
    } catch {
      toast('کپی نشد', 'لینک را انتخاب و دستی کپی کنید.', 'error');
    }
  };

  if (done)
    return (
      <Modal
        title={'«' + done.name + '» به شاگردان ' + done.coach + ' اضافه شد'}
        description={
          done.sent ? 'دعوت‌نامه به نام مربی ایمیل شد. لینک ۷ روز اعتبار دارد.' : 'این لینک دعوت به نام مربی است و ۷ روز اعتبار دارد. آن را کپی کنید و برای ورزشکار بفرستید.'
        }
        primaryLabel="بستن"
        onPrimary={onClose}
        onClose={onClose}
      >
        {done.url ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextField label="لینک دعوت" value={done.url} dir="ltr" readOnly onChange={() => {}} />
            </div>
            <Button variant={copied ? 'secondary' : 'primary'} icon={copied ? 'check' : 'copy'} onClick={() => void copy()}>
              {copied ? 'کپی شد' : 'کپی لینک'}
            </Button>
          </div>
        ) : null}
      </Modal>
    );

  return (
    <Modal
      title="افزودن ورزشکار"
      description="ورزشکار به شاگردان مربی انتخاب‌شده اضافه می‌شود و دعوت‌نامه به نام همان مربی است."
      primaryLabel="افزودن و ساخت دعوت"
      secondaryLabel="انصراف"
      loading={busy}
      onPrimary={() => void save()}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Select
          label="مربی"
          value={f.coach || 'none'}
          options={[
            { value: 'none', label: 'انتخاب مربی…' },
            ...coaches.filter((c) => c.status !== 'inactive').map((c) => ({ value: c.id, label: c.name + (c.branding?.appName ? ' · ' + c.branding.appName : '') })),
          ]}
          onChange={(v) => set('coach')(v === 'none' ? '' : v)}
          error={tried ? errs.coach || undefined : undefined}
        />
        <TextField label="نام و نام خانوادگی" value={f.name} onChange={set('name')} error={tried ? errs.name || undefined : undefined} />
        <TextField label="ایمیل" type="email" dir="ltr" value={f.email} onChange={set('email')} error={tried ? errs.email || undefined : undefined} />
        <TextField label="موبایل" optional dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} />
        <Select
          label="هدف"
          value={f.goal || 'none'}
          options={GOALS.map(([value, label]) => ({ value: value || 'none', label }))}
          onChange={(v) => set('goal')(v === 'none' ? '' : v)}
        />
        <RadioGroup
          label="دعوت‌نامه"
          direction="row"
          value={f.invite}
          options={[
            { value: 'link', label: 'لینک برای کپی' },
            { value: 'email', label: 'ارسال با ایمیل' },
          ]}
          onChange={(v) => set('invite')(v)}
        />
      </div>
    </Modal>
  );
}
