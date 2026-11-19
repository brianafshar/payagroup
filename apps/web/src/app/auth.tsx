/**
 * Authentication glue for live mode: route guards, the login flow shared by A01/C09 (password →
 * optional two-factor code), and the dark login-style shell used by the invite / reset / account pages.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { faError } from '@/data/api';
import { IndowLogo } from '@/ds';
import { login, useSessionUser, verifyMfa, type Role, type SessionUser } from '@/data/session';
import { applyUserTheme } from '@/lib/theme';

const LOGIN: Record<Role, string> = { admin: '/admin/login', coach: '/coach/login', athlete: '/coach/login' };
const HOME: Record<Role, string> = { admin: '/admin', coach: '/coach', athlete: '/account/athlete' };

/** Signed in with the panel's role, 2FA set up when required, password not expired. */
export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const user = useSessionUser();
  const loc = useLocation();
  if (!user || user.role !== role) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`${LOGIN[role]}?next=${next}`} replace />;
  }
  if (user.mfaSetupRequired || user.forcePasswordChange) return <Navigate to="/account" replace />;
  return <>{children}</>;
}

/** Where to go after signing in: the `next` param when it belongs to the same panel, else the panel home. */
export function landingPath(user: SessionUser): string {
  if (user.mfaSetupRequired || user.forcePasswordChange) return '/account';
  const next = new URLSearchParams(window.location.search).get('next');
  const prefix = user.role === 'admin' ? '/admin' : '/coach';
  return next && next.startsWith(prefix) && !next.includes('/login') ? next : HOME[user.role];
}

export type LoginStep = { done: SessionUser } | { mfaToken: string } | { error: string };

/** The error message of a failed step ('' otherwise). */
export function stepError(r: LoginStep): string {
  return 'error' in r ? r.error : '';
}

export async function submitPassword(email: string, password: string, role: 'admin' | 'coach', remember: boolean): Promise<LoginStep> {
  try {
    const r = await login(email, password, role, remember);
    if ('mfaToken' in r) return { mfaToken: r.mfaToken };
    applyUserTheme(r.user.theme);
    return { done: r.user };
  } catch (e) {
    return { error: faError(e) };
  }
}

export async function submitOtp(mfaToken: string, otp: string): Promise<LoginStep> {
  try {
    const user = await verifyMfa(mfaToken, otp);
    applyUserTheme(user.theme);
    return { done: user };
  } catch (e) {
    return { error: faError(e) };
  }
}

const shellStyle = {
  width: '100%',
  minHeight: '100vh',
  backgroundColor: '#0a0a0a',
  backgroundImage:
    'linear-gradient(135deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 55%, #0a0a0a 90%), repeating-linear-gradient(45deg, transparent 0 38px, rgba(255,154,31,0.45) 38px 40px)',
  color: 'var(--text-primary)',
  fontFamily: "'Vazirmatn',var(--font-sans)",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
  boxSizing: 'border-box',
} as CSSProperties;

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  boxSizing: 'border-box',
};

/** Centered card on the black + orange-lines background (same frame as the login screens). */
export function AuthShell({
  title,
  description,
  children,
  brand = 'brand',
  width,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  brand?: string;
  /** Wider card for reading pages (help, privacy). */
  width?: number;
}) {
  return (
    <div data-theme={brand} dir="rtl" style={shellStyle}>
      <div style={width ? { ...cardStyle, maxWidth: width } : cardStyle}>
        <IndowLogo height={28} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: '32px', fontWeight: 600 }}>{title}</h2>
          {description ? <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--text-secondary)' }}>{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
