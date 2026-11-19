#!/usr/bin/env node
/**
 * Screenshots the athlete app's web build (apps/mobile/dist-web) at 390×844, like the designs.
 *   (cd apps/mobile && npx expo export --platform web --output-dir dist-web)
 *   node tools/mobile-shots.mjs <outDir> [--dark] [--only=home,log]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) || 'mobile-shots';
const dark = args.includes('--dark');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const ROOT = 'apps/mobile/dist-web';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = join(ROOT, p);
  if (!existsSync(f) || p === '/' || !extname(f)) f = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(8788);

// [name, path, signedIn]
const PAGES = [
  ['M34-login', '/login', false],
  ['M48-invite', '/invite', false],
  ['M48-accept', '/invite/accept', false],
  ['M48-expired', '/invite/expired', false],
  ['M35-home', '/home', true],
  ['M36-workout', '/workout', true],
  ['M37-exercise', '/exercise/0', true],
  ['M38-log', '/log/3', true],
  ['M39-complete', '/complete', true],
  ['M40-nutrition', '/nutrition', true],
  ['M41-recovery', '/recovery', true],
  ['M42-measure', '/measure', true],
  ['M43-progress', '/progress', true],
  ['M44-records', '/records', true],
  ['M45-profile', '/profile', true],
  ['M46-health', '/health', true],
  ['M47-chat', '/chat', true],
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
for (const [name, path, signedIn] of PAGES) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o))) continue;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  await ctx.addInitScript((s) => localStorage.setItem('bl:session', JSON.stringify({ signedIn: s, onboarded: s })), signedIn);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text().slice(0, 200)}`));
  await page.goto('http://localhost:8788' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}${dark ? '-dark' : ''}.png` });
  await ctx.close();
}
await browser.close();
server.close();
console.log(errors.length ? errors.join('\n') : 'no runtime errors');
