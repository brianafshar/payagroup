// Athlete app (web export on MOBILE, built with EXPO_PUBLIC_API_URL) against the API.
import { API, MOBILE, OUT, apiLogin, open } from './common.mjs';
const { browser, page, errors } = await open({ width: 390, height: 844 });
const shot = (n) => page.screenshot({ path: `${OUT}/m-${n}.png` });
const step = (s) => console.log('—', s);

await page.goto(MOBILE + '/');
await page.getByPlaceholder('name@example.com').first().waitFor();
step('wrong password');
await page.getByPlaceholder('name@example.com').first().fill('ali.rostami@gmail.com');
await page.getByPlaceholder('رمز عبور خود را وارد کنید').fill('nope-nope');
await page.getByRole('button', { name: 'ورود' }).click();
await page.getByText('ایمیل یا رمز عبور درست نیست.').waitFor({ timeout: 5000 });
console.log('  error shown');
step('sign in');
await page.getByPlaceholder('رمز عبور خود را وارد کنید').fill('baseline-demo');
await page.getByRole('button', { name: 'ورود' }).click();
await page.getByText('تمرین امروز').first().waitFor({ timeout: 8000 });
await page.waitForTimeout(1500);
console.log('  header:', (await page.locator('[role=heading]').first().textContent()) || '');
await shot('home');

step('workout tab');
await page.goto(MOBILE + '/workout');
await page.waitForTimeout(1500);
console.log('  body:', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
await shot('workout');

step('nutrition');
await page.goto(MOBILE + '/nutrition');
await page.waitForTimeout(1500);
await shot('nutrition');

step('recovery check-in');
await page.goto(MOBILE + '/recovery');
await page.waitForTimeout(1200);
await shot('recovery');

step('progress + records');
await page.goto(MOBILE + '/progress');
await page.waitForTimeout(1500);
await shot('progress');
await page.goto(MOBILE + '/records');
await page.waitForTimeout(1200);
await shot('records');

step('measure');
await page.goto(MOBILE + '/measure/hist');
await page.waitForTimeout(1200);
await shot('measure');

step('chat: send, coach replies live');
const CH = await apiLogin('ali@alifitness.app');
await page.goto(MOBILE + '/chat');
await page.waitForTimeout(2000);
const mine = 'سلام از اپ ' + Date.now();
await page.getByLabel('پیام به مربی').fill(mine);
await page.getByRole('button', { name: 'ارسال' }).click();
await page.waitForTimeout(1200);
const thread = (await fetch(API + '/coach/threads/', { headers: CH }).then((r) => r.json())).find((t) => t.lastText === mine);
console.log('  coach sees it:', !!thread);
const reply = 'پاسخ زنده مربی ' + Date.now();
await fetch(API + '/messages/', { method: 'POST', headers: CH, body: JSON.stringify({ athlete: thread?.athleteId ?? 1, text: reply }) }).then(async (r) =>
  console.log('  coach send', r.status, (await r.text()).slice(0, 120)),
);
await page
  .getByText(reply)
  .waitFor({ timeout: 5000 })
  .then(
    () => console.log('  live reply shown'),
    () => console.log('  !! live reply NOT shown'),
  );
await shot('chat');

step('in-app notifications (no push needed)');
await page.goto(MOBILE + '/home');
await page.getByRole('button', { name: 'اعلان‌ها' }).click();
await page.getByText('اعلان‌ها').first().waitFor();
await page.waitForTimeout(1200);
console.log('  items:', (await page.locator('body').innerText()).split('\n').filter((l) => /پیام|برنامه|چک‌این/.test(l)).slice(0, 5).join(' | '));
await shot('notifications');

step('reload restores the session');
await page.reload();
await page.waitForTimeout(2500);
console.log('  still signed in:', (await page.getByPlaceholder('name@example.com').count()) === 0 && (await page.getByText('اعلان‌ها').count()) > 0);

step('profile + sign out');
await page.goto(MOBILE + '/profile');
await page.waitForTimeout(1500);
await shot('profile');
await page.getByText('خروج از حساب').click();
await page.getByPlaceholder('name@example.com').first().waitFor({ timeout: 5000 });
console.log('  signed out');
// The wrong-password attempt logs one expected 401.
console.log(
  'errors:',
  errors.filter((e) => !/favicon|401/.test(e)),
);
await browser.close();
