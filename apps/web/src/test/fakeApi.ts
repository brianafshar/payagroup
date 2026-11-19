/**
 * Fake backend for the web tests: GET requests are answered with real API responses recorded from the
 * seeded Django backend (`node tools/e2e/record-fixtures.mjs` → fixtures.json); writes are recorded in
 * `calls` and answered with the resource they target (merged with the request body).
 */
import { vi } from 'vitest';
import fixtures from './fixtures.json';

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

type Role = 'coach' | 'admin';
/* eslint-disable @typescript-eslint/no-explicit-any */
const norm = (path: string) => path.replace(/\d{4}-\d{2}-\d{2}/g, 'DATE');

/** `/coaches/4/` → the item with id 4 from a recorded `/coaches/?…` list. */
function fromLists(data: Map<string, any>, path: string): any {
  const m = path.match(/^\/([a-z-/]+?)\/(\d+)\/$/);
  if (!m) return undefined;
  for (const [k, v] of data) if (k.startsWith('/' + m[1] + '/?') && Array.isArray(v?.results)) return v.results.find((x: any) => String(x.id) === m[2]);
  return undefined;
}

export function installFakeApi(role: Role = 'coach'): Call[] {
  const data = new Map<string, any>(Object.entries((fixtures as Record<Role, Record<string, any>>)[role]).map(([k, v]) => [norm(k), v]));
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*?\/api/, '');
    const method = init.method || 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ method, path, body });
    if (method === 'GET') return data.has(norm(path)) ? json(structuredClone(data.get(norm(path)))) : json({ detail: 'Not found.' }, 404);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    // The resource a write targets: `/coaches/1/extend/` → `/coaches/1/`.
    const base = path.replace(/[a-z-]+\/$/, '');
    const current = data.get(path) ?? data.get(base) ?? fromLists(data, base);
    const plain = body instanceof FormData ? Object.fromEntries(body.entries()) : (body as object);
    return json({ id: 999, ...(current || {}), ...(plain || {}) }, method === 'POST' ? 201 : 200);
  });
  return calls;
}
