# Paya Group — website (payagroup.org)

Bilingual (fa / en) club website: landing, Basketball, Bodybuilding, Contact, and a public
**exercise tutorials** library fed from the Paya app.

This branch (`website`) is independent of the app code. Nothing here touches `apps/`, `backend/` or `packages/`.

- Stack: React 19 + Vite + TypeScript + React Router (no UI framework). Fonts: Vazirmatn, Anton.
- Look: Awwwards "project navigation" style: pages side by side with thin dividers, small top menu, vertical tick indicator + up/down arrows on the right, wheel/keys/arrows/swipe move sideways, orange wipe between routes.
- Routes (language prefix `/fa` or `/en`):
  `/` · `/basketball` · `/elite` (bodybuilding; `/bodybuilding` redirects) · `/exercises` (filters: `?sport=&cat=&q=`) · `/exercises/:id-slug` · `/contact`
- Exercise links for PDFs: `https://payagroup.org/fa/exercises/42-barbell-squat` (only the leading id matters;
  `https://payagroup.org/fa/exercises/42` also works).

## Develop

```bash
npm install
npm run dev              # site on http://localhost:5174 (sample exercises while VITE_API_URL is unset)
```

With the real API locally (two terminals):

```bash
cd server && npm install && API_KEY=dev-key-0123456789abcdef PUBLIC_URL=http://localhost:5174 npm start   # API on :3000
# in the repo root, put VITE_API_URL=/api in .env  (Vite proxies /api, /media, /files to :3000)
npm run dev
```

Tests of the API: `cd server && npm test`.

## What is in this branch

- `src/`: the website (React).
- `server/`: the small API that **receives exercises, videos and program PDFs from the gym app** and serves them publicly
  (`PUT/DELETE /api/exercises/{id}`, `POST /api/pdfs`, `GET /api/public/exercises/`). Contract: [docs/SITE-SYNC.md](docs/SITE-SYNC.md).

## Deploy (Docker + Caddy)

```bash
docker network create web            # once, if your Caddy's network does not exist yet (or set CADDY_NETWORK)
cp .env.example .env                 # set SITE_API_KEY=<16+ random chars>   (openssl rand -hex 24)
docker compose up -d --build         # starts paya-site (static + proxy) and paya-site-api (+ data volume)
```

Then add this block to your **existing** Caddyfile (that Caddy must be on the same Docker network):

```caddy
payagroup.org, www.payagroup.org {
	reverse_proxy paya-site:80
}
```

If your Caddy runs on the host (not in Docker), add `ports: ["127.0.0.1:8081:80"]` to the `paya-site` service and use `reverse_proxy 127.0.0.1:8081`.

In the gym app set `SITE_URL=https://payagroup.org`, `SITE_API_URL=https://payagroup.org/api`, `SITE_API_KEY=<the same key>`.

## Placeholder content to replace later

Stats, about text, schedules, coaches, address and phone are sample text: `src/i18n.ts` (shared strings) and
`src/pages/Sport.tsx` (basketball / bodybuilding content). Category / sport / equipment names: `src/data/labels.ts`.
