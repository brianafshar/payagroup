import { useSyncExternalStore } from 'react';
import type { Mode, ModePreference } from '@baseline/tokens';

/**
 * Light / Dark / System mode. `<html data-mode>` is layered on top of the brand/coach
 * `data-theme`; only neutrals & surfaces change. The preference is persisted locally
 * (`localStorage 'theme'`, applied before first paint by the inline script in index.html) and, when
 * signed in to the API, on the user's account so it follows them to other devices.
 */
const KEY = 'theme';
const listeners = new Set<() => void>();

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}

export function getPreference(): ModePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveMode(pref: ModePreference): Mode {
  if (pref !== 'system') return pref;
  return media()?.matches ? 'dark' : 'light';
}

function reducedMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function apply(mode: Mode, animate: boolean): void {
  const root = document.documentElement;
  if (root.getAttribute('data-mode') === mode) return;
  if (animate && !reducedMotion()) {
    // Cross-fade theme colors over 200ms; removed afterwards so normal hovers stay snappy.
    root.classList.add('bl-mode-fade');
    window.setTimeout(() => root.classList.remove('bl-mode-fade'), 260);
  }
  root.setAttribute('data-mode', mode);
}

export function setPreference(pref: ModePreference): void {
  applyUserTheme(pref);
  void import('@/data/session').then(({ currentUser, setUser }) => {
    const u = currentUser();
    if (!u || u.theme === pref) return;
    setUser({ ...u, theme: pref });
    void import('@/data/remote').then(({ remote }) => remote.updateMe({ theme: pref }).catch(() => {}));
  });
}

/** Apply a preference locally (e.g. the one stored on the account at sign-in). */
export function applyUserTheme(pref: ModePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable — still apply for this session */
  }
  apply(resolveMode(pref), true);
  listeners.forEach((l) => l());
}

/** Keeps `data-mode` in sync with the OS while the preference is "system". */
export function initTheme(): () => void {
  apply(resolveMode(getPreference()), false);
  const mq = media();
  const onChange = () => {
    if (getPreference() === 'system') apply(resolveMode('system'), true);
    listeners.forEach((l) => l());
  };
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useThemeMode(): { preference: ModePreference; mode: Mode; setPreference: (p: ModePreference) => void } {
  const preference = useSyncExternalStore(subscribe, getPreference, () => 'system' as ModePreference);
  const mode = useSyncExternalStore(
    subscribe,
    () => resolveMode(getPreference()),
    () => 'light' as Mode,
  );
  return { preference, mode, setPreference };
}
