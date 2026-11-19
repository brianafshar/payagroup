import { afterEach, describe, expect, it, vi } from 'vitest';
import { copySection, type BuilderWeek } from '@/lib/programs';
import { clearDraft, DRAFT_TTL_MS, draftFor, readDraft, writeDraft } from '@/lib/builderDraft';

vi.mock('@/data/session', () => ({ currentUser: () => ({ id: 7 }) }));

const ex = (name: string, time = '') => ({ uid: name, exId: name, name, sets: 3, reps: '۱۰', load: '', rest: '', rpe: '', note: '', unit: 'kg', time }) as never;

describe('copySection (#103)', () => {
  const weeks: BuilderWeek[] = [
    {
      days: [
        { focus: 'A', time: 'morning', ex: [ex('squat'), ex('run', 'night')] },
        { focus: 'B', ex: [] },
        { focus: 'C', time: 'night', ex: [ex('plank')] },
      ],
    },
  ];

  it('copies only that section, into an empty day that takes its time', () => {
    const out = copySection(weeks, { w: 0, d: 0, t: 'night' }, { w: 0, d: 1, t: 'night' }, 'replace');
    expect(out[0].days[1]).toMatchObject({ time: 'night', ex: [{ name: 'run', time: '' }] });
    expect(out[0].days[1].ex[0].uid).not.toBe('run');
    expect(weeks[0].days[1].ex).toHaveLength(0); // the input is untouched
  });

  it('replaces or appends to the target section and keeps other sections', () => {
    const rep = copySection(weeks, { w: 0, d: 0, t: 'night' }, { w: 0, d: 2, t: 'night' }, 'replace');
    expect(rep[0].days[2].ex.map((e) => e.name)).toEqual(['run']);
    const app = copySection(weeks, { w: 0, d: 0, t: 'morning' }, { w: 0, d: 2, t: 'morning' }, 'append');
    expect(app[0].days[2].ex.map((e) => [e.name, e.time])).toEqual([
      ['plank', ''],
      ['squat', 'morning'],
    ]);
  });
});

describe('builder draft', () => {
  afterEach(() => {
    clearDraft();
    vi.useRealTimers();
  });

  it('keeps the draft on this device and drops it after 3 hours', () => {
    writeDraft({ id: null, meta: { name: 'پا' }, weeks: [{ days: [] }] });
    const d = readDraft();
    expect(d?.meta.name).toBe('پا');
    expect(draftFor(d, '')).toBe(true);
    expect(draftFor(d, '12')).toBe(false);
    expect(readDraft(Date.now() + DRAFT_TTL_MS + 1)).toBeNull();
    expect(readDraft()).toBeNull(); // expired drafts are removed
  });
});
