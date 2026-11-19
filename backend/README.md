# indow API (Django)

REST backend for the indow platform: the **Admin** and **Coach** web panels (`apps/web`) and the
**Athlete** app (`apps/mobile`). Django 5.2 LTS + Django REST Framework, JWT auth, OpenAPI docs.

JSON is **camelCase** both ways (it matches `apps/web/src/data/types.ts`); dates are ISO strings and the
clients format them (Jalali calendar, Persian digits).

## Run it

Needs Python 3.11+.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                 # optional; every setting has a dev default
python manage.py migrate
python manage.py seed_demo           # demo data from the designs (password: baseline-demo)
python manage.py runserver           # http://localhost:8000 (HTTP + WebSocket, via daphne)
```

- API docs (Swagger UI): http://localhost:8000/api/docs/ · OpenAPI schema: `/api/schema/`
- Django admin: http://localhost:8000/django-admin/ (sign in as `sina@baseline.app`)
- Tests: `pytest` · lint: `ruff check . && ruff format --check .`

Demo accounts (password `baseline-demo`):

| Role | Email |
| --- | --- |
| Super admin | `sina@baseline.app` |
| Support admin | `support@baseline.app` |
| Coach (Ali Fitness) | `ali@alifitness.app` (also `mina@northline.app`, `arash@apex.app`, …) |
| Athlete | `ali.rostami@gmail.com` (week 4 of «عضله‌سازی ۸ هفته» after a 16-week base block) |

`seed_demo` is the single source of demo data for the web panels and the athlete app: six coach
workspaces (active, expiring, expired, draft, invited), the Ali Fitness library and programs, and
athletes with months of history — workouts and PRs, cardio sessions, nutrition plans and meal logs,
recovery plans and 45 days of check-ins, biweekly body measurements, field tests in every category and
chat threads. `python manage.py seed_demo --reset` starts over.

SQLite is the default. For PostgreSQL set `DATABASE_URL=postgres://user:pass@host:5432/db`. In
production set `DJANGO_DEBUG=false`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`FRONTEND_URL` and SMTP (`EMAIL_HOST`, …; without it emails print to the console), and run
`python manage.py daily_jobs` once a day (cron). Serve it with an ASGI server so the chat WebSocket works,
e.g. `daphne -b 0.0.0.0 -p 8000 config.asgi:application`, and set `REDIS_URL` when running more than one
process. `.env.example` lists every setting (S3, Redis, Expo push, HTTPS).

### Email

Without `EMAIL_HOST` nothing is delivered: every email (invites, new passwords, reset links) is only printed in the
`runserver` terminal. To really send, e.g. with Gmail (needs 2-step verification and an
[app password](https://myaccount.google.com/apppasswords)), put this in `backend/.env`:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=abcd efgh ijkl mnop
```

The sender then defaults to that address. Check it with `python manage.py send_test_email you@gmail.com`.
When the SMTP server refuses or can't be reached, the request fails with 502 `email_failed` (and whatever it
was creating is rolled back) instead of pretending the email went out; the error is logged.

## Auth

`POST /api/auth/login/` `{email, password, role?}` → `{access, refresh, user}`. Send
`Authorization: Bearer <access>`; refresh with `POST /api/auth/refresh/` `{refresh}` (rotating).
`role` makes a panel refuse other accounts (e.g. an athlete on `/coach/login` → 403 `wrong_role`).

- Access tokens last 15 min, refresh tokens 7 days (env `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`).
- **Ending sessions**: every token carries the user's session epoch. Password changes (own, admin or
  reset link), deactivation and `logout {all: true}` bump it, so every older token stops working at once.
- A coach whose account expired or was deactivated, and athletes who are inactive or paused, are refused
  on the next request. The error `code` says why.
- **Links**: invites last 7 days and resets 24 hours, and each works once. Only a SHA-256 hash of the token
  is stored. Issuing a new link revokes the old ones. Admins and coaches can get a link back to copy
  (`send: false`) instead of emailing it, and every copy is audit-logged.
- **Forgot password** (`auth/forgot-password` `{email}`, always 204): a new random 10-character password of
  letters and digits (e.g. `Hq7mR2xkTa`) is emailed; the old one stops working and every session ends.
  Everyone must choose their own password after signing in (`forcePasswordChange`: the web panels open
  the account page, the athlete app its password screen). If the email can't be sent the old password stays and the request fails with `email_failed`.
- Auth endpoints are rate-limited (20/min per IP).
- `auth/logout` `{refresh}` needs no access token: holding the refresh token is enough to revoke it.
- **Admin session timeout**: admins' refresh tokens stop working `session_timeout_minutes` (A08) after
  sign-in (`session_timeout`), however often they are refreshed.

### Two-factor sign-in (TOTP)

Admins and coaches can turn on authenticator-app codes (RFC 6238, 30 s, ±1 step, a code can't be reused).

1. `GET auth/2fa/` → status · `POST auth/2fa/setup/` → `{secret, otpauthUrl}` (show as a QR code)
2. `POST auth/2fa/enable/` `{otp}` → `{recoveryCodes}` (10 single-use codes, shown once, stored hashed)
3. Sign-in: `auth/login` answers `{mfaRequired: true, mfaToken}` instead of tokens; then
   `POST auth/2fa/verify/` `{mfaToken, otp}` (a 6-digit code or a recovery code) → `{access, refresh, user}`.
   The `mfaToken` is signed and lasts 5 minutes.
4. `POST auth/2fa/recovery-codes/` `{otp}` → new codes · `POST auth/2fa/disable/` `{password, otp}`
5. Admins can reset another user's 2FA: `POST admin/users/{id}/2fa-reset/`.

A08 settings `requireAdmin2fa` / `requireCoach2fa` make it mandatory: until enrolled, such users can only
call `auth/*` (other requests → 403 `mfa_setup_required`; `auth/me` has `mfaSetupRequired`), and they
can't disable it.

### Realtime chat and push

- **WebSocket** `ws://<host>/ws/`: send `{"type": "auth", "token": "<access>"}` first, then receive
  `message`, `read` and `typing` events (the protocol is documented in `messaging/consumers.py`). Ending a
  user's sessions closes their sockets (code 4003). Channels uses Redis when `REDIS_URL` is set, otherwise
  an in-memory layer (single process only). `messages?after=` polling still works as a fallback.
- **Voice messages**: `POST messages/` (multipart) with the recording as `attachment` (.m4a from the
  app, .webm / .m4a from browsers; .mp3, .ogg, .wav also accepted) and its length as `voiceSec` (up to
  300 s). Messages carry `voiceSec`; notifications and the inbox show «🎤 پیام صوتی ۰:۱۲». The coach
  panel records with the browser's MediaRecorder, which needs https (or localhost) and microphone access.
- **Push is optional.** Everything push would say is also in the athlete's in-app list
  (`GET notifications/`): unread coach messages, program / nutrition / recovery-plan changes and today's
  check-in reminder; `POST notifications/read/` marks them seen. Chat is live over the WebSocket anyway.
- **Push delivery** (`PUSH_BACKEND`, `messaging/push.py`):
  - The app registers its token with `POST devices/` `{token, platform}` and removes it with
    `DELETE devices/` on sign-out.
  - A coach's message is pushed after the transaction commits, off the request thread, unless the coach
    is inside their quiet hours.
  - Backends:
    - `log` (development default) prints the notification.
    - `expo` (production default) uses Expo's push service and deletes tokens Expo reports as
      `DeviceNotRegistered`. Expo refuses requests from sanctioned regions, Iran included.
    - `webhook` POSTs `{tokens, title, body, data}` to `PUSH_WEBHOOK_URL`, HMAC-signed with
      `PUSH_WEBHOOK_SECRET`, for a relay abroad or a local push service. The relay may answer
      `{"invalid": [...]}` to remove dead tokens.
    - `off` sends nothing.
  - `python manage.py send_test_push <email>` shows the setup and sends a test notification.
- **A phone in development**: run `python manage.py runserver 0.0.0.0:8000` and start the app with
  `EXPO_PUBLIC_API_URL=http://<your LAN IP>:8000/api`. With `DJANGO_DEBUG=true` any host is accepted
  (`DJANGO_ALLOWED_HOSTS` matters only in production).

### Uploads

Photos, logos, exercise videos, coach documents and chat attachments go to the local `media/` folder by
default. Set `S3_BUCKET` (+ `S3_ENDPOINT_URL`, keys, region) to store them in any S3-compatible bucket
(AWS S3, Cloudflare R2, ArvanCloud, MinIO). Objects are private and served as signed URLs
(`S3_URL_EXPIRE_SECONDS`) unless `S3_PUBLIC=true` / `S3_CUSTOM_DOMAIN` (CDN). File type and size are
checked before upload (`core/uploads.py`).

Errors keep DRF's field messages and add a top-level `code` (`invalid_credentials`, `wrong_role`,
`coach_inactive`, `session_ended`, `session_timeout`, `mfa_setup_required`, `invalid_code`, `mfa_token_expired`, `invite_expired`,
`cap_reached`, `conflict`, …).

## Roles & data access

| | Admin | Coach | Athlete |
| --- | --- | --- | --- |
| Coach workspaces, branding, validity | ✔ (matrix) | own profile | — |
| Athlete accounts | ✔ all (matrix) | own athletes | self |
| Health profile | **never** | own athletes (audit-logged) | self |
| Programs, logs, nutrition, recovery, measurements, chat | **never** | own athletes | self |

Admin rights come from the editable **permission matrix** in A08 (`/api/admin/settings/`). Its keys are
`cm` (coaches), `br` (branding), `ath` (athlete accounts), `rep` (stats), `audit` (audit log) and `adm`
(admin users), each set separately for super and support admins. Querysets are scoped per role, so
another coach's athlete returns 404.

## Endpoints

| Area | Endpoints |
| --- | --- |
| Auth | `auth/login` · `auth/refresh` · `auth/logout` · `auth/me` (GET/PATCH: name, phone `09…`, photo, theme) · `auth/password` · `auth/forgot-password` · `auth/reset-password` · `auth/invites/{token}` (GET info / POST accept) · `auth/2fa` (+ `setup`, `enable`, `disable`, `recovery-codes`, `verify`) |
| Admin | `coaches` (list/create/patch, `?status=active\|inactive\|expiring…`) · `coaches/{id}/extend` · `…/status` · `…/invite` · `admin/users/{userId}/password` · `…/reset-link` · `admin/admins` · `admin/settings` · `admin/audit-events` · `admin/stats` · `admin/users/{userId}/2fa-reset` |
| Coach | `coach/profile` · `coach/dashboard` · `athletes` (+ `bulk-status`, `{id}/invite`, `{id}/health`, `{id}/transfer` for admins) · `tests` · `exercises` · `programs` (+ `{id}/assign`, `{id}/duplicate`, `{id}/copies`, `{id}/push-update`) · `workouts` (+ `{id}/feedback`) · `records` · `nutrition-plans/{athleteId}` · `foods?q=` (food bank; POST adds the coach's own food) · `athletes/{id}/program.pdf` · `athletes/{id}/program-pdf/send` · `test-results` · `coach/threads` · `coach/documents` · `coach/renewal-request` · `athletes/{id}/overview` · `…/calendar` · `…/notes` · `…/analytics?section=overview\|strength\|endurance\|body\|recovery` · `recovery-plans/{athleteId}` · `exercises/{id}/programs` |
| Both panels | `search?q=` (top-bar search) · `notifications` (+ `read`) |
| Athlete | `me/athlete` · `me/health` · `me/today` · `workouts/start` · `sets/{id}` (PATCH) · `workouts/{id}/finish` · `me/nutrition?date=` · `meal-logs` · `me/water` · `nutrition-plans/me` · `recovery-plans/me` · `me/program.pdf` · `me/program-link` (10-minute signed link) · `recovery` · `measurements` (+ `batch`, `latest`) · `records` · `test-results` · `me/progress?days=` · `messages` (+ `read`, `?after=` polling) · `devices` (push) |

The full request and response shapes are in `/api/docs/`. Lists are paginated as
`{count, next, previous, results}` (`?page=`, `?page_size=`), and most lists accept `athlete`, `from`,
`to`, `search` and `ordering`.

## Domain notes

- **Programs**: the builder tree (weeks → days → exercises → sets) is stored whole as validated JSON and
  saved whole, which is how the builder works. Assigning a program copies it for each athlete, so later
  template edits never reach an athlete's copy. Editing an athlete's copy marks it `customized`. Saving a
  template bumps its `version`. The week is Saturday-first, and Friday is a training day.
- **Set logging**: starting a session prefills every prescribed set as a target. Ticking a set means it
  was done as prescribed. `actualReps`/`actualValue` are stored only when they differ from the target.
- **PRs**: a done kg set is a PR when its load beats the best earlier load for at least as many reps; it is
  stored as e.g. `8RM` together with the previous best. The first log of an exercise sets the baseline.
  Undoing the set removes the PR. Coaches can also record PRs by hand.
- **Nutrition**: foods are stored as per-100 g values × grams, and totals are computed. Eaten totals
  count followed meals at 100 %, partial at 50 % and skipped at 0. Editing a plan keeps meal ids, so the
  logs stay valid. Each meal has `days` (weekday codes; empty = every day), so every day of the week can
  have its own menu; `me/nutrition?date=` returns that weekday's meals and the plan has `dayTotals`.
  A food can come from the **food bank** (`food` + `unit` + `quantity`, e.g. 3 × «عدد» egg white): the server
  sets `grams = quantity × unit grams` and copies the per-100 g values, so totals work as before. The shared
  bank (`tracking/data/foods_fa.json`) is loaded by a migration; coaches' own foods are private to them.
  `supplements` is a list of `{name, dose, timing}`.
- **Program PDF** (`core/pdf`, WeasyPrint + bundled Vazirmatn): this week's sessions of every active
  program, each distinct daily menu with household units, supplements and recovery, in the coach's colour
  and logo. Sending it adds a coach chat message with the PDF attached. The image needs pango (Dockerfile).
- **Recovery check-in**: the coach picks the questions (`checks`), optional sports-watch numbers (resting
  HR, HRV, sleep score, Body Battery, SpO₂, steps) and up to 12 own questions (`customFields`: scale,
  number, yes/no or text). Answers to custom questions are stored in `extra`.
- **Analytics** (C26–C30, `athletes/{id}/analytics`): adherence per period (training from logged
  sessions, nutrition from meal logs, recovery from check-ins), estimated 1RM (Epley, best set per
  session/month) of the most-trained lifts, tested 1RM records, weekly tonnage, volume per muscle group,
  field-test series, cardio sessions, resting heart rate, body measurements and check-ins. Only logged
  data is used; gaps stay empty.
  - `section=trends` (also `trends` in `me/progress`): dated points the charts group by day, week or
    month. `volume` is strength volume in kg (weight × reps of done sets, in-progress sessions
    included) per muscle group (`groups`, biggest first), done sets per day, and the last 7 days
    against the 7 before (`last7`, `prev7`).
  - `section=performance`, modelled on Garmin, Strava and TrainingPeaks:
    - Fitness / fatigue / form: session load = minutes × RPE (Foster) ÷ 10; fitness is a 42-day
      exponentially weighted load, fatigue a 7-day one, and form is yesterday's fitness − fatigue.
    - Training status: productive, maintaining, recovery, detraining or overreaching.
    - Training readiness (0–100): HRV and resting HR against the athlete's 7-day baseline, sleep against
      the target, soreness, fatigue, stress, Body Battery and form. Each factor counts only when logged.
    - A 12-week consistency calendar with a weekly-goal streak.
    - A board of every test the coach designed: latest, best, change and trend.
  - Running (`section=endurance`):
    - Weekly distance and pace.
    - Best efforts at 1 km, 5 km, 10 km and half marathon.
    - VO₂max (Daniels VDOT) and race predictions (Riegel).
    - Acute:chronic load ratio.
    - HR zones (Tanaka HRmax unless the coach sets one) and load focus.
    - Cadence and stride.
  - Strength: estimated 1RM relative to body weight, and days since each lift was last trained.
- **Field tests**: coaches design their own tests (any category, any unit, which direction is better,
  and a `protocol` shown when the result is logged).
- **Exercise library**: `install_exercise_library` (also run for every new coach) adds the standard
  exercises. Pictures come from two sources:
  - Photos from free-exercise-db (Unlicense), bundled with the app.
  - Flat illustrations from [RepDB](https://repdb.co), downloaded once at install time into
    `media/library/illustrations/`. They are not shipped in the repo because RepDB's terms don't allow
    redistributing the dataset.

  The server needs access to `raw.githubusercontent.com`; offline, the bundled photos stay. Turn this off
  with `EXERCISE_ILLUSTRATIONS=false`. The attribution «Exercise data by RepDB (repdb.co)» is shown in
  the coach library. A coach's own picture or video always wins over the library picture.
- **Notifications** are derived from recent activity (no separate table): coaches see new records, high
  soreness, unread athlete messages and athlete-recorded measurements; admins see pending invites,
  coaches near their cap, expiring accounts and renewal requests. `notifications/read` marks everything
  up to now as read.
- **Stats** (`athlete.stats`, dashboard): adherence, strength change and the attention flag are
  computed from logged data only; when there is nothing to compute from, the value is `null`.
- **Coach validity**: it starts when the coach accepts the invite. Extending adds days to the later of
  today and the end date. An expired account is inactive immediately, and `daily_jobs` makes that
  permanent, emails the N-days reminder, and closes unfinished or missed sessions.

## Layout

```
config/      settings (env-driven), urls
core/        permissions & row scoping, audit log, platform settings (permission matrix), uploads,
             management commands (seed_demo, daily_jobs)
accounts/    User (email login, role, session epoch), invites, reset tokens, auth & admin-user views
coaching/    Coach workspace, Athlete, HealthProfile, TestDefinition, derived stats
training/    Exercise, Program, WorkoutLog, LoggedSet, PersonalRecord; today/start/log/finish
tracking/    NutritionPlan/Meal/FoodItem, MealLog, WaterLog, RecoveryCheckIn, Measurement, TestResult
messaging/   coach ↔ athlete chat, WebSocket consumer (Channels), Expo push, devices
tests/       pytest suite (auth, 2FA, admin, coach, athlete, uploads/S3 via moto, realtime, push, commands)
```

## Not done yet

- Push is sent for coach → athlete chat messages only; workout reminders and other notification types
  are not scheduled yet.
- Two-factor sign-in covers admins and coaches (the design has no athlete 2FA).
