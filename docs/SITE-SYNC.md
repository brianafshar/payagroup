# App → payagroup.org: how the site receives data

Implemented by `server/` (Node, no framework). It is the receiving side of the contract the app uses
(`backend/core/site.py` on the app branch).

On the gym PC set: `SITE_URL=https://payagroup.org`, `SITE_API_URL=https://payagroup.org/api`, `SITE_API_KEY=<same key as the site's SITE_API_KEY>`.
Every write carries `X-Api-Key`; a wrong or missing key gets `401`.

| Method & path | Auth | What it does |
|---|---|---|
| `PUT /api/exercises/{id}` | key | multipart: `data` (JSON), `video` (file, optional), `image` (file, optional). Idempotent: same id replaces. `204` |
| `DELETE /api/exercises/{id}` | key | removes the exercise and its files. `204` (also when it did not exist) |
| `POST /api/pdfs` | key | multipart: `token` (16-128 chars `A-Za-z0-9_-`), `file` (PDF). Returns `{"url": "https://payagroup.org/files/pdf/<token>.pdf"}` |
| `GET /api/public/exercises/` | none | list used by the site (only exercises that have a video), newest first |
| `GET /media/videos/<file>`, `/media/images/<file>` | none | stored media, `Range` supported (video seeking), immutable cache |
| `GET /files/pdf/<token>.pdf` | none (unguessable) | program PDF, `noindex`, deleted after `PDF_TTL_DAYS` (90) |

Rules
- `data` JSON fields: `id, name, description, category, sport, equipment, difficulty, duration, video_url, steps, tips, muscles_primary, muscles_secondary` (+ optional `name_en`, `description_en`, `steps_en`, `tips_en`).
- Video: a `video` file (mp4 / webm / mov) **or** `data.video_url` (https link). With neither, a repeat `PUT` keeps the stored video; a first `PUT` without any video is `400`.
- Sending a `video_url` for an exercise that had an uploaded file removes the file (coach switched to a link).
- Sending a new `video` replaces the old file. Sending no `image` keeps the stored cover.
- Exercise pages: `https://payagroup.org/{fa|en}/exercises/{id}` (the same id the PDF links use).
- Limits (env): video 2048 MB, image 20 MB, PDF 30 MB. Larger → `413`. Wrong type → `415`.
- Storage: a Docker volume mounted at `/data` (`exercises.json`, `videos/`, `images/`, `pdfs/`). Back it up.

## Server setup

```bash
cp .env.example .env     # then set SITE_API_KEY (16+ random chars), e.g.:  openssl rand -hex 24
docker compose up -d --build
```

Put the same key into the gym app as `SITE_API_KEY`.

### Uploads and a CDN / proxy
The gym PC uploads videos to `https://payagroup.org/api/exercises/{id}`. If the domain sits behind Cloudflare's proxy
(orange cloud) a single request is limited to 100 MB on the free plan, and Cloudflare may block the app's default
`Python-urllib` user agent. If that happens, either use a DNS-only (grey cloud) record for an upload hostname
(e.g. `upload.payagroup.org` → same server; set `SITE_API_URL=https://upload.payagroup.org/api`), or use external
video links for large videos. Your own Caddy needs no extra limit settings (the inner Caddy allows 3 GB bodies).
