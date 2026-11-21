# Public exercises API (read by the site)

`GET /api/public/exercises/` (unauthenticated, read-only, served by `server/`; see [SITE-SYNC.md](SITE-SYNC.md) for how the app fills it).

Returns every exercise that has a video, newest first, as an array. Fields:
`id, name, description, category, sport, equipment, difficulty, video_url` (absolute) and optionally
`name_en, description_en, duration, image_url, steps, steps_en, tips, tips_en, muscles_primary, muscles_secondary`.

- `*_en` fields are optional: the English site falls back to the Persian text until they exist.
- `category / sport / equipment / difficulty` are the app's keys (`chest`, `legs`, `basketball`, `fitness`, ...). Unknown keys are shown as-is; add translations in `src/data/labels.ts`.
- Exercise pages are addressed by `id`: `/fa/exercises/{id}`.
