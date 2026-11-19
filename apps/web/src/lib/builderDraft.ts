/**
 * The program the coach is writing, kept only in this browser (localStorage) until they press «ذخیره»:
 * leaving the builder for the library (or any page) and coming back brings it back. Nothing goes to the
 * server. One draft per signed-in coach; it is dropped when saved, discarded, on sign-out, or after
 * 3 hours without an edit.
 */
import { currentUser } from '@/data/session';
import { faDigits } from '@/lib/format';

export const DRAFT_TTL_MS = 3 * 60 * 60 * 1000;
const PREFIX = 'bl-builder-draft:';

export interface BuilderDraft {
  /** The saved program being edited, or null for a new one. */
  id: string | null;
  meta: Record<string, unknown> & { name?: string };
  weeks: unknown[];
  extraSec?: Record<string, string[]>;
  w?: number;
  sel?: number;
  /** Last edit (ms since epoch). */
  at: number;
}

const keyFor = () => {
  const u = currentUser();
  return u ? PREFIX + u.id : null;
};

export function readDraft(now = Date.now()): BuilderDraft | null {
  const k = keyFor();
  if (!k) return null;
  try {
    const d = JSON.parse(localStorage.getItem(k) || 'null') as BuilderDraft | null;
    if (!d || !Array.isArray(d.weeks)) return null;
    if (now - (d.at || 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(k);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function writeDraft(d: Omit<BuilderDraft, 'at'>): void {
  const k = keyFor();
  if (!k) return;
  try {
    localStorage.setItem(k, JSON.stringify({ ...d, at: Date.now() }));
  } catch {
    /* storage full or unavailable: the builder still works, only without the draft */
  }
}

export function clearDraft(): void {
  const k = keyFor();
  if (!k) return;
  try {
    localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

/** «۵ دقیقه پیش» for the draft's last edit. */
export function draftAge(d: BuilderDraft, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - d.at) / 60000));
  if (min < 1) return 'همین الان';
  return min < 60 ? faDigits(min) + ' دقیقه پیش' : faDigits(Math.floor(min / 60)) + ' ساعت پیش';
}

/** Does the draft belong to the program the builder is opening (`id`, or '' for a new one)? */
export const draftFor = (d: BuilderDraft | null, id: string) => !!d && String(d.id || '') === String(id || '');
