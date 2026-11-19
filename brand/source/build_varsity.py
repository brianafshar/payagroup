"""Builds the full indow logo package around the Varsity «i»."""
import os, sys, json, math, shutil
sys.path.insert(0, os.path.dirname(__file__))
from varsity import *
from geom import _font, draw_glyph, text_path, text_width, shape
import build
from build import svg_doc, to_doc, place, write_ico, png, png_from_string, write
import cairosvg
from PIL import Image

OUT = "/home/claude/indow-brand-varsity"
build.OUT = OUT
GRAY = "#A3A3A3"
COLORWAYS = ["color", "reversed", "black", "white", "orange"]
CW_DESC = {"color": "full colour, for light backgrounds", "reversed": "full colour, for dark backgrounds",
           "black": "one colour black", "white": "one colour white", "orange": "one colour orange"}
MONO = {"black": INK, "white": WHITE, "orange": ORANGE}


def paint(parts, cw):
    if cw == "color":
        return [(parts["main"], INK), (parts["accent"], ORANGE)]
    if cw == "reversed":
        return [(parts["main"], WHITE), (parts["accent"], ORANGE)]
    return [(union(parts["main"], parts["accent"]), MONO[cw])]


def fit_in(parts, box, cx=60, cy=60, optical_dx=0):
    x0, y0, x1, y1 = bounds(parts["main"], parts["accent"])
    s = box / max(x1 - x0, y1 - y0)
    dx, dy = cx - (x0 + x1) / 2 * s + optical_dx, cy - (y0 + y1) / 2 * s
    return {k: move(v, dx, dy, s) for k, v in parts.items()}


# ---------- symbol tile (app icon) ----------
TILE_R = 28


def tile_parts(full_bleed=False, scale_box=82):
    m = fit_in(mark_parts(), scale_box, optical_dx=2)
    t = rect(0, 0, 120, 120) if full_bleed else rrect(0, 0, 120, 120, TILE_R)
    return t, m


def tile_layers(cw, full_bleed=False, scale_box=82, px16=False):
    t, m = tile_parts(full_bleed, scale_box)
    if px16:
        m = mark_parts_px16()
        if cw == "color":       # white dot on orange is too faint at 16 px: go all ink
            return [(t, ORANGE), (union(m["main"], m["accent"]), INK)]
    if cw in ("color", "orange-tile"):      # orange tile, ink mark, white dot  (default app icon)
        return [(t, ORANGE), (m["main"], INK), (m["accent"], WHITE)]
    if cw in ("reversed", "ink-tile"):      # ink tile, white mark, orange dot
        return [(t, INK), (m["main"], WHITE), (m["accent"], ORANGE)]
    return [(diff(t, m["main"], m["accent"]), MONO[cw])]


# ---------- 1. primary ----------
def primary(cw):
    return paint(wordmark_parts(stripes=True), cw)


# ---------- 2. secondary ----------
def stacked(cw):
    wm = wordmark_parts(stripes=False)
    x0, y0, x1, y1 = bounds(wm["main"], wm["accent"])
    size = 230
    s = size / 120
    tl = tile_layers("color" if cw in ("color", "reversed") else cw)
    tx = (x0 + x1) / 2 - size / 2
    tile = [(move(p, tx, y0 - 70 - size, s), f) for p, f in tl]
    return tile + paint(wm, cw)


def wordmark_only(cw):
    return paint(wordmark_parts(stripes=False), cw)


# ---------- 3. submark: leaning ring text ----------
SLANT = 0.21


def ring_text_lean(text, size, cx, cy, r, center_deg, weight="Black", tracking=0.12, bottom=False):
    tt, gs, _, _ = _font(weight)
    glyphs, total, upem = shape(text, weight, tracking)
    s = size / upem
    out = P()
    for name, gx, ox, oy, adv in glyphs:
        gc = gx + ox + gs[name].width / 2
        t = gc * s - total * s / 2
        if not bottom:
            theta = math.radians(center_deg) + t / r
            phi = theta
        else:
            theta = math.radians(center_deg) - t / r
            phi = theta - math.pi
        px, py = cx + r * math.sin(theta), cy - r * math.cos(theta)
        c, sn = math.cos(phi), math.sin(phi)
        lc = ox + gs[name].width / 2
        a, b, cc, d = c * s, sn * s, sn * s, -c * s
        cc, d = cc + a * SLANT, d + b * SLANT          # italic shear in glyph space
        draw_glyph(gs, name, TransformPen(out.getPen(), (a, b, cc, d, px - a * lc, py - b * lc)))
    return union(out, P())


def submark_parts():
    cx = cy = 200
    disc = circle(cx, cy, 200)
    ring = annulus(cx, cy, 142, 135)
    top = ring_text_lean("COACH, DON'T ARCHIVE", 30, cx, cy, 157, 0)
    bottom = ring_text_lean("INDOW.IR", 30, cx, cy, 157 + 30 * 0.72, 180, bottom=True, tracking=0.3)
    stars = union(*[rrect(cx + sx * 168 - 9, cy - 4, 18, 8, 4) for sx in (-1, 1)])
    m = fit_in(mark_parts(), 170, cx, cy, optical_dx=6)
    return disc, union(ring, top, bottom, stars), m


def submark(cw):
    disc, det, m = submark_parts()
    if cw == "color":
        return [(disc, ORANGE), (det, INK), (m["main"], INK), (m["accent"], WHITE)]
    if cw == "reversed":
        return [(disc, INK), (det, WHITE), (m["main"], WHITE), (m["accent"], ORANGE)]
    return [(diff(disc, det, m["main"], m["accent"]), MONO[cw])]


# ---------- build ----------
def emit(folder, stem, layers_fn, title, desc, widths):
    for cw in COLORWAYS:
        doc, w, h = to_doc(layers_fn(cw), title, f"{desc} — {CW_DESC[cw]}")
        p = write(f"{folder}/svg/{stem}-{cw}.svg", doc)
        for W_ in widths:
            png(p, f"{folder}/png/{stem}-{cw}-{W_}w.png", width=W_)


def build_logos():
    emit("01-primary", "indow-primary", primary, "indow logo",
         "The indow wordmark in forward-leaning athletic letters, led by speed stripes; the «i» is a slab varsity letter with an orange dot", [600, 1200, 2400])
    emit("02-secondary", "indow-secondary-stacked", stacked, "indow logo, stacked",
         "The indow app icon (speed stripes and slab «i») centred above the wordmark", [600, 1200, 2400])
    emit("02-secondary", "indow-wordmark", wordmark_only, "indow wordmark",
         "The indow wordmark without speed stripes", [600, 1200, 2400])
    emit("03-submark", "indow-submark", submark, "indow submark",
         "Circular badge: the varsity «i» symbol inside a ring reading COACH, DON'T ARCHIVE and INDOW.IR", [256, 512, 1024])
    # symbol, free-standing
    emit("04-favicon", "indow-symbol", lambda cw: paint(mark_parts(), cw), "indow symbol",
         "Speed stripes and a slab «i» with an orange dot", [256, 512, 1024])
    for cw in ("color", "reversed", "black", "white", "orange"):
        name = {"color": "orange", "reversed": "ink"}.get(cw, cw + "-knockout")
        doc = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers(cw)], "indow app icon", f"indow app icon — {name} tile")
        write(f"04-favicon/svg/indow-app-icon-{name}.svg", doc)


def build_favicons():
    std = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers("color")], "indow", "indow favicon")
    small = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers("color", px16=True)], "indow", "indow favicon 16")
    bleed = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers("color", full_bleed=True, scale_box=78)], "indow", "indow app icon")
    mask = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers("color", full_bleed=True, scale_box=64)], "indow", "indow maskable icon")
    write("04-favicon/favicon.svg", std)
    files = {}
    for size, src in [(16, small), (32, std), (48, std)]:
        files[size] = png_from_string(src, f"04-favicon/favicon-{size}x{size}.png", size, size)
    write_ico([(s, open(files[s], "rb").read()) for s in (16, 32, 48)], os.path.join(OUT, "04-favicon/favicon.ico"))
    png_from_string(bleed, "04-favicon/apple-touch-icon.png", 180, 180)
    png_from_string(std, "04-favicon/android-chrome-192x192.png", 192, 192)
    png_from_string(std, "04-favicon/android-chrome-512x512.png", 512, 512)
    png_from_string(mask, "04-favicon/maskable-icon-512x512.png", 512, 512)
    p = png_from_string(bleed, "04-favicon/app-icon-1024.png", 1024, 1024)
    Image.open(p).convert("RGB").save(p)
    ink = svg_doc(120, 120, [(d_of(p), f) for p, f in tile_layers("reversed")], "indow", "indow app icon ink")
    for s in (64, 128, 256, 512, 1024):
        png_from_string(std, f"04-favicon/png/indow-app-icon-orange-{s}.png", s, s)
        png_from_string(ink, f"04-favicon/png/indow-app-icon-ink-{s}.png", s, s)
    manifest = {"name": "indow", "short_name": "indow",
                "icons": [{"src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
                          {"src": "/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
                "theme_color": "#0A0A0A", "background_color": "#0A0A0A", "display": "standalone"}
    write("04-favicon/site.webmanifest", json.dumps(manifest, indent=2) + "\n")
    write("04-favicon/head-snippet.html", """<!-- indow favicons: copy the files in this folder to your site root -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0A0A0A">
""")


TAGLINE = "مربی‌گری کن، نه بایگانی."
NAME_FA = "ایندو"


def build_elements():
    E = "05-brand-elements"
    # indow.ir domain lockup
    emit(E, "indow-url", lambda cw: paint(url_parts(), cw), "indow.ir", "indow.ir in the brand letters", [1200])
    # speed-stripe device
    stripes = lean(g_stripes())
    for cw, col in (("orange", ORANGE), ("white", WHITE), ("black", INK)):
        doc, w, h = to_doc([(stripes, col)], "indow speed stripes", f"Brand device: three speed stripes, {cw}")
        write(f"{E}/indow-speed-stripes-{cw}.svg", doc)
    # Persian lockup: name (upright, RTL) with the app icon on its right
    for cw in ("reversed", "color"):
        fa = text_path(NAME_FA, 190, 0, 100, "Black")
        x0, y0, x1, y1 = fa.bounds
        tl = [(move(p, x1 + 44, -60, 160 / 120), f) for p, f in tile_layers("color")]
        doc, w, h = to_doc([(fa, WHITE if cw == "reversed" else INK)] + tl, "ایندو", f"Persian lockup — {CW_DESC[cw]}")
        p = write(f"{E}/indow-lockup-fa-{cw}.svg", doc)
        png(p, f"{E}/png/indow-lockup-fa-{cw}-1200w.png", width=1200)
    # tagline lockup
    for cw in ("reversed", "color"):
        pl = primary(cw)
        x0, y0, x1, y1 = bounds(*[p for p, _ in pl])
        tag = text_path(TAGLINE, 66, x1, y1 + 120, "Bold", anchor="end")
        doc, w, h = to_doc(pl + [(tag, GRAY if cw == "reversed" else "#525252")], "indow — مربی‌گری کن، نه بایگانی", f"Logo with tagline — {CW_DESC[cw]}")
        p = write(f"{E}/indow-tagline-{cw}.svg", doc)
        png(p, f"{E}/png/indow-tagline-{cw}-1200w.png", width=1200)
    # seamless pattern: rows of speed stripes + dots, half-drop
    T = 240
    st = lean(g_stripes())
    sx0, sy0, sx1, sy1 = st.bounds
    st0 = move(st, -(sx0 + sx1) / 2, -(sy0 + sy1) / 2)
    dot0 = lean(g_i_dot())
    dx0, dy0, dx1, dy1 = dot0.bounds
    dot0 = move(dot0, -(dx0 + dx1) / 2, -(dy0 + dy1) / 2)
    for name, bg, fg, ac in (("orange", ORANGE, INK, WHITE), ("dark", INK, "#1C1C1C", "#1C1C1C"), ("dark-orange", INK, "#2A2A2A", ORANGE)):
        sh = union(move(st0, 70, 60, 0.5), move(st0, 190, 180, 0.5))
        dt = union(move(dot0, 180, 58, 0.55), move(dot0, 60, 178, 0.55))
        tile = svg_doc(T, T, [(d_of(sh), fg), (d_of(dt), ac)], "indow pattern tile", f"Seamless {name} pattern tile", bg=bg)
        write(f"{E}/pattern-{name}-tile.svg", tile)
        prev = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080"><defs>'
                f'<pattern id="p" width="{T}" height="{T}" patternUnits="userSpaceOnUse"><rect width="{T}" height="{T}" fill="{bg}"/>'
                f'<path fill="{fg}" d="{d_of(sh)}"/><path fill="{ac}" d="{d_of(dt)}"/></pattern></defs><rect width="1080" height="1080" fill="url(#p)"/></svg>')
        png_from_string(prev, f"{E}/png/pattern-{name}-1080.png", 1080, 1080)
    # palette (same colours as before)
    shutil.copy("/home/claude/indow-brand/05-brand-elements/indow-palette.svg", f"{OUT}/{E}/indow-palette.svg")
    png(f"{OUT}/{E}/indow-palette.svg", f"{E}/png/indow-palette.png", width=1500)
    # social
    m = fit_in(mark_parts(), 560, 540, 540, optical_dx=20)
    av = svg_doc(1080, 1080, [(d_of(m["main"]), INK), (d_of(m["accent"]), WHITE)], "indow avatar", "Instagram profile picture", bg=ORANGE)
    png(write(f"{E}/social/indow-avatar-1080.svg", av), f"{E}/social/indow-avatar-1080.png", width=1080)
    av2 = svg_doc(1080, 1080, [(d_of(m["main"]), WHITE), (d_of(m["accent"]), ORANGE)], "indow avatar", "Instagram profile picture, dark", bg=INK)
    png(write(f"{E}/social/indow-avatar-dark-1080.svg", av2), f"{E}/social/indow-avatar-dark-1080.png", width=1080)
    u = url_parts()
    wm = [(union(u["main"], u["accent"]), WHITE)]
    doc, w, h = to_doc(wm, "indow watermark", "White indow.ir watermark for reels and photos (85% opacity)")
    doc = doc.replace("<path ", '<path fill-opacity="0.85" ')
    png(write(f"{E}/social/indow-watermark-white.svg", doc), f"{E}/social/indow-watermark-white-600w.png", width=600)
    pl = wordmark_parts(stripes=True)
    x0, y0, x1, y1 = bounds(pl["main"], pl["accent"])
    sc = 820 / (x1 - x0)
    pm = {k: move(v, 540 - (x0 + x1) / 2 * sc, 820 - y0 * sc, sc) for k, v in pl.items()}
    tag = text_path(TAGLINE, 60, 540, 1240, "Black", anchor="middle")
    ul = {k: move(v, 0, 0, 0.26) for k, v in url_parts().items()}
    ux0, uy0, ux1, uy1 = bounds(ul["main"], ul["accent"])
    ul = {k: move(v, 540 - (ux0 + ux1) / 2, 1690 - uy0) for k, v in ul.items()}
    st_big = move(st0, 540, 560, 1.4)
    end = svg_doc(1080, 1920, [(d_of(pm["main"]), WHITE), (d_of(pm["accent"]), ORANGE), (d_of(tag), WHITE),
                               (d_of(union(ul["main"], ul["accent"])), ORANGE)], "indow end card", "Reel/story end card 1080×1920", bg=INK)
    png(write(f"{E}/social/indow-endcard-1080x1920.svg", end), f"{E}/social/indow-endcard-1080x1920.png", width=1080)


if __name__ == "__main__":
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    build_logos(); build_favicons(); build_elements()
    print("ok")
