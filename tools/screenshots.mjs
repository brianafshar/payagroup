#!/usr/bin/env node
/**
 * Screenshots every web route (1440px wide, like the design canvases) for visual comparison
 * against project/design_handoff_baseline_coaching/screenshots.
 *   node tools/screenshots.mjs [baseUrl] [outDir] [--dark] [--only=C13,A03]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) || 'http://localhost:4173';
const out = args.find((a) => !a.startsWith('http') && !a.startsWith('--')) || 'screenshots';
const dark = args.includes('--dark');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const PAGES = [
  ['A01', '/admin/login'], ['A02', '/admin'], ['A03', '/admin/coaches'], ['A04', '/admin/coaches/new'], ['A05', '/admin/coach'],
  ['A06', '/admin/athletes'], ['A07', '/admin/branding'], ['A08', '/admin/access'], ['C09', '/coach/login'], ['C10', '/coach'],
  ['C11', '/coach/athletes'], ['C12', '/coach/athlete'], ['C13', '/coach/athletes/new'], ['C14', '/coach/library'], ['C15', '/coach/library/new'],
  ['C16', '/coach/exercise'], ['C17', '/coach/programs'], ['C18', '/coach/programs/new'], ['C19', '/coach/builder'], ['C20', '/coach/program'],
  ['C21', '/coach/assign'], ['C22', '/coach/customize'], ['C23', '/coach/history'], ['C24', '/coach/nutrition'], ['C25', '/coach/recovery'],
  ['C26', '/coach/analytics'], ['C27', '/coach/analytics/strength'], ['C28', '/coach/analytics/endurance'], ['C29', '/coach/analytics/body'],
  ['C30', '/coach/analytics/recovery'], ['C31', '/coach/analytics/records'], ['C32', '/coach/settings'], ['C33', '/coach/chat'], ['IDX', '/'],
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: dark ? 'dark' : 'light', locale: 'fa-IR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[${page.url()}] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`[${page.url()}] console: ${m.text()}`));
for (const [code, path] of PAGES) {
  if (only.length && !only.includes(code)) continue;
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${code}${dark ? '-dark' : ''}.png`, fullPage: false });
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no runtime errors');
