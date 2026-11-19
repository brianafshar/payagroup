/**
 * Shared setup for the browser walkthroughs. Needs the API (`runserver`, seeded with `seed_demo`) and the
 * app under test running. Env: WEB (default http://localhost:5173), MOBILE (http://localhost:8081),
 * API (http://localhost:8000/api), OUT (screenshot folder, default /tmp/shots), CHROMIUM_PATH.
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

export const WEB = process.env.WEB || 'http://localhost:5173';
export const MOBILE = process.env.MOBILE || 'http://localhost:8081';
export const API = process.env.API || 'http://localhost:8000/api';
export const OUT = process.env.OUT || '/tmp/shots';
export const PASSWORD = 'baseline-demo';
fs.mkdirSync(OUT, { recursive: true });

const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Browser + page that records page errors and console errors in `errors`. */
export async function open(viewport = { width: 1440, height: 900 }) {
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console ' + m.text()));
  return { browser, page, errors };
}

/** Sign in through an API call (for the "other side" of a conversation). */
export async function apiLogin(email) {
  const r = await fetch(API + '/auth/login/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const t = await r.json();
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.access };
}

export async function webLogin(page, role) {
  await page.goto(`${WEB}/${role}/login`);
  await page.fill('input[type=email]', role === 'admin' ? 'sina@baseline.app' : 'ali@alifitness.app');
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(`/${role}$`), { timeout: 10000 });
}
