/**
 * Panel chrome: the signed-in coach's brand for the sidebar/theme and the athlete count badge.
 * The count is fetched once per page load and refreshed after data changes.
 */
import { useEffect, useState } from 'react';
import { http } from './http';
import { getVersion, subscribe } from './store';

let athleteCount: number | null = null;
let loadedAt = -1;
const waiters = new Set<(n: number) => void>();

function load() {
  if (loadedAt === getVersion()) return;
  loadedAt = getVersion();
  http.get<{ count: number }>('/athletes/?page_size=1').then(
    (p) => {
      athleteCount = p.count;
      waiters.forEach((w) => w(p.count));
    },
    () => {},
  );
}
subscribe(() => waiters.size && load());

export function useLiveAthleteCount(enabled: boolean): number | null {
  const [n, setN] = useState(athleteCount);
  useEffect(() => {
    if (!enabled) return;
    waiters.add(setN);
    load();
    return () => {
      waiters.delete(setN);
    };
  }, [enabled]);
  return enabled ? n : null;
}

/** White-label is removed for PAYA Group: always null, so the fixed PAYA brand is used everywhere. */
export function useCoachBrand(): { appName: string; initials: string; theme?: string } | null {
  return null;
}

/* ---------------------------------------------------------------- top bar: search & notifications */

export interface SearchHit {
  kind: 'athlete' | 'program' | 'exercise' | 'coach';
  id: number;
  title: string;
  subtitle?: string;
  status?: string;
  category?: string;
  equipment?: string;
  sessionsPerWeek?: number;
}

/** Server search for the top bar (debounced); pages are matched client-side by the caller. */
export function useSearch(term: string): SearchHit[] {
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => {
    const q = term.trim();
    if (!q) return setHits([]);
    let live = true;
    const t = setTimeout(() => {
      http.get<{ results: SearchHit[] }>('/search/?q=' + encodeURIComponent(q)).then(
        (r) => live && setHits(r.results),
        () => live && setHits([]),
      );
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  return hits;
}

export interface Notification {
  kind: string;
  at: string;
  unread: boolean;
  athleteId?: number;
  athleteName?: string;
  coachId?: number;
  coachName?: string;
  exercise?: string;
  value?: number;
  unit?: string;
  text?: string;
}

/** The signed-in admin's or coach's notifications; refreshed every minute and after data changes. */
export function useNotifications(enabled: boolean): { items: Notification[]; unread: number; markRead: () => void } {
  const [state, setState] = useState<{ items: Notification[]; unread: number }>({ items: [], unread: 0 });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      http.get<{ results: Notification[]; unread: number }>('/notifications/').then(
        (r) => live && setState({ items: r.results, unread: r.unread }),
        () => {},
      );
    void load();
    const timer = setInterval(load, 60_000);
    const unsub = subscribe(() => void load());
    return () => {
      live = false;
      clearInterval(timer);
      unsub();
    };
  }, [enabled]);
  const markRead = () => {
    setState((s) => ({ unread: 0, items: s.items.map((x) => ({ ...x, unread: false })) }));
    void http.post('/notifications/read/').catch(() => {});
  };
  return { ...state, markRead };
}
