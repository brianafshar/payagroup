// «پیش‌نمایش ورزشکار» in the program builder (#50): the selected day as the athlete app shows it —
// exercise pictures, sets × reps × load and rest — in a phone-sized frame.
import { Modal } from '@/ds';
import type { Exercise } from '@/data/types';
import { faDigits } from '@/lib/format';
import { loadText, type BuilderWeek } from '@/lib/programs';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export function BuilderPreview({
  weeks,
  week,
  day,
  exercises,
  programName,
  onDay,
  onClose,
}: {
  weeks: BuilderWeek[];
  week: number;
  day: number;
  exercises: Exercise[];
  programName: string;
  onDay: (week: number, day: number) => void;
  onClose: () => void;
}) {
  const w = weeks[week] || weeks[0];
  const d = w?.days[day];
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totalSets = (d?.ex || []).reduce((a, e) => a + (+e.sets || 0), 0);
  return (
    <Modal title="پیش‌نمایش در اپ ورزشکار" description="همان چیزی که ورزشکار در روز تمرین می‌بیند." secondaryLabel="بستن" onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {w.days.map((x, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onDay(week, i)}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '4px 10px',
              font: 'inherit',
              fontSize: 12,
              cursor: 'pointer',
              background: i === day ? 'var(--brand-primary)' : 'var(--surface)',
              color: i === day ? 'var(--text-on-brand, #111)' : 'var(--text-secondary)',
            }}
          >
            {DAYS[i]}
          </button>
        ))}
      </div>
      <div
        style={{
          width: 320,
          margin: '0 auto',
          border: '10px solid #1c1f24',
          borderRadius: 36,
          background: 'var(--background)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-2)',
        }}
      >
        <div style={{ padding: '18px 16px 10px', background: 'var(--surface)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {programName} · هفته {faDigits(week + 1)} · {DAYS[day]}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{d?.focus || 'تمرین امروز'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {faDigits(d?.ex.length || 0)} حرکت · {faDigits(totalSets)} ست
          </div>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
          {d?.ex.length ? (
            d.ex.map((e, i) => {
              const ex = byId.get(e.exId);
              return (
                <div
                  key={e.uid}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)', borderRadius: 12, padding: 8, border: '1px solid var(--border-subtle)' }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-sunken)', flex: 'none' }}>
                    {ex?.imageSrc ? <img src={ex.imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {faDigits(i + 1)}. {e.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {faDigits(e.sets)} ست × {e.reps || '—'}
                      {e.load ? ' · ' + loadText(e.unit, e.load) : ''}
                      {e.rest ? ' · استراحت ' + e.rest + ' ث' : ''}
                    </div>
                    {e.note ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.note}</div> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>روز استراحت</div>
          )}
        </div>
        <div style={{ padding: 12 }}>
          <div
            style={{
              background: 'var(--brand-primary)',
              color: 'var(--text-on-brand, #111)',
              borderRadius: 12,
              textAlign: 'center',
              padding: '10px 0',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            شروع تمرین
          </div>
        </div>
      </div>
    </Modal>
  );
}
