import { lazy, Suspense, useEffect, type JSX } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import { currentUser } from '@/data/session';
import { EmptyState, LoadingState } from '@/ds';
import { startActivityTracking, trackPage } from '@/lib/activity';
import { setNavigator } from '@/lib/nav';
import { isChunkError, reloadForNewBuild } from '@/lib/staleBuild';
import { RequireAuth } from './auth';
import { screenRoutes } from './routes';

const AccountSecurity = lazy(() => import('@/screens/auth/AccountSecurity'));
const AcceptInvite = lazy(() => import('@/screens/auth/AcceptInvite'));
const ResetPassword = lazy(() => import('@/screens/auth/ResetPassword'));
const HelpPage = lazy(() => import('@/app/public/PublicPages').then((m) => ({ default: m.HelpPage })));
const PrivacyPage = lazy(() => import('@/app/public/PublicPages').then((m) => ({ default: m.PrivacyPage })));

/** Panel screens need a session of that panel's role in live mode (login pages don't). */
function guard(path: string, page: JSX.Element): JSX.Element {
  if (path.startsWith('/admin') && path !== '/admin/login') return <RequireAuth role="admin">{page}</RequireAuth>;
  if (path.startsWith('/coach') && path !== '/coach/login') return <RequireAuth role="coach">{page}</RequireAuth>;
  return page;
}

/** `/` goes to the signed-in panel, or the coach login. */
function Home() {
  const u = currentUser();
  return <Navigate to={u?.role === 'admin' ? '/admin' : u?.role === 'coach' ? '/coach' : '/coach/login'} replace />;
}
import { ConfirmHost } from './ConfirmHost';
import { Toaster } from './Toaster';

/** Same-origin `<a href="/…">` clicks become client-side navigations (design-system links are plain anchors). */
function useLinkInterception() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator((path) => navigate(path));
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const raw = a.getAttribute('href') || '';
      if (raw === '#') {
        e.preventDefault();
        return;
      }
      if (!raw.startsWith('/') || raw.startsWith('//')) return;
      e.preventDefault();
      navigate(raw);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);
}

/** Time per section for the admin's activity analytics. */
function useActivityTracking() {
  const { pathname } = useLocation();
  useEffect(startActivityTracking, []);
  useEffect(() => trackPage(pathname), [pathname]);
}

function Root() {
  useLinkInterception();
  useActivityTracking();
  return (
    <>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
      <Toaster />
      <ConfirmHost />
      <ScrollRestoration />
    </>
  );
}

/** A screen that failed to load or crashed: a stale build reloads itself once (#86); otherwise a Persian
 * message with a reload button instead of the router's default error page. */
function RouteError() {
  const err = useRouteError();
  const stale = isChunkError(err);
  useEffect(() => {
    if (stale) reloadForNewBuild();
  }, [stale]);
  if (stale) return <LoadingState />;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--background)' }}>
      <EmptyState
        icon="alert-circle"
        title="این صفحه باز نشد"
        description="صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت به پشتیبانی خبر دهید."
        actionLabel="بارگذاری دوباره"
        actionIcon="refresh"
        onAction={() => window.location.reload()}
      />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      ...screenRoutes().map(({ path, Page }) => ({ path, element: guard(path, <Page />) })),
      { path: '/account', element: <AccountSecurity /> },
      { path: '/invite/:token', element: <AcceptInvite /> },
      { path: '/reset/:token', element: <ResetPassword /> },
      { path: '/help', element: <HelpPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
