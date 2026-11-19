/**
 * HTTP client for the Django API (`backend/`). Adds the bearer token, refreshes it once on 401
 * (single flight), and turns error responses into `ApiError` with the backend's stable `code`.
 * The API speaks camelCase JSON, so responses map straight onto `./types`.
 */
import { ApiError } from './errors';

/** Base URL, e.g. `/api` (dev proxy, the default) or `https://api.example.com/api`. */
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export interface Tokens {
  access: string;
  refresh: string;
}

interface TokenStore {
  get(): Tokens | null;
  set(t: Tokens | null): void;
}

let tokenStore: TokenStore = { get: () => null, set: () => {} };
let onSessionLost: () => void = () => {};

/** Wired by `./session` (keeps this module free of storage and UI concerns). */
export function configureHttp(store: TokenStore, sessionLost: () => void): void {
  tokenStore = store;
  onSessionLost = sessionLost;
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t?.refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(API_URL + '/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'panel' },
        body: JSON.stringify({ refresh: t.refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as Partial<Tokens>;
      tokenStore.set({ access: data.access!, refresh: data.refresh ?? t.refresh });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  /** Send without the bearer token (login, forgot password, invites). */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Return the body as a Blob (file downloads such as the program PDF). */
  blob?: boolean;
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

export async function request<T>(method: string, path: string, body?: Body, opts: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: opts.blob ? '*/*' : 'application/json', 'X-Client': 'panel' };
    const token = opts.anonymous ? null : tokenStore.get()?.access;
    if (token) headers.Authorization = 'Bearer ' + token;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const url = /^https?:\/\//.test(path) ? path : API_URL + path;
    return fetch(url, { method, headers, body: payload, signal: opts.signal });
  };

  let res: Response;
  try {
    res = await send();
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError('Network error', 'network', 0);
  }
  if (res.status === 401 && !opts.anonymous && tokenStore.get()) {
    if (await refreshTokens()) res = await send();
    if (res.status === 401) {
      tokenStore.set(null);
      onSessionLost();
    }
  }
  if (res.status === 204) return undefined as T;
  if (opts.blob && res.ok) return (await res.blob()) as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) throw ApiError.fromResponse(res.status, data);
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: Body, opts?: RequestOptions) => request<T>('POST', path, body ?? {}, opts),
  patch: <T>(path: string, body: Body, opts?: RequestOptions) => request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body: Body, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  del: <T = void>(path: string, body?: Body, opts?: RequestOptions) => request<T>('DELETE', path, body, opts),
};

export interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

/** Every row of a paginated list (follows `next`; lists here are small). */
export async function getAll<T>(path: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  let url: string | null = path + sep + 'page_size=200';
  const out: T[] = [];
  while (url) {
    const page: Page<T> = await http.get<Page<T>>(url);
    out.push(...page.results);
    url = page.next;
  }
  return out;
}

/** Access token for the realtime socket (refreshing it first when needed). */
export async function freshAccessToken(): Promise<string | null> {
  const t = tokenStore.get();
  if (!t) return null;
  const exp = jwtExp(t.access);
  if (exp && exp * 1000 - Date.now() < 30_000) await refreshTokens();
  return tokenStore.get()?.access ?? null;
}

function jwtExp(token: string): number | null {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp ?? null;
  } catch {
    return null;
  }
}
