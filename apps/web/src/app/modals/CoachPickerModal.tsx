import { useState } from 'react';
import { faError } from '@/data/api';
import type { Coach } from '@/data/types';
import { Avatar, Modal, SearchField } from '@/ds';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

/**
 * Move athletes to another coach (#83): the active coaches are listed right in the popup — search,
 * tap one, confirm. The athletes' current coach is left out.
 */
export function CoachPickerModal({
  coaches,
  count,
  exclude = [],
  onPick,
  onClose,
}: {
  coaches: Coach[];
  count: number;
  exclude?: string[];
  onPick: (coachId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = coaches.filter(
    (c) => c.status === 'active' && !exclude.includes(c.id) && (!q.trim() || (c.name + ' ' + (c.branding?.appName || '') + ' ' + (c.email || '')).includes(q.trim())),
  );
  const go = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await onPick(sel);
    } catch (e) {
      toast('انتقال انجام نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title="انتقال به مربی دیگر"
      description={faDigits(count) + ' ورزشکار با سابقه، اندازه‌گیری‌ها و گفتگو به مربی انتخاب‌شده منتقل می‌شوند. برنامه تمرینی را مربی جدید می‌دهد.'}
      primaryLabel="انتقال"
      primaryDisabled={!sel}
      loading={busy}
      secondaryLabel="انصراف"
      onPrimary={go}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SearchField placeholder="جستجوی مربی" size="sm" onChange={setQ} />
        <div role="radiogroup" aria-label="مربی مقصد" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {list.map((c) => {
            const on = sel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSel(c.id)}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'start',
                  font: 'inherit',
                  color: 'inherit',
                  background: on ? 'var(--brand-primary-subtle)' : 'var(--surface)',
                  border: '1px solid ' + (on ? 'var(--brand-primary)' : 'var(--border)'),
                }}
              >
                <Avatar name={c.name} size="sm" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                    {[c.branding?.appName, c.athleteCount != null ? faDigits(c.athleteCount) + ' ورزشکار' : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    border: '2px solid ' + (on ? 'var(--brand-primary)' : 'var(--border-strong, var(--border))'),
                    boxShadow: on ? 'inset 0 0 0 4px var(--surface)' : 'none',
                    background: on ? 'var(--brand-primary)' : 'transparent',
                  }}
                />
              </button>
            );
          })}
          {list.length ? null : <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>مربی فعال دیگری پیدا نشد.</p>}
        </div>
      </div>
    </Modal>
  );
}
