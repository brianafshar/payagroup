// Log a field-test result for an athlete (#54). The coach picks any test they designed — or designs a new one
// right here (name, category, unit, which direction is better, protocol) — and sees its protocol before logging.
import { useState } from 'react';
import { Modal, RadioGroup, Select, TextField } from '@/ds';
import { faError, remote } from '@/data/api';
import { toast } from '@/lib/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

export const TEST_CAT: Record<string, string> = { str: 'قدرت', spd: 'سرعت', end: 'استقامت', pow: 'توان', mob: 'تحرک', agi: 'چابکی', other: 'سایر' };
export const TEST_UNIT: Record<string, string> = {
  s: 'ثانیه',
  min: 'دقیقه',
  m: 'متر',
  km: 'کیلومتر',
  cm: 'سانتی‌متر',
  kg: 'کیلوگرم',
  rep: 'تکرار',
  bpm: 'ضربان در دقیقه',
  'km/h': 'کیلومتر بر ساعت',
  W: 'وات',
  'ml/kg/min': 'VO₂ (ml/kg/min)',
  pts: 'امتیاز',
  level: 'سطح',
  '°': 'درجه',
};
export const unitLabel = (u: string) => TEST_UNIT[u] || u;

const en = (s: string) =>
  String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace('٫', '.');
const todayIso = () => {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
};
const NEW = '__new__';

export function TestLogModal({
  athlete,
  tests,
  categories,
  onClose,
}: {
  athlete: { id: string; name: string };
  tests: Json[];
  /** Tests in these categories are listed first (e.g. endurance & speed on that page). */
  categories?: string[];
  onClose: () => void;
}) {
  const order = (t: Json) => (categories && !categories.includes(t.category) ? 1 : 0);
  const defs = [...tests].sort((x, y) => order(x) - order(y));
  const [kind, setKind] = useState<string>(defs[0] ? String(defs[0].id) : NEW);
  const [val, setVal] = useState('');
  const [hr, setHr] = useState('');
  const [rpe, setRpe] = useState('8');
  const [saving, setSaving] = useState(false);
  const [nt, setNt] = useState({ name: '', category: categories?.[0] || 'other', unit: 's', better: 'lower', protocol: '' });
  const creating = kind === NEW;
  const def = defs.find((t) => String(t.id) === kind);
  const unit = creating ? nt.unit : def?.unit || '';
  const ok = +en(val) > 0 && (creating ? nt.name.trim().length > 1 && nt.unit.trim() : !!def) && !saving;

  const save = async () => {
    setSaving(true);
    try {
      let t = def;
      if (creating) {
        t = await remote.addTest({
          name: nt.name.trim(),
          category: nt.category,
          unit: nt.unit.trim(),
          better: nt.better as 'higher' | 'lower',
          protocol: nt.protocol.trim(),
        });
      }
      const note = [hr.trim() ? 'ضربان ' + hr.trim() : '', 'RPE ' + rpe].filter(Boolean).join(' · ');
      await remote.addTestResult(athlete.id, t!.id, +en(val), todayIso(), note);
      toast('آزمون ثبت شد', t!.name + ': ' + val + ' ' + unitLabel(t!.unit) + ' · برای ' + athlete.name.split(' ')[0]);
      onClose();
    } catch (e) {
      setSaving(false);
      toast('ثبت نشد', faError(e), 'error');
    }
  };

  return (
    <Modal
      title="ثبت آزمون"
      description="نتیجه در تحلیل‌ها و روند آزمون‌ها اعمال می‌شود."
      primaryLabel={creating ? 'ساخت آزمون و ثبت' : 'ثبت'}
      primaryDisabled={!ok}
      secondaryLabel="انصراف"
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Select
            label="آزمون"
            value={kind}
            options={[...defs.map((t) => ({ value: String(t.id), label: t.name + ' · ' + (TEST_CAT[t.category] || 'سایر') })), { value: NEW, label: '+ طراحی آزمون جدید' }]}
            onChange={setKind}
          />
        </div>
        {creating ? (
          <>
            <TextField label="نام آزمون" placeholder="مثلاً دوی شاتل ۲۰ متر" value={nt.name} onChange={(v) => setNt({ ...nt, name: v })} />
            <Select
              label="دسته"
              value={nt.category}
              options={Object.keys(TEST_CAT).map((k) => ({ value: k, label: TEST_CAT[k] }))}
              onChange={(v) => setNt({ ...nt, category: v })}
            />
            <Select
              label="واحد"
              value={TEST_UNIT[nt.unit] ? nt.unit : ''}
              options={Object.keys(TEST_UNIT).map((k) => ({ value: k, label: TEST_UNIT[k] }))}
              onChange={(v) => setNt({ ...nt, unit: v, better: ['s', 'min', 'bpm'].includes(v) ? 'lower' : 'higher' })}
            />
            <TextField label="یا واحد دلخواه" optional placeholder="مثلاً سطح بیپ" onChange={(v) => v.trim() && setNt({ ...nt, unit: v.trim().slice(0, 16) })} />
            <div style={{ gridColumn: '1 / -1' }}>
              <RadioGroup
                label="کدام بهتر است؟"
                value={nt.better}
                options={[
                  { value: 'lower', label: 'کمتر بهتر است (مثل زمان)' },
                  { value: 'higher', label: 'بیشتر بهتر است (مثل مسافت، وزنه)' },
                ]}
                onChange={(v) => setNt({ ...nt, better: v })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextField
                label="روش اجرا (پروتکل)"
                optional
                multiline
                value={nt.protocol}
                placeholder="گرم کردن، مسافت یا زمان، تعداد تلاش و استراحت، چه عددی ثبت شود."
                onChange={(v) => setNt({ ...nt, protocol: v })}
              />
            </div>
          </>
        ) : def?.protocol ? (
          <div
            style={{
              gridColumn: '1 / -1',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: 13,
              lineHeight: '22px',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>روش اجرا: </strong>
            {def.protocol}
          </div>
        ) : null}
        <TextField label="نتیجه" value={val} suffix={unitLabel(unit)} onChange={setVal} />
        <TextField label="میانگین ضربان" optional value={hr} suffix="bpm" placeholder="۱۶۰" onChange={setHr} />
        <Select
          label="RPE"
          value={rpe}
          options={[5, 6, 7, 8, 9, 10].map((v) => ({ value: String(v), label: 'RPE ' + String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) }))}
          onChange={setRpe}
        />
      </div>
    </Modal>
  );
}
