// Coach / head coach: daily attendance. «حاضر» logs the athlete's prescribed session (counts in analytics);
// weights and reps can be corrected per set. «غایب» = missed (nothing counts).
import { useState } from 'react';
import { fromJalali, JALALI_MONTHS, toJalali } from '@baseline/core';
import { Badge, Button, Checkbox, EmptyState, Modal, Sidebar, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import { faDigits, getCalendar } from '@/lib/format';
import { toast } from '@/lib/toast';

interface Session {
  programId: number;
  programName: string;
  part: string;
  partLabel: string;
  focus: string;
  logId: number | null;
  status: string | null;
  present: boolean | null;
}
interface Row {
  athleteId: number;
  name: string;
  sessions: Session[];
}
interface SetRow {
  id: number;
  slot: number;
  index: number;
  exerciseName: string;
  targetReps: string;
  targetValue: number | null;
  actualReps: string;
  actualValue: number | null;
  unit: string;
  done: boolean;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Edit what was actually done: weight, reps, done — per set. */
function EditSets({ logId, title, onClose }: { logId: number; title: string; onClose: () => void }) {
  const q = useQuery<{ sets: SetRow[] }>('workout:' + logId, () => remote.workout(logId) as Promise<{ sets: SetRow[] }>);
  const [edits, setEdits] = useState<Record<number, Partial<{ actualValue: number | null; actualReps: string; done: boolean }>>>({});
  const [busy, setBusy] = useState(false);
  const sets = q.data?.sets ?? [];
  const set = (id: number, patch: object) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  const save = async () => {
    setBusy(true);
    try {
      for (const [id, body] of Object.entries(edits)) await remote.patchSet(id, body);
      toast('تمرین ذخیره شد', title);
      onClose();
    } catch (e) {
      toast('ذخیره نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal title={'ویرایش تمرین · ' + title} description="وزنه و تکرار واقعی را اصلاح کنید؛ همین اعداد در تحلیل‌ها حساب می‌شود." primaryLabel="ذخیره" loading={busy} onPrimary={save} secondaryLabel="بستن" onSecondary={onClose} onClose={onClose}>
      {q.loading ? <span>در حال بارگذاری…</span> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflow: 'auto' }}>
        {sets.map((s, i) => {
          const e = edits[s.id] ?? {};
          const first = i === 0 || sets[i - 1].slot !== s.slot;
          return (
            <div key={s.id}>
              {first ? <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>{s.exerciseName}</div> : null}
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <span style={{ width: 52, fontSize: 13, color: 'var(--text-muted)' }}>ست {faDigits(s.index + 1)}</span>
                <TextField label="تکرار" dir="ltr" value={e.actualReps ?? (s.actualReps || s.targetReps)} onChange={(v) => set(s.id, { actualReps: v })} />
                <TextField
                  label={'وزنه (' + s.unit + ')'}
                  dir="ltr"
                  inputMode="decimal"
                  value={String(e.actualValue ?? s.actualValue ?? s.targetValue ?? '')}
                  onChange={(v) => set(s.id, { actualValue: v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v) })}
                />
                <Checkbox label="انجام شد" checked={e.done ?? s.done} onChange={(on) => set(s.id, { done: on })} />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

const FIELD_STYLE = { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit' } as const;
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Date field following the calendar chosen in settings: Jalali (day / month / year) by default, native picker for Gregorian. Value is always ISO. */
function DateField({ value, max, onChange }: { value: string; max: string; onChange: (iso: string) => void }) {
  if (getCalendar() === 'g') {
    return <input type="date" value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} style={FIELD_STYLE} />;
  }
  const j = toJalali(new Date(value + 'T12:00:00'));
  const top = toJalali(new Date(max + 'T12:00:00'));
  const days = j.jm <= 6 ? 31 : j.jm <= 11 ? 30 : 29;
  const set = (jy: number, jm: number, jd: number) => {
    const len = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
    let iso = isoOf(fromJalali(jy, jm, Math.min(jd, len), 12));
    if (iso > max) iso = max;
    onChange(iso);
  };
  const years = Array.from({ length: 6 }, (_, i) => top.jy - i);
  return (
    <div style={{ display: 'flex', gap: 6 }} dir="rtl" aria-label="تاریخ (شمسی)">
      <select aria-label="روز" value={j.jd} onChange={(e) => set(j.jy, j.jm, +e.target.value)} style={FIELD_STYLE}>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{faDigits(d)}</option>
        ))}
      </select>
      <select aria-label="ماه" value={j.jm} onChange={(e) => set(j.jy, +e.target.value, j.jd)} style={FIELD_STYLE}>
        {JALALI_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select aria-label="سال" value={j.jy} onChange={(e) => set(+e.target.value, j.jm, j.jd)} style={FIELD_STYLE}>
        {years.map((y) => (
          <option key={y} value={y}>{faDigits(y)}</option>
        ))}
      </select>
    </div>
  );
}

export default function CoachAttendance(props: { brand?: string }) {
  const [date, setDate] = useState(today());
  const q = useQuery<{ athletes: Row[] }>('attendance:' + date, () => remote.attendance(date) as Promise<{ athletes: Row[] }>);
  const [edit, setEdit] = useState<{ logId: number; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = (q.data?.athletes ?? []).filter((r) => r.sessions.length);

  const mark = async (r: Row, s: Session, present: boolean | null) => {
    const k = r.athleteId + ':' + s.programId + ':' + s.part;
    setBusy(k);
    try {
      await remote.setAttendance({ athlete: r.athleteId, date, program: s.programId, part: s.part, present });
      q.refetch();
    } catch (e) {
      toast('ثبت نشد', faError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PanelLayout
      theme={props.brand ?? 'brand'}
      sidebar={<Sidebar app="coach" active="attendance" user={panelUser({ name: 'مربی', role: 'مربی' })} />}
      topBar={<TopBar breadcrumbs={['حضور و غیاب']} search />}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, flex: 1 }}>حضور و غیاب</h1>
          <DateField value={date} max={today()} onChange={setDate} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: '22px' }}>
          برای هر ورزشکار که امروز تمرین دارد، «حاضر» یا «غایب» بزنید. با «حاضر»، تمرین طبق برنامه ثبت می‌شود و در تحلیل‌ها می‌آید؛ بعد می‌توانید وزنه‌ها را اصلاح کنید.
        </p>
        {!q.loading && !rows.length ? <EmptyState icon="calendar" title="در این روز تمرینی برنامه‌ریزی نشده" description="ورزشکارانی که برنامه فعال با تمرین در این روز دارند اینجا فهرست می‌شوند." /> : null}
        {rows.map((r) =>
          r.sessions.map((s) => {
            const k = r.athleteId + ':' + s.programId + ':' + s.part;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{[s.programName, s.focus, s.partLabel].filter(Boolean).join(' · ')}</div>
                </div>
                {s.present === true ? <Badge tone="success">حاضر</Badge> : s.present === false ? <Badge tone="danger">غایب</Badge> : <Badge tone="neutral">ثبت نشده</Badge>}
                <Button variant={s.present === true ? 'primary' : 'secondary'} size="sm" loading={busy === k} onClick={() => void mark(r, s, s.present === true ? null : true)}>
                  حاضر
                </Button>
                <Button variant={s.present === false ? 'primary' : 'secondary'} size="sm" loading={busy === k} onClick={() => void mark(r, s, s.present === false ? null : false)}>
                  غایب
                </Button>
                {s.present && s.logId ? (
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => setEdit({ logId: s.logId as number, title: r.name })}>
                    ویرایش تمرین
                  </Button>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
      {edit ? (
        <EditSets
          logId={edit.logId}
          title={edit.title}
          onClose={() => {
            setEdit(null);
            q.refetch();
          }}
        />
      ) : null}
    </PanelLayout>
  );
}
