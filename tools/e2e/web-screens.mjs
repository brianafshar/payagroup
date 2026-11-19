// node tools/e2e/web-screens.mjs [coach|admin [path …]] — sign-in checks, then a screenshot of each route.
import { OUT, WEB, open, webLogin } from './common.mjs';

const ROUTES = {
  coach: [
    '/coach',
    '/coach/athletes',
    '/coach/athlete?id=1',
    '/coach/library',
    '/coach/exercise?id=1',
    '/coach/programs',
    '/coach/program?id=2',
    '/coach/builder?id=2',
    '/coach/assign?id=2',
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
    '/account',
  ],
  admin: ['/admin', '/admin/coaches', '/admin/coach?id=1', '/admin/athletes', '/admin/branding?id=1', '/admin/access'],
};
const [only, ...paths] = process.argv.slice(2);
const { browser, page, errors } = await open();

await page.goto(WEB + '/coach');
await page.waitForURL(/coach\/login/);
console.log('guard →', page.url());
await page.fill('input[type=email]', 'sina@baseline.app');
await page.goto(WEB + '/admin/login');
await page.fill('input[type=email]', 'sina@baseline.app');
await page.fill('input[type=password]', 'wrong-password');
await page.click('button[type=submit]');
await page.waitForTimeout(1200);
console.log('wrong password error:', await page.locator('.bl-field-error, [role=alert]').allTextContents());

for (const role of only ? [only] : ['coach', 'admin']) {
  await page.context().clearCookies();
  await page.evaluate(() => (localStorage.clear(), sessionStorage.clear()));
  await webLogin(page, role);
  let i = 0;
  for (const p of paths.length ? paths : ROUTES[role]) {
    await page.goto(WEB + p);
    await page.waitForTimeout(2000);
    const broken = await page.locator('.bl-error, .bl-page-state').count();
    if (broken) console.log('  !! error/loading state on', p);
    const file = `${OUT}/${role}-${String(++i).padStart(2, '0')}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, p);
  }
}
console.log(errors.filter((e) => !/401/.test(e)).join('\n') || 'no errors');
await browser.close();
