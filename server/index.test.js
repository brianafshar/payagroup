import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KEY = "test-key-0123456789abcdef";
const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
let proc, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "paya-"));
  const shell = path.join(dir, "shell.html");
  fs.writeFileSync(shell, '<!doctype html><html lang="fa" dir="rtl"><head><title>x</title></head><body><div id="root"></div></body></html>');
  proc = spawn("node", ["index.js"], { env: { ...process.env, PORT, API_KEY: KEY, DATA_DIR: path.join(dir, "data"), SHELL_FILE: shell, PUBLIC_URL: BASE }, stdio: "inherit" });
  for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/api/health`); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error("server did not start");
});
after(() => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

const hdr = { "X-Api-Key": KEY };
const meta = (extra = {}) => JSON.stringify({ id: 7, name: "اسکوات", description: "d", category: "legs", sport: "fitness", equipment: "barbell", difficulty: "advanced", duration: "0:30", video_url: "", steps: ["a", "b"], tips: ["t"], muscles_primary: ["quads"], muscles_secondary: [], ...extra });
const form = (data, files = {}) => {
  const f = new FormData();
  f.append("data", data);
  for (const [k, [bytes, name, type]] of Object.entries(files)) f.append(k, new Blob([bytes], { type }), name);
  return f;
};
const video = Buffer.from("0123456789".repeat(100));

test("rejects wrong or missing key", async () => {
  for (const h of [{}, { "X-Api-Key": "nope" }]) {
    const r = await fetch(`${BASE}/api/exercises/7`, { method: "PUT", headers: h, body: form(meta(), { video: [video, "a.mp4", "video/mp4"] }) }).catch(() => ({ status: 401 }));
    assert.equal(r.status, 401);
  }
  assert.deepEqual(await (await fetch(`${BASE}/api/public/exercises/`)).json(), []);
});

test("uploads exercise with video+image, lists it, serves video with ranges", async () => {
  const r = await fetch(`${BASE}/api/exercises/7`, { method: "PUT", headers: hdr, body: form(meta(), { video: [video, "a.mp4", "video/mp4"], image: [Buffer.from("png"), "c.png", "image/png"] }) });
  assert.equal(r.status, 204);
  const list = await (await fetch(`${BASE}/api/public/exercises/`)).json();
  assert.equal(list.length, 1);
  const e = list[0];
  assert.equal(e.id, 7); assert.equal(e.difficulty, "advanced"); assert.deepEqual(e.steps, ["a", "b"]);
  assert.match(e.video_url, /\/media\/videos\/7-[a-z0-9]+\.mp4$/);
  assert.match(e.image_url, /\/media\/images\/7-[a-z0-9]+\.png$/);
  const full = await fetch(e.video_url);
  assert.equal(full.status, 200); assert.equal((await full.arrayBuffer()).byteLength, 1000);
  const part = await fetch(e.video_url, { headers: { Range: "bytes=10-19" } });
  assert.equal(part.status, 206); assert.equal(part.headers.get("content-range"), "bytes 10-19/1000");
  assert.equal(await part.text(), "0123456789");
});

test("re-sending metadata without a file keeps the stored video; replacing swaps files", async () => {
  let r = await fetch(`${BASE}/api/exercises/7`, { method: "PUT", headers: hdr, body: form(meta({ name: "اسکوات ۲" })) });
  assert.equal(r.status, 204);
  let [e] = await (await fetch(`${BASE}/api/public/exercises`)).json();
  assert.equal(e.name, "اسکوات ۲"); assert.match(e.video_url, /\/media\/videos\//);
  const oldFiles = fs.readdirSync(path.join(dir, "data", "videos"));
  await new Promise((r) => setTimeout(r, 5));
  r = await fetch(`${BASE}/api/exercises/7`, { method: "PUT", headers: hdr, body: form(meta(), { video: [video, "b.webm", "video/webm"] }) });
  assert.equal(r.status, 204);
  [e] = await (await fetch(`${BASE}/api/public/exercises`)).json();
  assert.match(e.video_url, /\.webm$/);
  const now = fs.readdirSync(path.join(dir, "data", "videos"));
  assert.equal(now.length, 1); assert.notDeepEqual(now, oldFiles);
});

test("external link replaces uploaded file; exercise without any video is rejected", async () => {
  let r = await fetch(`${BASE}/api/exercises/7`, { method: "PUT", headers: hdr, body: form(meta({ video_url: "https://youtu.be/x" })) });
  assert.equal(r.status, 204);
  const [e] = await (await fetch(`${BASE}/api/public/exercises`)).json();
  assert.equal(e.video_url, "https://youtu.be/x");
  assert.equal(fs.readdirSync(path.join(dir, "data", "videos")).length, 0);
  r = await fetch(`${BASE}/api/exercises/8`, { method: "PUT", headers: hdr, body: form(meta({ id: 8 })) });
  assert.equal(r.status, 400);
  r = await fetch(`${BASE}/api/exercises/8`, { method: "PUT", headers: hdr, body: form(meta({ id: 8 }), { video: [video, "x.exe", "application/octet-stream"] }) });
  assert.equal(r.status, 415);
});

test("delete removes it (idempotent)", async () => {
  assert.equal((await fetch(`${BASE}/api/exercises/7`, { method: "DELETE", headers: hdr })).status, 204);
  assert.equal((await fetch(`${BASE}/api/exercises/7`, { method: "DELETE", headers: hdr })).status, 204);
  assert.deepEqual(await (await fetch(`${BASE}/api/public/exercises/`)).json(), []);
});

test("PDF upload returns a public link", async () => {
  const token = "abcDEF1234567890_-xyz";
  const f = new FormData();
  f.append("token", token);
  f.append("file", new Blob([Buffer.from("%PDF-1.4 hello")], { type: "application/pdf" }), "p.pdf");
  const r = await fetch(`${BASE}/api/pdfs`, { method: "POST", headers: hdr, body: f });
  assert.equal(r.status, 200);
  const { url } = await r.json();
  assert.equal(url, `${BASE}/files/pdf/${token}.pdf`);
  const got = await fetch(url);
  assert.equal(got.headers.get("content-type"), "application/pdf");
  assert.match(await got.text(), /^%PDF-/);
  const bad = new FormData(); bad.append("token", token + "2"); bad.append("file", new Blob(["nope"]), "x.pdf");
  assert.equal((await fetch(`${BASE}/api/pdfs`, { method: "POST", headers: hdr, body: bad })).status, 415);
  assert.equal((await fetch(`${BASE}/files/pdf/..%2f..%2fexercises.json`)).status, 404);
});

test("exercise pages and sitemap are crawler-friendly", async () => {
  const r = await fetch(`${BASE}/api/exercises/21`, { method: "PUT", headers: hdr, body: form(meta({ id: 21, name: "پرس سینه", name_en: "Bench Press", description: "حرکت پایه سینه", description_en: "Chest basics" }), { video: [video, "a.mp4", "video/mp4"] }) });
  assert.equal(r.status, 204);
  const fa = await fetch(`${BASE}/fa/exercises/21`);
  assert.equal(fa.status, 200);
  const html = await fa.text();
  assert.match(html, /<html lang="fa" dir="rtl">/);
  assert.match(html, /<title>پرس سینه \| آموزش حرکت \| Paya<\/title>/);
  assert.match(html, /<link rel="canonical" href="http:\/\/localhost:3999\/fa\/exercises\/21"/);
  assert.match(html, /hreflang="en" href="http:\/\/localhost:3999\/en\/exercises\/21"/);
  assert.match(html, /"@type":"VideoObject"/);
  assert.match(html, /"contentUrl":"http:\/\/localhost:3999\/media\/videos\/21-/);
  assert.match(html, /<noscript>.*<h1>پرس سینه<\/h1>/s);
  const en = await (await fetch(`${BASE}/en/exercises/21`)).text();
  assert.match(en, /<title>Bench Press \| exercise tutorial \| Paya<\/title>/);
  assert.match(en, /<html lang="en" dir="ltr">/);
  const missing = await fetch(`${BASE}/fa/exercises/999`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /noindex/);
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(sm, /<loc>http:\/\/localhost:3999\/fa\/exercises\/21<\/loc>/);
  assert.match(sm, /<loc>http:\/\/localhost:3999\/en\/elite\/<\/loc>/);
  assert.match(sm, /hreflang="x-default"/);
});
