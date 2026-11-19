/**
 * HTTP client for the Django API: bearer token, one refresh on 401 (single flight), camelCase JSON,
 * and `ApiError` with the backend's stable `code`.
 */
import { Platform } from 'react-native';
import { API_URL } from './config';
import { getTokens, saveTokens } from './tokens';

/** Names this app in the account's device list (sign-in sessions). */
const CLIENT = Platform.OS === 'web' ? 'app-web' : Platform.OS === 'ios' ? 'app-ios' : 'app-android';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

let onSessionLost: () => void = () => {};
export function setSessionLostHandler(fn: () => void): void {
  onSessionLost = fn;
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = getTokens();
  if (!t) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(API_URL + '/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': CLIENT },
        body: JSON.stringify({ refresh: t.refresh }),
      });
      if (!res.ok) return false;
      const d = (await res.json()) as { access: string; refresh?: string };
      await saveTokens({ access: d.access, refresh: d.refresh ?? t.refresh });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

/** A non-expired access token (refreshed if it expires within a minute), for the WebSocket. */
export async function freshAccessToken(): Promise<string | null> {
  const t = getTokens();
  if (!t) return null;
  try {
    const b64 = t.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(globalThis.atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))) as { exp: number };
    if (exp * 1000 - Date.now() > 60_000) return t.access;
  } catch {
    /* unreadable: try a refresh */
  }
  return (await refresh()) ? (getTokens()?.access ?? null) : null;
}

type Body = Record<string, unknown> | FormData | undefined;
type Res = { status: number; ok: boolean; text: () => Promise<string> };

/**
 * Multipart uploads go through React Native's XMLHttpRequest: Expo replaces the global `fetch` with
 * `expo/fetch`, which can't send React Native file parts (`{ uri, name, type }`) and fails before the
 * request leaves the phone (#57). On the web, files are real Blobs and `fetch` handles them.
 */
function xhrSend(method: string, url: string, headers: Record<string, string>, body: FormData): Promise<Res> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.onload = () => resolve({ status: x.status, ok: x.status >= 200 && x.status < 300, text: async () => x.responseText ?? '' });
    x.onerror = () => reject(new Error('network'));
    x.ontimeout = () => reject(new Error('timeout'));
    x.timeout = 120_000;
    x.send(body);
  });
}

export async function request<T>(method: string, path: string, body?: Body, anonymous = false): Promise<T> {
  const send = (): Promise<Res> => {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Client': CLIENT };
    const token = anonymous ? null : getTokens()?.access;
    if (token) headers.Authorization = 'Bearer ' + token;
    const url = /^https?:/.test(path) ? path : API_URL + path;
    if (body instanceof FormData) {
      if (Platform.OS !== 'web') return xhrSend(method, url, headers, body);
      return fetch(url, { method, headers, body: body as unknown as BodyInit });
    }
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    return fetch(url, { method, headers, body: payload });
  };
  let res: Res;
  try {
    res = await send();
  } catch {
    throw new ApiError('Network error', 'network', 0);
  }
  if (res.status === 401 && !anonymous && getTokens()) {
    if (await refresh()) res = await send();
    if (res.status === 401) {
      await saveTokens(null);
      onSessionLost();
    }
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const b = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(b)) if (k !== 'code' && k !== 'detail') fields[k] = String(Array.isArray(v) ? v[0] : v);
    throw new ApiError(typeof b.detail === 'string' ? b.detail : Object.values(fields)[0] || 'Request failed', typeof b.code === 'string' ? b.code : 'invalid', res.status, fields);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body, anonymous = false) => request<T>('POST', path, body ?? {}, anonymous),
  patch: <T>(path: string, body: Body) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: Body) => request<T>('PUT', path, body),
  del: <T = void>(path: string, body?: Body) => request<T>('DELETE', path, body),
};

/** All rows of a paginated list. */
export async function getAll<T>(path: string): Promise<T[]> {
  let url: string | null = path + (path.includes('?') ? '&' : '?') + 'page_size=200';
  const out: T[] = [];
  while (url) {
    const page: { results: T[]; next: string | null } = await http.get(url);
    out.push(...page.results);
    url = page.next;
  }
  return out;
}

const FA: Record<string, string> = {
  network: 'اتصال به سرور برقرار نشد. اینترنت را بررسی کن.',
  invalid_credentials: 'ایمیل یا رمز عبور درست نیست.',
  wrong_role: 'این حساب ورزشکار نیست. مربیان از پنل وب وارد می‌شوند.',
  athlete_inactive: 'حسابت فعال نیست. با مربی‌ات تماس بگیر.',
  coach_inactive: 'حساب مربی‌ات غیرفعال است.',
  session_ended: 'نشست پایان یافت. دوباره وارد شو.',
  invite_expired: 'این لینک دعوت منقضی شده یا قبلاً استفاده شده است.',
  invite_unknown: 'این لینک دعوت معتبر نیست.',
  conflict: 'با این ایمیل قبلاً حساب ساخته شده است.',
  throttled: 'تلاش‌ها زیاد بود. کمی بعد دوباره امتحان کن.',
  email_failed: 'ایمیل ارسال نشد. کمی بعد دوباره امتحان کن یا به مربی‌ات خبر بده.',
};

export function faError(e: unknown, fallback = 'مشکلی پیش آمد. دوباره تلاش کن.'): string {
  return e instanceof ApiError ? (FA[e.code] ?? fallback) : fallback;
}
