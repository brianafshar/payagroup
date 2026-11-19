/**
 * Signed-in user + tokens. «Remember me» keeps them in localStorage; otherwise sessionStorage (cleared
 * when the browser closes).
 */
import { useSyncExternalStore } from 'react';
import { configureHttp, http, type Tokens } from './http';

export type Role = 'admin' | 'coach' | 'athlete';

export interface Branding {
  appName: string;
  initials: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
  theme: string;
}

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  isHeadCoach?: boolean;
  name: string;
  role: Role;
  adminRole: 'super' | 'support' | '';
  phone: string;
  photo: string | null;
  theme: 'light' | 'dark' | 'system';
  twoFactor: boolean;
  mfaSetupRequired: boolean;
  forcePasswordChange: boolean;
  coachId: number | null;
  athleteId: number | null;
  branding: Branding | null;
  lastLogin?: string | null;
}

interface Stored extends Tokens {
  user: SessionUser;
}

const KEY = 'bl:auth';
let current: Stored | null = read();
const listeners = new Set<() => void>();

function read(): Stored | null {
  for (const s of storages()) {
    try {
      const raw = s.getItem(KEY);
      if (raw) return JSON.parse(raw) as Stored;
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

function storages(): Storage[] {
  try {
    return [localStorage, sessionStorage];
  } catch {
    return [];
  }
}

let remember = (() => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
})();

function write(next: Stored | null): void {
  current = next;
  for (const s of storages()) {
    try {
      s.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  if (next) {
    try {
      (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(next));
    } catch {
      /* kept in memory only */
    }
  }
  listeners.forEach((l) => l());
}

configureHttp(
  {
    get: () => current,
    set: (t) => write(t && current ? { ...current, ...t } : null),
  },
  () => {
    const role = lastRole;
    write(null);
    if (typeof window !== 'undefined') window.location.assign(role === 'admin' ? '/admin/login' : '/coach/login');
  },
);

let lastRole: Role | null = current?.user.role ?? null;

export function getSession(): Stored | null {
  return current;
}

export function currentUser(): SessionUser | null {
  return current?.user ?? null;
}

export function subscribeSession(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(subscribeSession, currentUser, currentUser);
}

interface TokenResponse extends Tokens {
  user: SessionUser;
}

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; mfaToken: string };

/** Password step. With two-factor on, returns `mfaToken` for `verifyMfa`. */
export async function login(email: string, password: string, role: Role, keep = true): Promise<LoginResult> {
  const r = await http.post<TokenResponse | { mfaRequired: true; mfaToken: string }>('/auth/login/', { username: email.trim(), password, role }, { anonymous: true });
  if ('mfaRequired' in r) {
    remember = keep;
    return { ok: false, mfaToken: r.mfaToken };
  }
  remember = keep;
  signIn(r);
  return { ok: true, user: r.user };
}

export async function verifyMfa(mfaToken: string, otp: string): Promise<SessionUser> {
  const r = await http.post<TokenResponse>('/auth/2fa/verify/', { mfaToken, otp }, { anonymous: true });
  signIn(r);
  return r.user;
}

export function signIn(r: TokenResponse): void {
  lastRole = r.user.role;
  write({ access: r.access, refresh: r.refresh, user: r.user });
}

/** Replace the cached user (after profile / 2FA changes). */
export function setUser(user: SessionUser): void {
  if (current) write({ ...current, user });
}

export async function refreshUser(): Promise<SessionUser | null> {
  if (!current) return null;
  const user = await http.get<SessionUser>('/auth/me/');
  setUser(user);
  return user;
}

export async function logout(): Promise<void> {
  const s = current;
  write(null);
  // Unsaved program drafts (lib/builderDraft) stay on this device only until sign-out.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('bl-builder-draft:')) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable */
  }
  if (s) await http.post('/auth/logout/', { refresh: s.refresh }, { anonymous: true }).catch(() => {});
}

/** Top-bar identity: the signed-in user (the fallback only shows before sign-in completes). */
export function panelUser<T extends { name: string; role: string }>(fallback: T): T {
  const u = current?.user;
  if (!u) return fallback;
  const role = u.role === 'admin' ? (u.adminRole === 'super' ? 'مدیر ارشد' : 'مدیر پشتیبانی') : u.role === 'coach' ? 'مربی' : 'ورزشکار';
  return { ...fallback, name: u.name, role };
}
