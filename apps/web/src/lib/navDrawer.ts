// Phone layout of the admin/coach panels: below NARROW the sidebar is an off-canvas drawer opened from the
// top bar's menu button (PanelLayout renders it, TopBar opens it, Sidebar closes it on navigation).
import { useEffect, useState, useSyncExternalStore } from 'react';

export const NARROW = '(max-width: 900px)';

let open = false;
const subs = new Set<() => void>();
export function setNavOpen(v: boolean): void {
  if (open === v) return;
  open = v;
  subs.forEach((f) => f());
}
export function useNavOpen(): boolean {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => open,
    () => false,
  );
}

/** True while the viewport matches `query` (re-renders when it changes). */
export function useMedia(query: string = NARROW): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  const [v, setV] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(query);
    const on = () => setV(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [query]);
  return v;
}
