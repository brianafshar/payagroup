# Public exercises API (needed by the site)

The site calls one **public, read-only, unauthenticated** endpoint on the app backend:

`GET /api/public/exercises/`

Returns every exercise, from all coaches, that **has a video** (uploaded `video` or `video_url`).
A plain array or DRF-paginated `{ "results": [...] }` are both accepted. (If paginated, return all items or
a large page size; the site loads the list once.)

```json
{
  "id": 42,
  "name": "اسکوات هالتر",
  "name_en": "Barbell Squat",
  "description": "…",
  "description_en": "…",
  "category": "legs",
  "sport": "fitness",
  "equipment": "barbell",
  "difficulty": "intermediate",
  "duration": "0:45",
  "video_url": "https://…/media/exercises/42.mp4",
  "image_url": "https://…/media/exercises/42.jpg",
  "steps": ["…"], "steps_en": ["…"],
  "tips": ["…"], "tips_en": ["…"],
  "muscles_primary": ["quadriceps"],
  "muscles_secondary": ["glutes"]
}
```

Notes
- Required: `id, name, description, category, sport, equipment, difficulty, video_url`. Everything else is optional.
- `*_en` fields are optional: the English site falls back to the Persian text until they exist.
- `category` / `sport` / `equipment` / `difficulty` are the app's existing keys (`chest`, `legs`, `basketball`, `fitness`…).
  Unknown keys are shown as-is; add translations in `src/data/labels.ts`.
- `video_url` / `image_url` must be absolute URLs (or `/media/...` paths, which the site resolves against the API origin)
  and publicly readable (not time-limited signed URLs, or videos will stop playing after they expire).
- Exercise pages are addressed by `id`, so the PDF link only needs the id: `/fa/exercises/{id}`.
- CORS: allow `https://payagroup.org`.
