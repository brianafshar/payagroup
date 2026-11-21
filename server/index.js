// Paya site API: receives exercises (with video), and program PDFs from the gym app and serves them publicly.
// Contract: see ../docs/SITE-SYNC.md. No framework; Node's http + busboy for multipart streaming.
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";

const env = process.env;
const PORT = Number(env.PORT || 3000);
const API_KEY = env.API_KEY || "";
const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const DATA_DIR = path.resolve(env.DATA_DIR || "./data");
const MAX_VIDEO = Number(env.MAX_VIDEO_MB || 2048) * 1024 * 1024;
const MAX_IMAGE = Number(env.MAX_IMAGE_MB || 20) * 1024 * 1024;
const MAX_PDF = Number(env.MAX_PDF_MB || 30) * 1024 * 1024;
const PDF_TTL_MS = Number(env.PDF_TTL_DAYS || 90) * 86400_000;

if (!API_KEY || API_KEY.length < 16) {
  console.error("API_KEY must be set (16+ characters). Refusing to start.");
  process.exit(1);
}

const DIRS = { videos: path.join(DATA_DIR, "videos"), images: path.join(DATA_DIR, "images"), pdfs: path.join(DATA_DIR, "pdfs"), tmp: path.join(DATA_DIR, "tmp") };
for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
const INDEX = path.join(DATA_DIR, "exercises.json");

const VIDEO_EXT = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/mp4" };
const IMAGE_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
const DIFFICULTY = new Set(["beginner", "intermediate", "advanced"]);

// ---------- storage (JSON index, serialized writes) ----------
let exercises = new Map();
try {
  for (const e of JSON.parse(fs.readFileSync(INDEX, "utf8"))) exercises.set(e.id, e);
} catch { /* first run */ }

let writeChain = Promise.resolve();
function locked(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => {});
  return run;
}
async function saveIndex() {
  const tmp = INDEX + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify([...exercises.values()]));
  await fsp.rename(tmp, INDEX);
}
const rm = (p) => fsp.rm(p, { force: true }).catch(() => {});

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const send = (res, status, body, headers = {}) => {
  const isObj = body !== null && typeof body === "object";
  const payload = body == null ? "" : isObj ? JSON.stringify(body) : String(body);
  res.writeHead(status, { "Content-Type": isObj ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(payload);
};

function authorized(req) {
  const given = Buffer.from(String(req.headers["x-api-key"] || ""));
  const want = Buffer.from(API_KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v, max = 40, len = 600) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);
const slug = (v, fallback = "") => (str(v, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "") || fallback);

function cleanExercise(id, raw, prev) {
  const d = raw && typeof raw === "object" ? raw : {};
  const name = str(d.name, 200);
  if (!name) throw new HttpError(400, "data.name is required");
  let videoUrl = str(d.video_url, 2000);
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) videoUrl = "";
  return {
    id,
    name,
    name_en: str(d.name_en, 200) || prev?.name_en || "",
    description: str(d.description, 5000),
    description_en: str(d.description_en, 5000) || prev?.description_en || "",
    category: slug(d.category, "other"),
    sport: slug(d.sport, "fitness"),
    equipment: slug(d.equipment, "none"),
    difficulty: DIFFICULTY.has(d.difficulty) ? d.difficulty : "beginner",
    duration: str(d.duration, 20),
    external_video: videoUrl,
    steps: strList(d.steps),
    tips: strList(d.tips),
    steps_en: strList(d.steps_en).length ? strList(d.steps_en) : prev?.steps_en || [],
    tips_en: strList(d.tips_en).length ? strList(d.tips_en) : prev?.tips_en || [],
    muscles_primary: strList(d.muscles_primary, 20, 80),
    muscles_secondary: strList(d.muscles_secondary, 20, 80),
    video_file: prev?.video_file || "",
    image_file: prev?.image_file || "",
    created_at: prev?.created_at || Date.now(),
    updated_at: Date.now(),
  };
}

function publicView(e) {
  const video_url = e.video_file ? `${PUBLIC_URL}/media/videos/${e.video_file}` : e.external_video;
  if (!video_url) return null;
  const out = {
    id: e.id, name: e.name, description: e.description, category: e.category, sport: e.sport,
    equipment: e.equipment, difficulty: e.difficulty, video_url,
    muscles_primary: e.muscles_primary, muscles_secondary: e.muscles_secondary,
    steps: e.steps, tips: e.tips,
  };
  if (e.name_en) out.name_en = e.name_en;
  if (e.description_en) out.description_en = e.description_en;
  if (e.steps_en?.length) out.steps_en = e.steps_en;
  if (e.tips_en?.length) out.tips_en = e.tips_en;
  if (e.duration) out.duration = e.duration;
  if (e.image_file) out.image_url = `${PUBLIC_URL}/media/images/${e.image_file}`;
  return out;
}

// ---------- multipart ----------
/** Streams a multipart body: text fields into `fields`, files into tmp files. */
function parseMultipart(req, limits) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({ headers: req.headers, limits: { fileSize: Math.max(...Object.values(limits)), files: 3, fields: 10, fieldSize: 2 * 1024 * 1024 } });
    } catch {
      return reject(new HttpError(400, "multipart/form-data expected"));
    }
    const fields = {};
    const files = {};
    const writes = [];
    let failed = null;
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (name, stream, info) => {
      const limit = limits[name];
      if (!limit) { stream.resume(); return; }
      const tmp = path.join(DIRS.tmp, crypto.randomUUID());
      const out = fs.createWriteStream(tmp);
      let size = 0;
      let tooBig = false;
      stream.on("data", (c) => { size += c.length; if (size > limit && !tooBig) { tooBig = true; failed = new HttpError(413, `${name} is too large`); stream.unpipe(out); stream.resume(); out.destroy(); } });
      stream.on("limit", () => { tooBig = true; failed ||= new HttpError(413, `${name} is too large`); });
      stream.pipe(out);
      writes.push(new Promise((r) => out.on("close", r)).then(() => { if (!tooBig) files[name] = { tmp, size, filename: info.filename || "", mime: info.mimeType || "" }; else rm(tmp); }));
    });
    bb.on("error", (e) => { failed ||= new HttpError(400, String(e.message)); });
    bb.on("close", async () => {
      await Promise.all(writes);
      if (failed) { await Promise.all(Object.values(files).map((f) => rm(f.tmp))); reject(failed); } else resolve({ fields, files });
    });
    req.pipe(bb);
  });
}

async function sniff(file, n = 16) {
  const fh = await fsp.open(file, "r");
  try { const b = Buffer.alloc(n); const { bytesRead } = await fh.read(b, 0, n, 0); return b.subarray(0, bytesRead); } finally { await fh.close(); }
}
const extOf = (name, table, mime) => {
  const e = path.extname(name || "").toLowerCase();
  if (table[e]) return e;
  return Object.keys(table).find((k) => table[k] === mime) || "";
};

// ---------- handlers ----------
async function putExercise(req, res, id) {
  const { fields, files } = await parseMultipart(req, { video: MAX_VIDEO, image: MAX_IMAGE });
  const cleanup = () => Promise.all(Object.values(files).map((f) => rm(f.tmp)));
  try {
    let data;
    try { data = JSON.parse(fields.data || "{}"); } catch { throw new HttpError(400, "data must be JSON"); }
    let vExt = "", iExt = "";
    if (files.video) {
      vExt = extOf(files.video.filename, VIDEO_EXT, files.video.mime);
      if (!vExt) throw new HttpError(415, "unsupported video type (mp4, webm, mov)");
    }
    if (files.image) {
      iExt = extOf(files.image.filename, IMAGE_EXT, files.image.mime);
      if (!iExt) throw new HttpError(415, "unsupported image type");
    }
    await locked(async () => {
      const prev = exercises.get(id);
      const next = cleanExercise(id, data, prev);
      const stamp = Date.now().toString(36);
      const drop = [];
      if (files.video) {
        const fname = `${id}-${stamp}${vExt}`;
        await fsp.rename(files.video.tmp, path.join(DIRS.videos, fname));
        if (next.video_file) drop.push(path.join(DIRS.videos, next.video_file));
        next.video_file = fname;
        delete files.video;
      } else if (next.external_video && next.video_file) {
        drop.push(path.join(DIRS.videos, next.video_file)); // coach switched to an external link
        next.video_file = "";
      }
      if (!next.video_file && !next.external_video) throw new HttpError(400, "an exercise needs a video file or a video_url");
      if (files.image) {
        const fname = `${id}-${stamp}${iExt}`;
        await fsp.rename(files.image.tmp, path.join(DIRS.images, fname));
        if (next.image_file) drop.push(path.join(DIRS.images, next.image_file));
        next.image_file = fname;
        delete files.image;
      }
      exercises.set(id, next);
      await saveIndex();
      await Promise.all(drop.map(rm));
    });
    send(res, 204);
  } finally {
    await cleanup();
  }
}

async function deleteExercise(res, id) {
  await locked(async () => {
    const e = exercises.get(id);
    if (!e) return;
    exercises.delete(id);
    await saveIndex();
    if (e.video_file) await rm(path.join(DIRS.videos, e.video_file));
    if (e.image_file) await rm(path.join(DIRS.images, e.image_file));
  });
  send(res, 204);
}

async function postPdf(req, res) {
  const { fields, files } = await parseMultipart(req, { file: MAX_PDF });
  try {
    const token = fields.token || "";
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new HttpError(400, "token must be 16-128 chars of A-Z a-z 0-9 _ -");
    if (!files.file) throw new HttpError(400, "file is required");
    if ((await sniff(files.file.tmp, 5)).toString("latin1") !== "%PDF-") throw new HttpError(415, "not a PDF");
    await fsp.rename(files.file.tmp, path.join(DIRS.pdfs, `${token}.pdf`));
    delete files.file;
    send(res, 200, { url: `${PUBLIC_URL}/files/pdf/${token}.pdf` });
  } finally {
    await Promise.all(Object.values(files).map((f) => rm(f.tmp)));
  }
}

/** Static file with Range support (needed so videos can seek). */
async function serveFile(req, res, file, type, extra = {}) {
  let st;
  try { st = await fsp.stat(file); } catch { return send(res, 404, "Not found"); }
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", ...extra };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  let start = 0, end = st.size - 1, status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
    else { start = Math.max(0, st.size - Number(range[2])); }
    if (start > end || start >= st.size) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
    status = 206;
    base["Content-Range"] = `bytes ${start}-${end}/${st.size}`;
  }
  base["Content-Length"] = end - start + 1;
  res.writeHead(status, base);
  if (req.method === "HEAD") return res.end();
  await pipeline(fs.createReadStream(file, { start, end }), res).catch(() => {});
}

const IMMUTABLE = { "Cache-Control": "public, max-age=31536000, immutable" };

async function route(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  if (p === "/api/health") return send(res, 200, { ok: true });

  if (p === "/api/public/exercises" && (m === "GET" || m === "HEAD")) {
    const list = [...exercises.values()].sort((a, b) => b.updated_at - a.updated_at).map(publicView).filter(Boolean);
    return send(res, 200, list, { "Cache-Control": "public, max-age=30", "Access-Control-Allow-Origin": "*" });
  }

  let r;
  if ((r = /^\/media\/videos\/([0-9]+-[a-z0-9]+\.[a-z0-9]+)$/.exec(p))) {
    const type = VIDEO_EXT[path.extname(r[1])];
    return type ? serveFile(req, res, path.join(DIRS.videos, r[1]), type, { ...IMMUTABLE, "Access-Control-Allow-Origin": "*" }) : send(res, 404, "Not found");
  }
  if ((r = /^\/media\/images\/([0-9]+-[a-z0-9]+\.[a-z0-9]+)$/.exec(p))) {
    const type = IMAGE_EXT[path.extname(r[1])];
    return type ? serveFile(req, res, path.join(DIRS.images, r[1]), type, { ...IMMUTABLE, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "Access-Control-Allow-Origin": "*" }) : send(res, 404, "Not found");
  }
  if ((r = /^\/files\/pdf\/([A-Za-z0-9_-]{16,128})\.pdf$/.exec(p))) {
    return serveFile(req, res, path.join(DIRS.pdfs, `${r[1]}.pdf`), "application/pdf", { "Content-Disposition": "inline", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, max-age=3600" });
  }

  // everything below needs the API key
  const writeRoute = (r = /^\/api\/exercises\/([0-9]{1,9})$/.exec(p)) || p === "/api/pdfs";
  if (writeRoute) {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "text/plain", Connection: "close" });
      res.end("Unauthorized");
      return req.destroy();
    }
    if (r && m === "PUT") return putExercise(req, res, Number(r[1]));
    if (r && m === "DELETE") return deleteExercise(res, Number(r[1]));
    if (p === "/api/pdfs" && m === "POST") return postPdf(req, res);
    return send(res, 405, "Method not allowed");
  }
  return send(res, 404, "Not found");
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    if (res.headersSent) return res.destroy();
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: "server error" });
  });
});
server.requestTimeout = 0; // large uploads over slow links
server.headersTimeout = 30_000;

// drop temp leftovers and expired PDFs
async function housekeeping() {
  const now = Date.now();
  for (const [dir, ttl] of [[DIRS.tmp, 3600_000], [DIRS.pdfs, PDF_TTL_MS]]) {
    for (const f of await fsp.readdir(dir).catch(() => [])) {
      const full = path.join(dir, f);
      const st = await fsp.stat(full).catch(() => null);
      if (st && now - st.mtimeMs > ttl) await rm(full);
    }
  }
}
housekeeping();
setInterval(housekeeping, 6 * 3600_000).unref();

server.listen(PORT, () => console.log(`paya-site-api on :${PORT}, data in ${DATA_DIR}, ${exercises.size} exercises`));
