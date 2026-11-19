/**
 * Athlete sign-in for live mode: login, invite acceptance, forgot password, password change, restoring the session from
 * secure storage on launch, and sign-out. After sign-in the app loads its data (`loadAll`), opens the
 * realtime socket and registers for push notifications.
 */
import type { ThemeName } from '@baseline/tokens';
import { session } from '../data/athlete';
import { loadAll } from '../data/live';
import { BRAND } from '../ui/layout';
import { createStore } from '../data/store';
import { LIVE } from './config';
import { http, request, setSessionLostHandler } from './http';
import { unregisterPush, registerPush } from './push';
import { connectRealtime, disconnectRealtime } from './realtime';
import { loadTokens, saveTokens, getTokens, type Tokens } from './tokens';

export interface Branding {
  appName: string;
  initials: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
  theme: string;
}

export interface InviteInfo {
  kind: 'admin' | 'coach' | 'athlete';
  email: string;
  name: string;
  expired: boolean;
  used: boolean;
  coachName: string | null;
  branding: Branding | null;
}

/** Cached branding from the last session, so the app opens in the coach's colours. */
export function restoreBranding(): void {
  void branding.ready.then(() => {
    const b = branding.get();
    Object.assign(BRAND, { name: b.appName, initials: b.initials });
  });
}

const THEMES: ThemeName[] = ['brand', 'base', 'ali-fitness', 'northline', 'kova'];

/** The coach's white-label branding (name, initials, theme); the design's sample brand until known. */
export const branding = createStore<{ appName: string; initials: string; logoUrl: string | null; theme: ThemeName }>(
  'branding',
  { appName: 'Ali Fitness', initials: 'AF', logoUrl: null, theme: 'brand' },
  { persist: LIVE },
);

export function applyBranding(b: Branding | null | undefined): void {
  if (!b) return;
  Object.assign(BRAND, { name: b.appName, initials: b.initials });
  branding.set({ appName: b.appName, initials: b.initials, logoUrl: b.logoUrl, theme: THEMES.includes(b.theme as ThemeName) ? (b.theme as ThemeName) : 'brand' });
}

interface TokenResponse extends Tokens {
  user: { role: string; branding: Branding | null; forcePasswordChange?: boolean };
}

async function start(r: TokenResponse, enter = true): Promise<void> {
  await saveTokens({ access: r.access, refresh: r.refresh });
  applyBranding(r.user.branding);
  session.set({ mustChangePassword: !!r.user.forcePasswordChange });
  if (enter) enterApp();
}

/** Show the signed-in app (tokens are already saved). */
export function enterApp(onboarded = false): void {
  session.set({ signedIn: true, restoring: false, ...(onboarded ? { onboarded } : {}) });
  afterSignIn();
}

function afterSignIn() {
  void loadAll();
  connectRealtime();
  void registerPush();
}

export async function signIn(email: string, password: string): Promise<void> {
  await start(await http.post<TokenResponse>('/auth/login/', { email: email.trim(), password, role: 'athlete' }, true));
}

export function inviteInfo(token: string): Promise<InviteInfo> {
  return request<InviteInfo>('GET', `/auth/invites/${encodeURIComponent(token)}/`, undefined, true);
}

/** Set the password from the invite email. Signed in, but the app opens after onboarding (`enterApp`). */
export async function acceptInvite(token: string, password: string): Promise<void> {
  await start(await http.post<TokenResponse>(`/auth/invites/${encodeURIComponent(token)}/`, { password }, true), false);
}

/** Emails a new temporary password (the API never says whether the email exists). */
export async function forgotPassword(email: string): Promise<void> {
  await http.post('/auth/forgot-password/', { email: email.trim() }, true);
}

/** Own password change. Other devices are signed out; this one gets fresh tokens and stays signed in. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const r = await http.post<TokenResponse>('/auth/password/', { currentPassword, newPassword });
  await saveTokens({ access: r.access, refresh: r.refresh });
  session.set({ mustChangePassword: false });
  disconnectRealtime();
  connectRealtime();
}

/** On launch: signed in again if secure storage still has a valid session. */
export async function restoreSession(): Promise<void> {
  if (!LIVE) return;
  setSessionLostHandler(() => {
    disconnectRealtime();
    session.set({ signedIn: false, restoring: false });
  });
  const t = await loadTokens();
  if (!t) return session.set({ signedIn: false, restoring: false });
  try {
    const me = await http.get<TokenResponse['user']>('/auth/me/');
    if (me.role !== 'athlete') throw new Error('not an athlete');
    applyBranding(me.branding);
    session.set({ signedIn: true, restoring: false, mustChangePassword: !!me.forcePasswordChange });
    afterSignIn();
  } catch {
    if (getTokens()) await saveTokens(null);
    session.set({ signedIn: false, restoring: false });
  }
}

export async function signOut(): Promise<void> {
  if (!LIVE) return session.set({ signedIn: false });
  const t = getTokens();
  await unregisterPush();
  disconnectRealtime();
  if (t) await http.post('/auth/logout/', { refresh: t.refresh }, true).catch(() => {});
  await saveTokens(null);
  session.set({ signedIn: false, mustChangePassword: false });
}
