/**
 * Section usage for the admin's activity analytics: seconds per app screen (`app:Workout`, `app:Chat`, …)
 * while the app is in the foreground and was touched in the last 2 minutes, sent every 30 s and when
 * the app goes to the background. Nothing is recorded when signed out.
 */
import { AppState, Platform } from 'react-native';
import { LIVE } from '../api/config';
import { http } from '../api/http';
import { session } from './athlete';

const TICK = 5_000;
const IDLE = 120_000;
const FLUSH = 30_000;

let screen = '';
let lastInput = Date.now();
const pending = new Map<string, { seconds: number; visits: number }>();

function bucket(s: string) {
  let b = pending.get(s);
  if (!b) pending.set(s, (b = { seconds: 0, visits: 0 }));
  return b;
}

/** Call when the focused screen changes (NavigationContainer `onStateChange`). */
export function trackScreen(name: string | undefined): void {
  const next = name && !['Login', 'Invite'].includes(name) ? 'app:' + name : '';
  if (next && next !== screen) bucket(next).visits++;
  screen = next;
}

/** Any touch counts as activity (root view `onTouchStart`). */
export function touched(): void {
  lastInput = Date.now();
}

function flush(): void {
  if (!pending.size || !session.get().signedIn) return;
  const items = [...pending].map(([section, v]) => ({ section, seconds: Math.round(v.seconds), visits: v.visits }));
  pending.clear();
  void http.post('/activity/', { items }).catch(() => {});
}

let started = false;
export function startActivityTracking(): void {
  if (started || !LIVE) return;
  started = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, touched, { passive: true });
  }
  setInterval(() => {
    if (screen && session.get().signedIn && AppState.currentState === 'active' && Date.now() - lastInput < IDLE) bucket(screen).seconds += TICK / 1000;
  }, TICK);
  setInterval(flush, FLUSH);
  AppState.addEventListener?.('change', (s) => s !== 'active' && flush());
}
