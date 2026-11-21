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
payagroup.org {
	reverse_proxy paya-site:80
}
www.payagroup.org {
	redir https://payagroup.org{uri} permanent
}
```

If your Caddy runs on the host (not in Docker), add `ports: ["127.0.0.1:8081:80"]` to the `paya-site` service and use `reverse_proxy 127.0.0.1:8081`.

In the gym app set `SITE_URL=https://payagroup.org`, `SITE_API_URL=https://payagroup.org/api`, `SITE_API_KEY=<the same key>`.

## SEO (search engines)

Built in:
- **Prerendered HTML**: `npm run build` renders every page (fa + en) to real HTML (`scripts/prerender.mjs`), so crawlers see the text without running JavaScript; the browser then hydrates it.
- Per page: unique `<title>` and description, canonical URL, `hreflang` (fa / en / x-default), Open Graph + Twitter cards (`public/og.jpg`), JSON-LD (`SportsClub`, `WebSite`, `BreadcrumbList`).
- **Exercise pages** (`/fa/exercises/{id}`) are rendered by `server/` with their own title/description, `VideoObject` JSON-LD and a `<noscript>` text version. They are listed in `/sitemap.xml` (generated from the stored exercises, both languages with hreflang).
- `robots.txt`, a real `404` page with status 404 (no soft-404s), `/` → `/fa/` (301), `www` → apex (301).

To do after deploy:
1. Fill in the real address, phone and social links in `BUSINESS` (`src/seo.ts`); they go into the structured data (left out while empty), then rebuild.
2. Register `https://payagroup.org` in **Google Search Console** and **Bing Webmaster Tools** (DNS or HTML-tag verification), submit `https://payagroup.org/sitemap.xml`, and use "URL inspection" on `/fa/` to request indexing.
3. Replace the sample texts with real content (search engines rank real, specific text) and add a Google Maps / Business Profile for the club.
4. If you change the domain, set `VITE_SITE_URL` at build time (and `PUBLIC_URL` for the API) and update `public/robots.txt`.

## Placeholder content to replace later

Stats, about text, schedules, coaches, address and phone are sample text: `src/i18n.ts` (shared strings) and
`src/pages/Sport.tsx` (basketball / bodybuilding content). Category / sport / equipment names: `src/data/labels.ts`.
