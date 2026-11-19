// Strength analytics settings for one athlete: which lifts the coach follows (up to 6, in order; none =
// the most-trained lifts) and tested maxes recorded by hand.
import { useState } from 'react';
import { fromJalali, toEnDigits, toJalali } from '@baseline/core';
import { Button, Checkbox, IconButton, Modal, SearchField, Select, Tag, TextField } from '@/ds';
import { api, faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const MAX = 6;
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const faDate = (s: string) => {
  const j = toJalali(new Date(s + 'T12:00:00'));
  return faDigits(j.jy + '/' + String(j.jm).padStart(2, '0') + '/' + String(j.jd).padStart(2, '0'));
};
/** «۱۴۰۵/۷/۱۱» → ISO; null when not a date up to today. */
function parseDate(v: string): string | null {
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(toEnDigits(v).trim());
  if (!m) return null;
  const [jy, jm, jd] = [+m[1], +m[2], +m[3]];
  if (jy < 1390 || jm < 1 || jm > 12 || jd < 1 || jd > (jm <= 6 ? 31 : 30)) return null;
  const d = fromJalali(jy, jm, jd, 12);
  return iso(d) <= iso(new Date()) ? iso(d) : null;
}

export function KeyLiftsModal({
  athleteId,
  athleteName,
  current,
  custom,
  onClose,
}: {
  athleteId: string;
  athleteName: string;
  current: number[];
  custom: boolean;
  onClose: () => void;
}) {
  const lib = useQuery('exercises', () => api.exercises.list());
  const [picked, setPicked] = useState<number[]>(custom ? current : []);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const kg = (lib.data || []).filter((e) => (e.unit || 'kg') === 'kg');
  const byId = new Map(kg.map((e) => [+e.id, e]));
  const shown = kg.filter((e) => !q.trim() || e.name.includes(q.trim())).slice(0, 60);
  const toggle = (id: number, on: boolean) => setPicked((p) => (on ? (p.length < MAX ? [...p, id] : p) : p.filter((x) => x !== id)));

  const save = async () => {
    setSaving(true);
    try {
      await api.athletes.update(athleteId, { keyLifts: picked });
      toast('ذخیره شد', picked.length ? 'تحلیل قدرت ' + athleteName + ' این حرکات را نشان می‌دهد.' : 'حرکات پرتکرار به‌طور خودکار نشان داده می‌شوند.');
      onClose();
    } catch (e) {
      setSaving(false);
      toast('ذخیره نشد', faError(e), 'error');
    }
  };

  return (
    <Modal
      title="حرکات شاخص قدرت"
      description={'حرکاتی که می‌خواهید روند 1RM و رکوردهای ' + athleteName + ' را در آن‌ها ببینید (حداکثر ' + faDigits(MAX) + ' حرکت). ورزشکار هم همین‌ها را در «پیشرفت» می‌بیند.'}
      primaryLabel="ذخیره"
      secondaryLabel="انصراف"
      primaryDisabled={saving}
      onPrimary={save}
      onClose={onClose}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minHeight: 32 }}>
          {picked.length ? (
            picked.map((id, i) => (
              <Tag key={id} removable onRemove={() => toggle(id, false)}>
                {faDigits(i + 1) + '. ' + (byId.get(id)?.name || '…')}
              </Tag>
            ))
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>انتخابی نشده: پرتکرارترین حرکات وزنه‌دار به‌طور خودکار نشان داده می‌شوند.</span>
          )}
          {picked.length ? (
            <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
              برگشت به حالت خودکار
            </Button>
          ) : null}
        </div>
        <SearchField value={q} placeholder="جستجوی حرکت در کتابخانه" onChange={setQ} />
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '6px 16px' }} className="bl-two-up">
          {lib.data ? (
            shown.length ? (
              shown.map((e) => {
                const on = picked.includes(+e.id);
                return <Checkbox key={e.id} label={e.name} checked={on} disabled={!on && picked.length >= MAX} onChange={(v) => toggle(+e.id, v)} />;
              })
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>حرکت وزنه‌داری با این نام نیست.</span>
            )
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>در حال بارگذاری…</span>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function TestedMaxModal({ athleteId, lifts, initial, onClose }: { athleteId: string; lifts: Json[]; initial?: number; onClose: () => void }) {
  const [ex, setEx] = useState(String(initial ?? lifts[0]?.exerciseId ?? ''));
  const [type, setType] = useState('1RM');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(faDate(iso(new Date())));
  const [saving, setSaving] = useState(false);
  const [n, setN] = useState(0); // remounts the weight field to clear it after a save
  const recs = useQuery(`records:${athleteId}`, () => remote.records(athleteId));
  const v = parseFloat(toEnDigits(value).replace('٫', '.'));
  const badValue = !!value.trim() && !(v > 0 && v < 1000);
  const dateIso = parseDate(date);
  const manual = (recs.data || []).filter((r) => !r.auto && ['1RM', '3RM', '5RM'].includes(r.type) && String(r.exerciseId) === ex);

  const save = async () => {
    if (!(v > 0) || !dateIso) return;
    setSaving(true);
    try {
      await remote.addRecord(athleteId, { exerciseId: +ex, type, value: v, date: dateIso });
      toast('ثبت شد', type + ' ' + faDigits(String(v)) + ' kg');
      setValue('');
      setN((x) => x + 1);
    } catch (e) {
      toast('ثبت نشد', faError(e), 'error');
    }
    setSaving(false);
  };
  const remove = async (id: number) => {
    try {
      await remote.deleteRecord(id);
    } catch (e) {
      toast('حذف نشد', faError(e), 'error');
    }
  };

  return (
    <Modal
      title="ثبت رکورد آزمون‌شده"
      description="نتیجه آزمون حداکثر قدرت که با ورزشکار گرفته‌اید؛ روی نمودار و جدول حداکثر تکرارها نشان داده می‌شود."
      primaryLabel="ثبت"
      secondaryLabel="بستن"
      primaryDisabled={saving || !(v > 0) || badValue || !dateIso || !ex}
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Select label="حرکت" value={ex} options={lifts.map((l) => ({ value: String(l.exerciseId), label: l.name }))} onChange={setEx} />
          </div>
          <Select
            label="نوع آزمون"
            value={type}
            options={[
              { value: '1RM', label: '1RM · حداکثر یک تکرار' },
              { value: '3RM', label: '3RM · حداکثر سه تکرار' },
              { value: '5RM', label: '5RM · حداکثر پنج تکرار' },
            ]}
            onChange={setType}
          />
          <TextField
            key={n}
            label="وزنه (kg)"
            value={value}
            inputMode="decimal"
            placeholder="مثلاً ۱۰۰"
            onChange={setValue}
            error={badValue ? 'عدد معتبر وارد کنید.' : undefined}
          />
          <TextField
            label="تاریخ آزمون"
            value={date}
            placeholder="۱۴۰۵/۰۷/۱۱"
            onChange={setDate}
            hint="شمسی · سال/ماه/روز"
            error={date.trim() && !dateIso ? 'تاریخ معتبر تا امروز وارد کنید.' : undefined}
          />
        </div>
        {manual.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>رکوردهای ثبت‌شده برای این حرکت</div>
            {manual.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{r.type + ' · ' + faDigits(String(r.value)) + ' kg · ' + faDate(r.date)}</span>
                <IconButton icon="trash" label="حذف رکورد" size="sm" variant="ghost" onClick={() => remove(r.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
