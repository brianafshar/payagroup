/**
 * Section usage for the admin's activity analytics: seconds per panel section (route key, e.g.
 * `coach:chat`) while the tab is visible and the user was active in the last 2 minutes, sent every 30 s
 * (and when the tab is hidden). Nothing is recorded for signed-out pages.
 */
import { http } from '@/data/http';
import { currentUser } from '@/data/session';
import { ROUTES } from './routes';

const TICK = 5_000;
const IDLE = 120_000;
const FLUSH = 30_000;

const byPath = Object.entries(ROUTES)
  .map(([k, p]) => [p, k] as const)
  .sort((a, b) => b[0].length - a[0].length);
let section = '';
let lastInput = Date.now();
const pending = new Map<string, { seconds: number; visits: number }>();

function sectionOf(path: string): string {
  if (path === '/account') return 'account';
  const hit = byPath.find(([p]) => p === path);
  return hit ? hit[1] : '';
}

function bucket(s: string) {
  let b = pending.get(s);
  if (!b) pending.set(s, (b = { seconds: 0, visits: 0 }));
  return b;
}

/** Call on every route change. */
export function trackPage(path: string): void {
  const next = sectionOf(path);
  if (next && next !== section && !next.endsWith('login')) bucket(next).visits++;
  section = next.endsWith('login') ? '' : next;
}

function flush(): void {
  if (!pending.size || !currentUser()) return;
  const items = [...pending].map(([s, v]) => ({ section: s, seconds: Math.round(v.seconds), visits: v.visits }));
  pending.clear();
  void http.post('/activity/', { items }).catch(() => {});
}

let started = false;
export function startActivityTracking(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true });
  setInterval(() => {
    if (section && currentUser() && document.visibilityState === 'visible' && Date.now() - lastInput < IDLE) bucket(section).seconds += TICK / 1000;
  }, TICK);
  setInterval(flush, FLUSH);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}
