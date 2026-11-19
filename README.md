# indow — white-label coaching platform

Persian (fa-IR, RTL) strength & conditioning platform with three roles: **Admin** (platform owner),
**Coach** (web, desktop-first) and **Athlete** (mobile app, branded per coach). Implemented from the
Claude Design handoff in [`project/`](project/) (see `project/design_handoff_baseline_coaching/README.md`).

```
apps/
  web/        React 19 + Vite + TypeScript SPA — Admin (A01–A08) and Coach (C09–C33) panels
  mobile/     Expo SDK 57 (React Native) athlete app — M34–M48 (iOS / Android / web)
backend/      Django 5.2 + DRF REST API (JWT auth, roles, all domain data) — see backend/README.md
packages/
  tokens/     Design tokens shared by web & mobile (white-label themes × light/dark)
  core/       Platform-neutral helpers shared by web & mobile: icon set, Jalali calendar,
              Persian digits/numbers/dates, faJoin (RTL-safe separators)
project/      Design handoff (HTML prototypes, screenshots, design system source) — reference only
              (original bundle note: project/HANDOFF_BUNDLE.md; design chat: chats/)
tools/        convert-dc.mjs (one-off prototype → React porter), screenshots.mjs / mobile-shots.mjs /
              design-shots.mjs (visual checks), e2e/ (browser checks against a running API)
```

## Getting started

```bash
pnpm install
pnpm dev          # web app → http://localhost:5173 (index of all screens)
pnpm mobile       # Expo dev server for the athlete app (scan with Expo Go, or press a / i / w)
pnpm typecheck    # tokens + core + web + mobile
pnpm test         # tokens + core + web (vitest) + mobile (jest-expo)
pnpm build        # production build of the web app
```

API (Django, Python 3.11+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python manage.py migrate && python manage.py seed_demo
python manage.py runserver                          # http://localhost:8000/api/docs/
```

Start at `/admin/login` or `/coach/login` (`/` sends you to your panel).

**Production server:** `deploy/` runs everything on one Ubuntu VPS with Docker (PostgreSQL, Redis, the
API, Caddy with automatic HTTPS, the coach panel, the athlete web app / PWA and an app download page):
`sudo deploy/install.sh`. Guide: `deploy/README.md`.

### Where the data comes from

All data lives in the Django backend; the demo data is created by `python manage.py seed_demo`
(`--reset` to start over). Nothing is hardcoded in the clients.

- **Web** always talks to the API: `/api` by default, proxied by Vite to `localhost:8000` (with `/media`
  and `/ws`); set `VITE_API_URL` for another server (production: `apps/web/.env.production.example`).
  Start the API, then `pnpm dev`, and sign in with a demo account from `backend/README.md` (password
  `baseline-demo`).
- **Athlete app** uses the API when `EXPO_PUBLIC_API_URL` is set, e.g.
  `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api pnpm mobile`. A phone needs your computer's LAN
  address and the API listening on it: `python manage.py runserver 0.0.0.0:8000`. In development any
  host is allowed. Without it the app shows the design's sample data (design
  review, jest tests).

## Architecture (web)

| Layer | Where | Notes |
| --- | --- | --- |
| Brand | `brand/` | indow logo package (all logos, colourways, favicons, app icons) and where each one is used — see `brand/README.md`. |
| Tokens | `packages/tokens` | Single source for colors/spacing/type/motion. `buildCss()` emits CSS variables for every `data-theme` (brand, base, ali-fitness, northline, kova) × `data-mode` (light/dark); `colors(theme, mode)` feeds React Native. Dark brand text is lifted to WCAG AA automatically (tested). |
| Design system | `apps/web/src/ds` | Typed React port of the handoff's `bundle.js` (~70 components: forms, tables, charts, overlays, domain cards…). Markup/class names match the prototype so `ds/styles/components.css` (the handoff CSS, verbatim) applies unchanged. |
| App shell | `apps/web/src/app` | Router (code-split screens), `PanelLayout` (sticky collapsible sidebar + top bar), toasts, link interception, shared modals (`ChangePasswordModal`, `ShareLinkModal`), `AppearanceSettings`. |
| Screens | `apps/web/src/screens/{admin,coach}` | One file per design screen. Each keeps the prototype's controller (`state` / `setState` / `renderVals()`) on the `Screen` base class and renders design-system components. |
| Data | `apps/web/src/data` | `types.ts` (domain model); `api.ts` → `remote.ts` (HTTP calls with adapters to `types.ts`). `http.ts` (bearer token, single-flight refresh, camelCase), `session.ts` (sign-in incl. two-factor step, remember me), `realtime.ts` (chat WebSocket with reconnect), `panel.ts` (top-bar search and notifications), `hooks.ts` (`useQuery`: refetches after every mutation). Each screen is wrapped in a container that loads its data and shows a loading / error state (`app/pending.tsx`) until it arrives. |
| Lib | `apps/web/src/lib` | Route map (`routes.ts`, keys such as `coach:athlete`), `go()`/`href()`/`param()`, toast store, theme mode store, Persian number/date formatting, Jalali conversion. |

**Navigation** — screens navigate by *route key* (`go('coach:athletes')`, `href('admin:coach')`), so URLs
live in one place (`lib/routes.ts`). Athlete-app keys (`m:*`) show a toast explaining they live in the
mobile app.

**Light / Dark / System** — toggle in every top bar (animated 52×28 switch, sun → moon) and in
Coach › Settings › ظاهر (Light / Dark / System). Stored in `localStorage('theme')`, applied before first
paint by `index.html`, cross-fades over 200 ms, respects `prefers-reduced-motion`. Only neutrals change;
the brand/coach primary color is kept.

**Fonts** — Vazirmatn (UI) and IBM Plex Mono (codes/links) are self-hosted through `@fontsource` (same
files Google Fonts serves) so the app has no runtime dependency on Google.

### Data layer status

Every admin (A01–A08) and coach (C09–C33) screen reads and writes the API: dashboards, athletes and
profiles, exercise library (video and cover image upload, CSV import), programs, builder, assignment and
per-athlete copies, training history, nutrition and recovery plans, the analytics boards (overview,
strength, endurance & speed, body composition, recovery — computed server-side from logged data),
records, settings (branding, quiet hours, 2FA, tests, documents) and chat (live over the WebSocket, with
read receipts and typing). The top bar's search and notifications come from the API too, and list
exports download real CSV files. `/account` has the signed-in user's security page; `/invite/:token` and
`/reset/:token` handle the emailed links.

## Architecture (mobile — `apps/mobile`)

| Layer | Where | Notes |
| --- | --- | --- |
| Theme | `src/theme.tsx` | `ThemeProvider` / `useTheme()` → `{ c, mode, preference, setPreference }`. Colors come from `@baseline/tokens` `colors(theme, mode)`, where `theme` is the signed-in athlete's coach branding (live) or `brand`; Light/Dark/System is stored in AsyncStorage (`theme`). Vazirmatn + IBM Plex Mono via `@expo-google-fonts`. |
| UI kit | `src/ui` | React Native versions of the design-system parts the athlete screens use: `primitives` (Txt, Icon via react-native-svg, Surface, Row), `controls` (Button, IconButton, TextField, Switch, SegmentedControl, NumberStepper, ScaleInput…), `display` (Badge, ListRow, Banner, Avatar, BrandMark…), `domain` (WorkoutCard, SetRow, MealCard, MacroSummary, PRCard, VideoPlayer), `charts` (LineChart, ComparisonBar), `layout` (MobileHeader, Screen, Footer, BottomTabBar, LoginBackdrop), `overlays` (Modal, toast). |
| Navigation | `src/navigation` | React Navigation 7: signed-out stack (Login, Invite) and signed-in stack (6 bottom tabs + detail screens). Typed params in `types.ts`; deep links `baseline://…`. |
| Data | `src/data` | Tiny stores (`createStore` → `use()` hook): workout session with set logging / PR detection / rest timer, nutrition, recovery, measurements, health profile, chat, profile, session. Design mode keeps the prototype data and persists it in AsyncStorage; live mode loads it from the API (`live.ts`, `workout.ts` `loadToday`) and each action writes through (sets, finish + RPE, meals, water, check-in, measurements, health, profile photo/phone, chat). |
| API | `src/api` | `http.ts` (bearer token, refresh, Persian error messages), `tokens.ts` (Keychain/Keystore via expo-secure-store; AsyncStorage on web), `auth.ts` (sign-in as athlete, invite acceptance from `baseline://invite/<token>`, forgot password, session restore on launch, coach branding → theme), `realtime.ts` (chat WebSocket, reconnects when the app returns to the foreground), `push.ts` (Expo push token → `/api/devices/`; tapping a message notification opens the chat). |
| Screens | `src/screens` | One file per design screen (see map below). |

**RTL** — `I18nManager.forceRTL(true)` (native, needs one restart after the first install) and
`dir="rtl"` on web. Layouts keep the design's DOM order, so rows flow right-to-left like the prototype.
Charts, steppers and LTR fields (email, phone, password) opt into `direction: 'ltr'`. Strings that mix
digits with separators use `faJoin()` (RLM-wrapped `·`) so Persian digit groups never reorder.

**Try it on the web** — `pnpm --filter @baseline/mobile web` (dev) or
`pnpm --filter @baseline/mobile export:web` then serve `apps/mobile/dist-web` (the API allows
`http://localhost:8081` by default; build with `EXPO_PUBLIC_API_URL=http://localhost:8000/api` for live data).

**Push notifications are optional.** The bell on the home screen lists everything push would say (coach
messages, plan changes, check-in reminder) and chat is live over the WebSocket, so Expo Go and the web
build are fully usable. Real push needs:

- a development or store build (Expo Go no longer receives remote push);
- an EAS project id in `app.json` (`expo.extra.eas.projectId`, created by `eas init`);
- a push backend the server can reach. Expo's service is blocked from Iran; see `PUSH_BACKEND` in
  `backend/README.md`.

**Pushe instead of Expo (servers in Iran, Android).** The app has a small native module
(`apps/mobile/modules/baseline-pushe`, Pushe SDK `co.pushe.plus:base` from Maven Central) and a config
plugin (`plugins/withPushe.js`) that puts the Pushe manifest token in the Android manifest.

1. pushe.co console: add the Android app (package `app.baseline.athlete`); copy the *manifest token*,
   the *app id* and your account's *API token*.
2. Build the APK with `EXPO_PUBLIC_PUSH=pushe`, `PUSHE_MANIFEST_TOKEN=<manifest token>` and
   `EXPO_PUBLIC_API_URL=https://<your server>/api`, e.g. `npx expo prebuild -p android` then
   `cd android && ./gradlew assembleRelease` (or the EAS profile `apk-pushe` with the token as an EAS secret).
   Without `PUSHE_MANIFEST_TOKEN` the module builds as a stub and the Pushe SDK is left out.
3. Server: `PUSH_BACKEND=pushe`, `PUSHE_API_TOKEN`, `PUSHE_APP_ID`.

After sign-in the app waits for Pushe's registration and sends its device id to `/api/devices/`; the API
sends Pushe transactional notifications to those ids, and tapping one opens the chat or the session
through a `baseline://` link. Pushe needs Google Play Services on the phone.
`node tools/mobile-shots.mjs <url> <outDir> [--dark] [--only=Home,Log]` screenshots every screen at
390×844.

## Screen map — athlete app

| Screen | Component | Design file |
| --- | --- | --- |
| M34 Login (+ forgot password: a new password by email) | `LoginScreen` | `M34 Athlete Login.dc.html` |
| M35 Home | `HomeScreen` (tab) | `M35 Athlete Home.dc.html` |
| M36 Today's workout | `WorkoutScreen` (tab) | `M36 Athlete Todays Workout.dc.html` |
| M37 Exercise details / video | `ExerciseScreen` | `M37 Athlete Exercise Details.dc.html` |
| M38 Log sets (rest timer, PR detection) | `LogScreen` | `M38 Athlete Set Logging.dc.html` |
| M39 Workout complete | `CompleteScreen` | `M39 Athlete Workout Complete.dc.html` |
| M40 Nutrition | `NutritionScreen` (tab) | `M40 Athlete Nutrition.dc.html` |
| M41 Recovery check-in | `RecoveryScreen` (tab) | `M41 Athlete Recovery.dc.html` |
| M42 Measurements | `MeasureScreen` | `M42 Athlete Measurements.dc.html` |
| M43 Progress | `ProgressScreen` (tab) | `M43 Athlete Progress.dc.html` |
| M44 Personal records | `RecordsScreen` | `M44 Athlete Personal Records.dc.html` |
| M45 Profile (photo, phone, Light/Dark/System, logout) | `ProfileScreen` (tab) | `M45 Athlete Profile.dc.html` |
| M46 Health profile | `HealthScreen` | `M46 Athlete Health Profile.dc.html` |
| M47 Chat with coach | `ChatScreen` | `M47 Athlete Chat.dc.html` |
| M48 Invite onboarding (mail → accept → basics → health, expired) | `InviteScreen` | `M48 Athlete Invite.dc.html` |

## Screen map — web

| Route | Screen | Design file |
| --- | --- | --- |
| `/` | Screen index | `Index.dc.html` |
| `/admin/login` | A01 Admin login | `A01 Admin Login.dc.html` |
| `/admin` | A02 Dashboard | `A02 Admin Dashboard.dc.html` |
| `/admin/coaches` | A03 Coaches | `A03 Admin Coaches.dc.html` |
| `/admin/coaches/new` | A04 Create coach | `A04 Admin Create Coach.dc.html` |
| `/admin/coach` | A05 Coach details | `A05 Admin Coach Details.dc.html` |
| `/admin/athletes` | A06 Athletes | `A06 Admin Athletes.dc.html` |
| `/admin/branding` | A07 Branding | `A07 Admin Branding.dc.html` |
| `/admin/access` | A08 Access & roles | `A08 Admin Access.dc.html` |
| `/coach/login` | C09 Coach login | `C09 Coach Login.dc.html` |
| `/coach` | C10 Dashboard | `C10 Coach Dashboard.dc.html` |
| `/coach/athletes` | C11 Athletes | `C11 Coach Athletes.dc.html` |
| `/coach/athlete` | C12 Athlete profile | `C12 Coach Athlete Profile.dc.html` |
| `/coach/athletes/new` | C13 Add athlete | `C13 Coach Create Athlete.dc.html` |
| `/coach/library` | C14 Exercise library | `C14 Coach Exercise Library.dc.html` |
| `/coach/library/new` | C15 Create exercise | `C15 Coach Create Exercise.dc.html` |
| `/coach/exercise` | C16 Exercise details | `C16 Coach Exercise Details.dc.html` |
| `/coach/programs` | C17 Programs | `C17 Coach Programs.dc.html` |
| `/coach/programs/new` | C18 Create program | `C18 Coach Create Program.dc.html` |
| `/coach/builder` | C19 Program builder | `C19 Coach Program Builder.dc.html` |
| `/coach/program` | C20 Program template | `C20 Coach Program Template.dc.html` |
| `/coach/assign` | C21 Assign program | `C21 Coach Assign Program.dc.html` |
| `/coach/customize` | C22 Program customization | `C22 Coach Program Customization.dc.html` |
| `/coach/history` | C23 Training history | `C23 Coach Training History.dc.html` |
| `/coach/nutrition` | C24 Nutrition plan | `C24 Coach Nutrition Plan.dc.html` |
| `/coach/recovery` | C25 Recovery plan | `C25 Coach Recovery Plan.dc.html` |
| `/coach/analytics` | C26 Analytics overview | `C26 Coach Analytics Overview.dc.html` |
| `/coach/analytics/strength` | C27 Strength | `C27 Coach Strength Analytics.dc.html` |
| `/coach/analytics/endurance` | C28 Endurance & speed | `C28 Coach Endurance Speed.dc.html` |
| `/coach/analytics/body` | C29 Body composition | `C29 Coach Body Composition.dc.html` |
| `/coach/analytics/recovery` | C30 Recovery analytics | `C30 Coach Recovery Analytics.dc.html` |
| `/coach/analytics/records` | C31 Personal records | `C31 Coach Personal Records.dc.html` |
| `/coach/settings` | C32 Settings (+ ظاهر / Appearance) | `C32 Coach Settings.dc.html` |
| `/coach/chat` | C33 Chat | `C33 Coach Chat.dc.html` |

## Project rules

From the design handoff (`project/design_handoff_baseline_coaching/PROJECT_RULES.md`):

- Font: Vazirmatn for all UI text on every page; IBM Plex Mono for code/links/IDs.
- All pages Persian, RTL, theme `brand` (orange `#FF9A1F`).
- Every page is clickable and linked to the others.
- Persian digits (۰–۹) with `٫`; Jalali dates; LTR islands (`dir="ltr"`) for emails, phones, URLs,
  passwords and units. Missing data shows «ثبت نشده» — never fabricated. Health data is never shown
  to admin roles.

## Known gaps / next steps

1. **Native builds** (EAS / `expo prebuild`) aren't configured yet — run the athlete app through Expo Go
   or the web target. Push notifications need such a build (see above).
2. **Screen controllers are loosely typed.** They are ported from the prototypes' JavaScript and are
   checked by `tsconfig.screens.json` (non-strict); the design system, data layer, lib and app shell
   are strict.
3. **Responsive layouts** — the web panels are desktop-first as designed (1440px canvases); the
   tablet/mobile rules from R1–R4 are not implemented yet. The R1–R4 responsive boards and S1–S2 state
   boards are design references and aren't separate routes.
4. The prototype's inline style objects are kept for fidelity; repeated patterns (e.g. the white
   "surface" card) are good candidates for small layout components.

## Tools

- `node tools/convert-dc.mjs [C13 …]` — the one-off porter used to turn `.dc.html` templates into the
  first version of each screen. Screens have since been edited by hand; **don't re-run it over them**.
- `node tools/screenshots.mjs http://localhost:4173 <outDir> [--dark] [--only=C13,A03]` — screenshots
  every route at 1440px for comparison with `project/design_handoff_baseline_coaching/screenshots`
  (run `pnpm --filter @baseline/web build && pnpm --filter @baseline/web preview` first).
- `node tools/e2e/<name>.mjs` — browser walkthroughs against a running API (seeded demo data):
  `web-screens` (every live coach/admin screen), `web-chat` (live chat + read receipts), `web-2fa`
  (enable two-factor, sign in with a recovery code, disable), `mobile` (athlete app web export on :8081).
  They use Playwright with the preinstalled Chromium (`CHROMIUM_PATH` to override).
- `node tools/e2e/record-fixtures.mjs` — re-records `apps/web/src/test/fixtures.json` (real API responses
  the web tests replay through a fake `fetch`) from a freshly seeded backend (`seed_demo --reset`).
