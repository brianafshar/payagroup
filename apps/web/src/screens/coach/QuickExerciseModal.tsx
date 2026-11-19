/** «+ حرکت جدید» inside the program builder: make an exercise without leaving the program being written.
 * The full form (video, picture, every metric) stays in the library's «حرکت جدید» page. */
import { useState } from 'react';
import { Modal, Select, TextField } from '@/ds';
import { api, faError } from '@/data/api';
import { categoriesFor, EX_CATS, EX_EQUIP, SPORTS } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { toast } from '@/lib/toast';

/** How the athlete logs it: unit and default metrics (the same choices as the library form). */
const MEASURES: Record<string, { label: string; unit: string; metrics: string[] }> = {
  load: { label: 'وزنه و تکرار', unit: 'kg', metrics: ['ست', 'تکرار', 'وزنه', 'استراحت', 'RPE'] },
  reps: { label: 'وزن بدن (فقط تکرار)', unit: 'rep', metrics: ['ست', 'تکرار', 'استراحت'] },
  distance: { label: 'مسافت (کیلومتر)', unit: 'km', metrics: ['مسافت', 'مدت', 'پیس', 'ضربان قلب'] },
  interval: { label: 'اینتروال (تکرار × متر)', unit: 'm', metrics: ['تکرار', 'مسافت', 'پیس', 'استراحت', 'ضربان قلب'] },
  time: { label: 'زمان (ثانیه)', unit: 's', metrics: ['ست', 'مدت', 'استراحت'] },
};
const SPORT_MEASURE: Record<string, string> = {
  martial: 'reps',
  football: 'reps',
  running: 'distance',
  swimming: 'distance',
  cycling: 'distance',
  triathlon: 'distance',
  endurance: 'distance',
};

export function QuickExerciseModal(p: { sport?: string; target: string; onCreated: (ex: Exercise) => void; onClose: () => void }) {
  const [sport, setSport] = useState(p.sport || 'fitness');
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [measure, setMeasure] = useState(SPORT_MEASURE[p.sport || ''] || 'load');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const bad = { name: !name.trim(), cat: !cat, equip: !equip };
  const save = async () => {
    if (bad.name || bad.cat || bad.equip) return setTried(true);
    const m = MEASURES[measure];
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('cat', cat as string);
    fd.append('equip', equip as string);
    fd.append('diff', 'intermediate');
    fd.append('sport', sport);
    fd.append('measure', measure);
    fd.append('unit', m.unit);
    m.metrics.forEach((x) => fd.append('metrics', x));
    setSaving(true);
    try {
      p.onCreated(await api.exercises.create(fd));
    } catch (e) {
      setSaving(false);
      toast('حرکت ساخته نشد', faError(e), 'error');
    }
  };
  return (
    <Modal
      title="حرکت جدید"
      description={'به کتابخانه اضافه می‌شود و همین حالا به ' + p.target + ' می‌رود. ویدیو و عکس را بعداً از کتابخانه اضافه کنید.'}
      primaryLabel="ساخت و افزودن"
      secondaryLabel="انصراف"
      loading={saving}
      onPrimary={save}
      onSecondary={p.onClose}
      onClose={p.onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <TextField label="نام حرکت" placeholder="مثلاً پرس سینه دست جمع" value={name} onChange={setName} error={tried && bad.name ? 'نام حرکت را وارد کنید.' : undefined} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          <Select
            label="رشته"
            value={sport}
            options={SPORTS.map(([value, label]) => ({ value, label }))}
            onChange={(v) => {
              setSport(v);
              setMeasure(SPORT_MEASURE[v] || 'load');
              if (cat && !categoriesFor(v).includes(cat)) setCat(null);
            }}
          />
          <Select
            key={'cat-' + sport}
            label="دسته"
            placeholder="انتخاب کنید"
            value={cat ?? undefined}
            options={categoriesFor(sport).map((k) => ({ value: k, label: EX_CATS[k] }))}
            onChange={setCat}
            error={tried && bad.cat ? 'دسته را انتخاب کنید.' : undefined}
          />
          <Select
            label="تجهیزات"
            placeholder="انتخاب کنید"
            value={equip ?? undefined}
            options={Object.keys(EX_EQUIP).map((k) => ({ value: k, label: EX_EQUIP[k] }))}
            onChange={setEquip}
            error={tried && bad.equip ? 'تجهیزات را انتخاب کنید.' : undefined}
          />
          <Select label="نوع ثبت" value={measure} options={Object.keys(MEASURES).map((k) => ({ value: k, label: MEASURES[k].label }))} onChange={setMeasure} />
        </div>
      </div>
    </Modal>
  );
}
