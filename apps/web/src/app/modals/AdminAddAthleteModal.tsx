import { useState } from 'react';
import { api, faError } from '@/data/api';
import { Modal, Select, TextField } from '@/ds';
import type { Coach, Goal } from '@/data/types';
import { toast } from '@/lib/toast';

const PHONE = /^09\d{9}$/;
const FA = '۰۱۲۳۴۵۶۷۸۹';
const GOALS: Array<[Goal | '', string]> = [
  ['', 'انتخاب نشده'],
  ['loss', 'کاهش وزن'],
  ['gain', 'عضله‌سازی'],
  ['str', 'قدرت'],
  ['gen', 'آمادگی عمومی'],
];

/** Admin adds an athlete for a coach (#96). The account is active at once and the athlete gets an SMS. */
export function AdminAddAthleteModal({ coaches, onClose }: { coaches: Coach[]; onClose: () => void }) {
  const [f, setF] = useState({ coach: '', name: '', phone: '', goal: '' as Goal | '' });
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const phone = f.phone.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/\s/g, '');
  const errs = {
    coach: f.coach ? '' : 'مربی ورزشکار را انتخاب کنید.',
    name: f.name.trim() ? '' : 'نام را وارد کنید.',
    phone: PHONE.test(phone) ? '' : 'شماره موبایل را به‌صورت ۰۹۱۲۱۲۳۴۵۶۷ وارد کنید.',
  };

  const save = async () => {
    setTried(true);
    if (errs.coach || errs.name || errs.phone) return;
    setBusy(true);
    try {
      const a = await api.athletes.create({ coach: f.coach, name: f.name.trim(), phone, goal: f.goal || undefined });
      toast('ورزشکار اضافه شد', a.smsStatus === 'sent' ? 'پیامک حساب برای ' + a.name + ' رفت.' : 'پیامک ارسال نشد.');
      onClose();
    } catch (e) {
      toast('ورزشکار اضافه نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="افزودن ورزشکار"
      description="ورزشکار به شاگردان مربی انتخاب‌شده اضافه و فعال می‌شود و پیامک «حساب شما ساخته شد» برایش می‌رود."
      primaryLabel="افزودن و ارسال پیامک"
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
            ...coaches.filter((c) => c.status !== 'inactive').map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(v) => set('coach')(v === 'none' ? '' : v)}
          error={tried ? errs.coach || undefined : undefined}
        />
        <TextField label="نام و نام خانوادگی" value={f.name} onChange={set('name')} error={tried ? errs.name || undefined : undefined} />
        <TextField label="شماره موبایل" dir="ltr" inputMode="tel" value={f.phone} onChange={set('phone')} error={tried ? errs.phone || undefined : undefined} />
        <Select
          label="هدف"
          value={f.goal || 'none'}
          options={GOALS.map(([value, label]) => ({ value: value || 'none', label }))}
          onChange={(v) => set('goal')(v === 'none' ? '' : v)}
        />
      </div>
    </Modal>
  );
}
