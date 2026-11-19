// node tools/e2e/record-fixtures.mjs — visits every admin & coach screen against the running, freshly
// seeded API (`seed_demo --reset`) and saves each GET /api response to apps/web/src/test/fixtures.json.
// The web tests replay them through a fake fetch (src/test/fakeApi.ts), so they run without a server.
import fs from 'node:fs';
import { WEB, open, webLogin } from './common.mjs';

const OUT = new URL('../../apps/web/src/test/fixtures.json', import.meta.url);
const ROUTES = {
  coach: [
    '/coach',
    '/coach/athletes',
    '/coach/athlete?id=1',
    '/coach/athletes/new',
    '/coach/library',
    '/coach/library/new',
    '/coach/exercise?id=1',
    '/coach/programs',
    '/coach/programs/new',
    '/coach/builder?id=2',
    '/coach/program?id=2',
    '/coach/assign?id=2',
    '/coach/customize?id=1',
    '/coach/history?id=1',
    '/coach/nutrition?id=1',
    '/coach/recovery?id=1',
    '/coach/analytics?id=1',
    '/coach/analytics/strength?id=1',
    '/coach/analytics/endurance?id=1',
    '/coach/analytics/body?id=1',
    '/coach/analytics/recovery?id=1',
    '/coach/analytics/records?id=1',
    '/coach/settings',
    '/coach/chat',
  ],
  admin: [
    '/admin',
    '/admin/coaches',
    '/admin/coaches/new',
    '/admin/coach?id=1',
    '/admin/athletes',
    '/admin/branding?id=1',
    '/admin/access',
    '/admin/coaches/activate?id=1',
    '/admin/settings',
  ],
};

const fixtures = { coach: {}, admin: {} };
const { browser, page } = await open();
let role = 'coach';
page.on('response', async (r) => {
  const u = new URL(r.url());
  if (r.request().method() !== 'GET' || !u.pathname.startsWith('/api/') || !r.ok()) return;
  try {
    fixtures[role][u.pathname.slice(4) + u.search] = await r.json();
  } catch {
    /* not JSON */
  }
});
for (role of ['coach', 'admin']) {
  await page.context().clearCookies();
  await page.goto(WEB + '/');
  await page.evaluate(() => (localStorage.clear(), sessionStorage.clear()));
  await webLogin(page, role);
  for (const path of ROUTES[role]) {
    await page.goto(WEB + path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
  }
  // Search + notifications (top bar).
  await page.locator('.bl-topbar-search input').fill(role === 'coach' ? 'علی' : 'Ali');
  await page.waitForTimeout(800);
}
fs.writeFileSync(OUT, JSON.stringify(fixtures));
console.log('coach', Object.keys(fixtures.coach).length, 'admin', Object.keys(fixtures.admin).length, '→', OUT.pathname);
await browser.close();
