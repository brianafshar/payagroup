# indow — Logo Package v2 · Varsity «i»

All logo files are **pure vector outlines** (no fonts, no strokes). PNGs are transparent unless noted.

## The idea
A gym-floor, sportswear identity. The «i» of indow is a heavy **slab varsity letter** — like a jersey numeral — with the
brand's orange dot on top, and **three speed stripes** trailing behind it. The whole wordmark leans forward ~12°:
momentum, progress, the next rep.
The «i» with its stripes is both the first letter of the wordmark *and* the stand-alone symbol, so the logo never
reads «i indow».
Letters: custom drawn (stroke 32 on a 100-unit x-height), not a stock font.

## Components
| # | Component | Folder | Use |
|---|---|---|---|
| 1 | **Primary** — stripes + wordmark | `01-primary/` | Website & panel header, documents, invoices, email signature, video end frames |
| 2 | **Secondary** — stacked (app icon over wordmark) and wordmark only | `02-secondary/` | Square/vertical spaces, splash screens, merch; the plain wordmark for tight horizontal spots or where the stripes would crowd other graphics |
| 3 | **Submark** — circular badge | `03-submark/` | Stickers, stamps on programs/PDFs, merch, photo watermark |
| 4 | **Symbol, app icon, favicon** | `04-favicon/` | Browser tab, PWA, iOS/Android, store listing, avatars |
| 5 | **Brand elements** | `05-brand-elements/` | indow.ir lockup, speed-stripe device, patterns, Persian lockup, tagline lockup, palette, Instagram avatars, reel watermark, 1080×1920 end card |

## Colourways (every logo comes in all five)
| Suffix | Looks like | Put it on |
|---|---|---|
| `-color` | ink letters, orange dot | white / light backgrounds |
| `-reversed` | white letters, orange dot | ink / dark backgrounds (brand default) |
| `-black` | one colour ink | light backgrounds, one-colour print, on orange |
| `-white` | one colour white | photos, dark backgrounds |
| `-orange` | one colour orange | ink backgrounds — merch, signage |

App icon: **orange tile** (ink «i», white dot) is the default; an **ink tile** (white «i», orange dot) is included as the alternative.

## Colours
| Name | HEX | RGB | CMYK | Pantone (nearest*) |
|---|---|---|---|---|
| Indow Orange | `#FF9A1F` | 255 154 31 | 0 40 88 0 | 1375 C |
| Ink | `#0A0A0A` | 10 10 10 | 60 40 40 100 (rich black) | Black 6 C |
| White | `#FFFFFF` | 255 255 255 | 0 0 0 0 | — |
| Surface | `#141414` | 20 20 20 | 0 0 0 92 | — |
| Muted | `#A3A3A3` | 163 163 163 | 0 0 0 36 | Cool Gray 6 C |

\*Closest visual match, not an official conversion — check against a physical swatch book before printing.
Orange is an accent: never set body text in orange on white (2.1:1). Orange on Ink is 9.3:1.

## Sizes
| Asset | Native size / exports | Minimum size |
|---|---|---|
| Primary | 701 × 155 · PNG 600 / 1200 / 2400 w | 100 px wide · 25 mm |
| Secondary stacked | 639 × 455 · PNG 600 / 1200 / 2400 w | 72 px wide · 20 mm |
| Wordmark | 639 × 155 · PNG 600 / 1200 / 2400 w | 70 px wide · 18 mm |
| Submark | 400 × 400 · PNG 256 / 512 / 1024 | 56 px · 18 mm |
| Symbol (free) | 137 × 146 · PNG 256 / 512 / 1024 | 24 px |
| App icon | 120 × 120 · PNG 64–1024, orange and ink | 16 px (favicon files) |
| favicon.ico | 16 (pixel-drawn, stripes dropped), 32, 48 | — |
| apple-touch-icon.png | 180 × 180 full bleed | — |
| android-chrome | 192, 512 · maskable 512 (glyph in 80 % safe zone) | — |
| app-icon-1024.png | 1024 × 1024, no transparency | — |
| Instagram avatar | 1080 × 1080, orange and ink | — |
| Reel end card | 1080 × 1920 | — |

## Clear space
Keep empty space on every side equal to **the height of the orange dot**. Nothing — text, edges, other logos — inside it.

## Don't
- stretch, re-slant (upright or extra italic), or re-space the letters
- separate the stripes from the «i», or put them on the right
- recolour outside the five colourways; never make the stripes orange inside the logo
- add shadows, glows, outlines or gradients
- put the full-colour logo on busy photos — use `-white` or `-black`
- retype the wordmark in a font

## Website setup
Copy everything in `04-favicon/` to the site root and paste `head-snippet.html` into `<head>`.

## Persian name
`indow-lockup-fa-*` uses «ایندو» in Vazirmatn Black — confirm this spelling.

## Fonts
Everything that isn't the logo: **Vazirmatn** (Vazirmatn FD for Persian digits). Headlines 800–900, body 400–500.

## Where it is used in this project (keep up to date when pages are added)
The indow logo marks the **platform**; a coach's own panel, athlete app header and PDFs stay white-label
(the coach's name, logo and colour). Add the logo to every new platform-level page.

| Place | File / component | Asset |
|---|---|---|
| Web favicon, PWA manifest, theme colour | `apps/web/index.html`, `apps/web/public/*` | `04-favicon/*` |
| Coach login, admin login | `CoachLogin.tsx`, `AdminLogin.tsx` | `<IndowLogo>` (primary, colour/reversed by light/dark mode) |
| Invite, reset password, help & privacy pages | `AuthShell` in `apps/web/src/app/auth.tsx` | `<IndowLogo>` |
| Admin panel sidebar | `Sidebar` (`app="admin"`) in `ds/navigation.tsx` | `public/brand/indow-app-icon-orange.svg` |
| Athlete app icon, Android adaptive icon, splash | `apps/mobile/app.json`, `apps/mobile/assets/*` | app-icon-1024, ink symbol on orange, stacked reversed |
| Athlete PWA icons | `apps/mobile/public/icons/*` | `04-favicon/*` |
| Athlete app login («ساخته‌شده با indow») | `LoginScreen.tsx` | `assets/brand/wordmark-reversed.png` |
| Program PDF footer | `backend/core/templates/pdf/program.html` | `backend/core/pdf/indow-wordmark.svg` |

Web components: `IndowLogo` (`apps/web/src/ds/identity.tsx`) with `kind` primary · symbol · wordmark and
`tone` auto · color · reversed; the SVGs it reads are copied to `apps/web/public/brand/`.
