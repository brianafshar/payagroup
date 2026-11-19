// Coach edits an athlete's personal info: name, birth date (Persian calendar), gender, goal and phone.
import { useState } from 'react';
import { fromJalali, toEnDigits, toJalali } from '@baseline/core';
import { Modal, Select, TextField } from '@/ds';
import { api, ApiError, faError } from '@/data/api';
import type { Athlete } from '@/data/types';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';
import { GOAL_LABEL } from './CoachAthletes';

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** ISO → «۱۳۷۷/۰۵/۱۲». */
export function faBirth(iso?: string | null): string {
  if (!iso) return '';
  const j = toJalali(new Date(iso + 'T12:00:00'));
  return faDigits(j.jy + '/' + String(j.jm).padStart(2, '0') + '/' + String(j.jd).padStart(2, '0'));
}

/** «۱۳۷۷/۵/۱۲» → ISO, or null when it isn't a plausible birth date. */
function parseBirth(v: string): string | null {
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(toEnDigits(v).trim());
  if (!m) return null;
  const [jy, jm, jd] = [+m[1], +m[2], +m[3]];
  if (jy < 1300 || jy > 1420 || jm < 1 || jm > 12 || jd < 1 || jd > (jm <= 6 ? 31 : 30)) return null;
  const d = fromJalali(jy, jm, jd, 12);
  const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
  return age >= 5 && age <= 100 ? isoOf(d) : null;
}

export function AthletePersonalModal({ athlete: a, onClose }: { athlete: Athlete; onClose: () => void }) {
  const [name, setName] = useState(a.name);
  const [birth, setBirth] = useState(faBirth(a.birthDate));
  const [gender, setGender] = useState<string>(a.gender || '');
  const [goal, setGoal] = useState<string>(a.goal || '');
  const [phone, setPhone] = useState(a.phone ? faDigits(a.phone) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const birthIso = birth.trim() ? parseBirth(birth) : null;
  const badBirth = !!birth.trim() && !birthIso;
  const age = birthIso ? Math.floor((Date.now() - Date.parse(birthIso)) / (365.25 * 86400000)) : null;
  const phoneEn = toEnDigits(phone).replace(/\s/g, '');
  const badPhone = !!phoneEn && !/^09\d{9}$/.test(phoneEn);

  const save = async () => {
    if (!name.trim() || badBirth || badPhone) return;
    setSaving(true);
    try {
      await api.athletes.update(a.id, { name: name.trim(), birthDate: birthIso, gender, goal, phone: phoneEn });
      toast('ذخیره شد', 'اطلاعات شخصی ' + name.trim().split(' ')[0] + ' به‌روز شد.');
      onClose();
    } catch (e) {
      setSaving(false);
      if (e instanceof ApiError && Object.keys(e.fields).length) setErr(e.fields);
      else toast('ذخیره نشد', faError(e), 'error');
    }
  };

  return (
    <Modal
      title="ویرایش اطلاعات شخصی"
      description={'ورزشکار تغییرات را در اپ خود می‌بیند. مربی: ' + (a.coachName || '—')}
      primaryLabel="ذخیره"
      secondaryLabel="انصراف"
      primaryDisabled={saving || !name.trim() || badBirth || badPhone}
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <TextField label="نام و نام خانوادگی" value={name} onChange={setName} error={!name.trim() ? 'نام را وارد کنید.' : err.name} />
        </div>
        <TextField
          label="تاریخ تولد"
          optional
          value={birth}
          placeholder="۱۳۷۷/۰۵/۱۲"
          onChange={setBirth}
          hint={badBirth ? undefined : age != null ? 'سن: ' + faDigits(age) + ' سال' : 'شمسی · سال/ماه/روز'}
          error={badBirth ? 'به شکل ۱۳۷۷/۰۵/۱۲ بنویسید.' : err.birthDate}
        />
        <Select
          label="جنسیت"
          value={gender}
          options={[
            { value: '', label: 'ثبت نشده' },
            { value: 'm', label: 'مرد' },
            { value: 'f', label: 'زن' },
            { value: 'x', label: 'ترجیح می‌دهد نگوید' },
          ]}
          onChange={setGender}
        />
        <Select
          label="هدف"
          value={goal}
          options={[{ value: '', label: 'ثبت نشده' }, ...Object.entries(GOAL_LABEL).map(([value, label]) => ({ value, label }))]}
          onChange={setGoal}
        />
        <TextField label="تلفن" optional value={phone} placeholder="۰۹۱۲۱۲۳۴۵۶۷" onChange={setPhone} error={badPhone ? 'شماره باید ۱۱ رقم و با ۰۹ شروع شود.' : err.phone} />
      </div>
    </Modal>
  );
}
