import { API, OUT, WEB, open } from './common.mjs';
const { browser, page, errors } = await open({ width: 1440, height: 900 });
await page.goto(WEB + '/coach/login');
await page.fill('input[type=email]', 'ali@alifitness.app');
await page.fill('input[type=password]', 'baseline-demo');
await page.click('button[type=submit]');
await page.waitForURL(/\/coach$/);
await page.goto(WEB + '/coach/chat');
await page.waitForTimeout(2500);
console.log('threads:', await page.locator('aside button.hv-sunken').count());
// athlete sends a message through the API → should appear live
const login = await fetch(API + '/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ali.rostami@gmail.com', password: 'baseline-demo' }),
}).then((r) => r.json());
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.access };
await fetch(API + '/messages/', { method: 'POST', headers: H, body: JSON.stringify({ text: 'پیام زنده از اپ ورزشکار ' + Date.now() }) });
await page.waitForTimeout(1500);
const bubbles = await page.locator('section span[style*="pre-wrap"]').allTextContents();
console.log('last bubble:', bubbles.at(-1));
// coach replies
await page.fill('textarea', 'دریافت شد، عالیه');
await page.click('footer button:has-text("ارسال")');
await page.waitForTimeout(1500);
const msgs = await fetch(API + '/messages/', { headers: H }).then((r) => r.json());
console.log('athlete sees:', msgs.at(-1).text, msgs.at(-1).sender);
// athlete reads → coach sees read receipt
await fetch(API + '/messages/read/', { method: 'POST', headers: H, body: '{}' });
await page.waitForTimeout(1200);
const metas = await page.locator('section span[style*="padding: 0px 4px"]').allTextContents();
console.log('last meta:', metas.at(-1));
await page.screenshot({ path: OUT + '/coach-chat.png' });
console.log(errors.join('\n') || 'no errors');
await browser.close();
