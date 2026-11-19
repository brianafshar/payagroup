// node tools/e2e/web-mobile.mjs [width] [path …] — the coach panel on a phone: screenshot each page and
// report horizontal overflow (the page must never scroll sideways; wide tables may scroll in their box).
import { OUT, WEB, open, webLogin } from './common.mjs';

const [w = '390', ...only] = process.argv.slice(2);
const ROUTES = only.length
  ? only
  : ['/coach', '/coach/athletes', '/coach/athlete?id=1', '/coach/library', '/coach/exercise?id=1', '/coach/programs', '/coach/program?id=2',
     '/coach/builder?id=2', '/coach/assign?id=2', '/coach/history?id=1', '/coach/nutrition?id=1', '/coach/recovery?id=1', '/coach/analytics?id=1',
     '/coach/analytics/strength?id=1', '/coach/analytics/endurance?id=1', '/coach/analytics/body?id=1', '/coach/analytics/recovery?id=1',
     '/coach/analytics/records?id=1', '/coach/settings', '/coach/chat', '/coach/athletes/new', '/coach/programs/new', '/coach/library/new', '/account']; // prettier-ignore
const { browser, page, errors } = await open({ width: +w, height: 844 });
await webLogin(page, 'coach');
let bad = 0;
for (const [i, path] of ROUTES.entries()) {
  await page.goto(WEB + path);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || (b.left >= -1 && b.right <= vw + 1) || getComputedStyle(el).visibility === 'hidden') continue;
      // inside a horizontal scroller is fine
      let p = el.parentElement,
        scrolls = false;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') && p.getBoundingClientRect().right <= vw + 1 && p.getBoundingClientRect().left >= -1) {
          scrolls = true;
          break;
        }
        p = p.parentElement;
      }
      if (!scrolls) over.push(el);
    }
    // report outermost offenders only
    const top = over.filter((el) => !over.includes(el.parentElement)).slice(0, 4);
    const desc = (el) =>
      el.tagName.toLowerCase() +
      (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') +
      ` [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}] "${(el.innerText || '').slice(0, 30).replace(/\n/g, ' ')}" style="${(el.getAttribute('style') || '').slice(0, 90)}"`;
    return { scroll: document.documentElement.scrollWidth, vw, over: top.map(desc) };
  });
  const n = String(i + 1).padStart(2, '0');
  await page.screenshot({ path: `${OUT}/mob-${n}.png`, fullPage: true });
  const ok = r.scroll <= r.vw + 1 && !r.over.length;
  if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'BAD ') + n + ' ' + path + (ok ? '' : ` scrollWidth=${r.scroll}/${r.vw}\n      ` + r.over.join('\n      ')));
}
console.log(bad ? bad + ' page(s) overflow' : 'no overflow', errors.length ? '\n' + errors.join('\n') : '');
await browser.close();
