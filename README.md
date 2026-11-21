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
cp .env.example .env     # VITE_API_URL empty = built-in sample exercises
npm run dev              # http://localhost:5174
npm run build
```

## Exercise data

The site reads `GET {VITE_API_URL}/public/exercises/` — see [docs/API-CONTRACT.md](docs/API-CONTRACT.md).
That endpoint does **not** exist in the app yet. Until it does, leave `VITE_API_URL` empty (sample data).

## Deploy (Docker + Caddy)

```bash
# on the server, once: a shared network with your existing Caddy
docker network create web            # skip if it exists; set CADDY_NETWORK to your network's name otherwise

VITE_API_URL=https://api.payagroup.org/api docker compose up -d --build
```

Then add this block to your **existing** Caddyfile (the container must be on the same Docker network as that Caddy):

```caddy
payagroup.org, www.payagroup.org {
	reverse_proxy paya-site:80
}
```

If your Caddy runs on the host (not in Docker), publish the port instead: add `ports: ["127.0.0.1:8081:80"]`
to the service and use `reverse_proxy 127.0.0.1:8081`.

`VITE_API_URL` is baked into the build, so rebuild after changing it. The API must allow CORS from
`https://payagroup.org` (`CORS_ALLOWED_ORIGINS` in the Django settings).

## Placeholder content to replace later

Stats, about text, schedules, coaches, address and phone are sample text: `src/i18n.ts` (shared strings) and
`src/pages/Sport.tsx` (basketball / bodybuilding content). Category / sport / equipment names: `src/data/labels.ts`.
