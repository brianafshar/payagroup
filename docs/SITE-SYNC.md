# App → payagroup.org connection

The gym PC (Windows app) pushes to the site. The site never calls the gym PC, which is not reachable from the internet.
Configure on the PC: `SITE_URL` (default `https://payagroup.org`), `SITE_API_URL` (e.g. `https://payagroup.org/api`), `SITE_API_KEY`.
Every request carries the header `X-Api-Key: <SITE_API_KEY>`; the site must reject a wrong key with 401.

## 1. Exercises with a video (library → site)

Sent when a coach saves an exercise that has a video (upload or URL), and on demand from
*Library → «ارسال ویدیوها به سایت»* (head coach).

`PUT {SITE_API_URL}/exercises/{id}` — `multipart/form-data`
- `data`: JSON, the shape of `website:docs/API-CONTRACT.md` (`id, name, description, category, sport, equipment,
  difficulty, duration, video_url, steps, tips, muscles_primary, muscles_secondary`).
  `video_url` is only set when the coach pasted an external link; with an uploaded video it is empty and `video` is sent.
- `video`: the uploaded video file (optional; absent when the video is an external link).
- `image`: cover picture (optional).
- Idempotent: the same id replaces the previous version. `{id}` is the app's exercise id.
- Reply `2xx` (body ignored). The site stores the files, sets absolute `video_url` / `image_url`, and lists the exercise in
  `GET /public/exercises/` (unauthenticated, read-only).

`DELETE {SITE_API_URL}/exercises/{id}` — the exercise was deleted or lost its video.

The PDF links exercise names to `{SITE_URL}/fa/exercises/{id}` (the site's `/exercises/:id` route).

## 2. Program PDFs (SMS download link)

`POST {SITE_API_URL}/pdfs` — `multipart/form-data`: `token` (random string), `file` (PDF).
Reply JSON `{"url": "https://payagroup.org/…"}` — a public, unguessable link the athlete opens from the SMS.
