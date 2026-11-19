import { ELSEWHERE, pathFor, splitKey } from './routes';
import { toast, type ToastInput } from './toast';

type Navigate = (path: string) => void;

let navigateImpl: Navigate = (path) => {
  window.history.pushState(null, '', path);
};

/** Wired by the router at startup so `go()` performs client-side navigation. */
export function setNavigator(fn: Navigate): void {
  navigateImpl = fn;
}

/** URL for a route key — use in `href`s. Unknown keys resolve to `#`. */
export function href(key: string | null | undefined): string {
  return pathFor(key) ?? '#';
}

/**
 * Navigate to a route key. An optional toast is shown after navigation, which is how the
 * prototype confirmed actions that end on another screen ("athlete saved", …).
 */
export function go(key: string, then?: ToastInput): void {
  const path = pathFor(key);
  if (!path) {
    const name = ELSEWHERE[splitKey(key).base];
    if (name) toast('این صفحه در اپ موبایل ورزشکار است', `«${name}» بخشی از اپ ورزشکار است و در پنل وب باز نمی‌شود.`, 'info');
    return;
  }
  navigateImpl(path);
  if (then) toast(then.title, then.desc, then.tone);
}

/** Reads a query-string parameter of the current URL. */
export function param(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Navigate to a URL path (e.g. a `?next=` target after sign-in). */
export function navigate(path: string): void {
  navigateImpl(path);
}
