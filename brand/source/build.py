import os, sys, json, math, struct, io, shutil
sys.path.insert(0, os.path.dirname(__file__))
from geom import *
from geom import _font, draw_glyph
import cairosvg
from PIL import Image

OUT = "/home/claude/indow-brand"
GRAY = "#A3A3A3"
SURFACE = "#141414"

COLORWAYS = ["color", "reversed", "black", "white", "orange"]
CW_DESC = {
    "color": "full colour, for light backgrounds",
    "reversed": "full colour, for dark backgrounds",
    "black": "one colour black",
    "white": "one colour white",
    "orange": "one colour orange",
}


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s != "-0" else "0"


def svg_doc(w, h, layers, title, desc, bg=None, extra=""):
    body = []
    if bg:
        body.append(f'<rect width="{fmt(w)}" height="{fmt(h)}" fill="{bg}"/>')
    for d, fill in layers:
        if d:
            body.append(f'<path fill="{fill}" d="{d}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" width="{fmt(w)}" height="{fmt(h)}" role="img" aria-labelledby="t d">'
            f'<title id="t">{title}</title><desc id="d">{desc}</desc>' + "".join(body) + extra + "</svg>\n")


def normalise(groups, pad=0.0):
    """groups: list of (path, fill). Moves everything so bbox starts at (pad, pad)."""
    x0, y0, x1, y1 = bounds(*[p for p, _ in groups])
    moved = [(move(p, pad - x0, pad - y0), f) for p, f in groups]
    return moved, (x1 - x0) + 2 * pad, (y1 - y0) + 2 * pad


def write(path, text):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)
    return full


def png(svg_path, out_path, width=None, height=None, bg=None):
    full = os.path.join(OUT, out_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    cairosvg.svg2png(url=svg_path, write_to=full, output_width=width, output_height=height, background_color=bg)
    return full


def png_from_string(svg, out_path, width=None, height=None):
    full = os.path.join(OUT, out_path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=full, output_width=width, output_height=height)
    return full


# ---------------- building blocks per colourway ----------------
def symbol_layers(cw, glyph=None):
    step, head = glyph or symbol_glyph()
    tile = symbol_tile()
    g = union(step, head)
    if cw in ("color", "reversed"):
        return [(tile, ORANGE), (g, INK)]
    col = {"black": INK, "white": WHITE, "orange": ORANGE}[cw]
    return [(diff(tile, g), col)]


def wordmark_layers(cw):
    letters, dot = wordmark()
    if cw == "color":
        return [(letters, INK), (dot, ORANGE)]
    if cw == "reversed":
        return [(letters, WHITE), (dot, ORANGE)]
    col = {"black": INK, "white": WHITE, "orange": ORANGE}[cw]
    return [(union(letters, dot), col)]


def place(layers, dx, dy, s=1.0):
    return [(move(p, dx, dy, s), f) for p, f in layers]


def to_doc(groups, title, desc, pad=0, bg=None):
    moved, w, h = normalise(groups, pad)
    return svg_doc(w, h, [(d_of(p), f) for p, f in moved], title, desc, bg=bg), w, h


# ---------------- 1. primary: horizontal lockup ----------------
SYM_IN_LOCKUP = 152          # symbol height = ascender-to-baseline of the wordmark
GAP_LOCKUP = 40


def primary(cw):
    s = SYM_IN_LOCKUP / TILE
    return place(symbol_layers(cw), 0, -52, s) + place(wordmark_layers(cw), SYM_IN_LOCKUP + GAP_LOCKUP, 0)


# ---------------- 2. secondary: stacked lockup + wordmark ----------------
SYM_STACKED = 232


def stacked(cw):
    wm_w = 547  # -2..545
    s = SYM_STACKED / TILE
    sx = (wm_w - SYM_STACKED) / 2 - 2
    return place(symbol_layers(cw), sx, 0, s) + place(wordmark_layers(cw), 0, SYM_STACKED + 56 + 52)


# ---------------- 3. submark: circular badge ----------------
R_DISC = 200
TOP_TEXT = "COACH, DON'T ARCHIVE"
BOTTOM_TEXT = "INDOW.IR"


def ring_text_bottom(text, size, cx, cy, r, weight="Bold", tracking=0.0):
    """Upright text along the bottom arc, centred at 6 o'clock, reading left→right. r = baseline radius."""
    tt, gs, _, _ = _font(weight)
    glyphs, total, upem = shape(text, weight, tracking)
    s = size / upem
    out = P()
    for name, gx, ox, oy, adv in glyphs:
        gcx = gx + ox + gs[name].width / 2
        t = gcx * s - total * s / 2               # distance from text centre along arc
        theta = math.pi - t / r                    # clockwise from 12 o'clock
        px, py = cx + r * math.sin(theta), cy - r * math.cos(theta)
        phi = theta - math.pi                      # glyph rotation
        c, sn = math.cos(phi), math.sin(phi)
        lc = ox + gs[name].width / 2  # glyph centre in its own coordinates
        m = (c * s, sn * s, sn * s, -c * s, px - c * s * lc, py - sn * s * lc)
        draw_glyph(gs, name, TransformPen(out.getPen(), m))
    return union(out, P()), math.degrees(total * s / r)


def submark_parts():
    cx = cy = R_DISC
    disc = circle(cx, cy, R_DISC)
    ring = annulus(cx, cy, 140, 134)
    track, r_top = 0.12, 157
    size = 31 * (math.radians(146) * r_top) / text_width(TOP_TEXT, 31, "Bold", track)  # fit top arc to 146°
    top_w = text_width(TOP_TEXT, size, "Bold", track)
    top, _ = ring_text(TOP_TEXT, size, cx, cy, r_top, -math.degrees(top_w / r_top) / 2, "Bold", track)
    bottom, _ = ring_text_bottom(BOTTOM_TEXT, size, cx, cy, 157 + size * 0.71, "Bold", 0.3)
    dots = union(circle(cx + 168.5, cy, 6.5), circle(cx - 168.5, cy, 6.5))
    step, head = symbol_glyph()
    g = union(step, head)
    gs = 1.62
    gx0, gy0, gx1, gy1 = g.bounds
    glyph = move(g, cx - (gx0 + gx1) / 2 * gs, cy - (gy0 + gy1) / 2 * gs - 4, gs)
    details = union(ring, top, bottom, dots)
    return disc, details, glyph


def submark(cw):
    disc, details, glyph = submark_parts()
    if cw == "color":
        return [(disc, ORANGE), (details, INK), (glyph, INK)]
    if cw == "reversed":
        return [(disc, INK), (details, WHITE), (glyph, ORANGE)]
    col = {"black": INK, "white": WHITE, "orange": ORANGE}[cw]
    return [(diff(disc, details, glyph), col)]


# ---------------- build ----------------
def build_logos():
    made = {}
    names = {
        "01-primary": ("indow-primary", primary, "indow primary logo (horizontal lockup)",
                       "Orange rounded tile with a lowercase i standing on a step, next to the indow wordmark"),
        "02-secondary": ("indow-secondary-stacked", stacked, "indow secondary logo (stacked lockup)",
                         "The indow symbol centred above the indow wordmark"),
    }
    for folder, (stem, fn, title, desc) in names.items():
        for cw in COLORWAYS:
            doc, w, h = to_doc(fn(cw), title, f"{desc} — {CW_DESC[cw]}")
            made[(folder, stem, cw)] = (write(f"{folder}/svg/{stem}-{cw}.svg", doc), w, h)
    for cw in COLORWAYS:
        doc, w, h = to_doc(wordmark_layers(cw), "indow wordmark", f"The indow wordmark — {CW_DESC[cw]}")
        made[("02-secondary", "indow-wordmark", cw)] = (write(f"02-secondary/svg/indow-wordmark-{cw}.svg", doc), w, h)
        doc, w, h = to_doc(submark(cw), "indow submark", f"Circular badge: the step symbol inside a ring reading COACH, DON'T ARCHIVE and INDOW.IR — {CW_DESC[cw]}")
        made[("03-submark", "indow-submark", cw)] = (write(f"03-submark/svg/indow-submark-{cw}.svg", doc), w, h)
        doc = svg_doc(TILE, TILE, [(d_of(p), f) for p, f in symbol_layers(cw)], "indow symbol",
                      f"Rounded tile with a lowercase i standing on a step — {CW_DESC[cw]}")
        made[("04-favicon", "indow-symbol", cw)] = (write(f"04-favicon/svg/indow-symbol-{cw}.svg", doc), TILE, TILE)
        # glyph-only (no tile)
        step, head = symbol_glyph()
        g = union(step, head)
        col = {"color": INK, "reversed": ORANGE, "black": INK, "white": WHITE, "orange": ORANGE}[cw]
        if cw in ("black", "white", "orange", "color"):
            doc, w, h = to_doc([(g, col)], "indow step glyph", f"The step glyph without its tile — {'ink' if col == INK else cw}")
            gname = {"color": "black"}.get(cw, cw)
            write(f"04-favicon/svg/indow-glyph-{gname}.svg", doc)
    # PNG exports of the lockups
    for (folder, stem, cw), (path, w, h) in made.items():
        if folder == "04-favicon":
            continue
        widths = {"01-primary": [600, 1200, 2400], "02-secondary": [600, 1200, 2400], "03-submark": [256, 512, 1024]}[folder]
        if stem == "indow-wordmark":
            widths = [600, 1200, 2400]
        for W in widths:
            png(path, f"{folder}/png/{stem}-{cw}-{W}w.png", width=W)
    return made


# ---------------- favicon & app icons ----------------
def icon_svg(size_units_glyph=None, full_bleed=False, glyph_scale=1.0, sixteen=False):
    step, head = symbol_glyph_16() if sixteen else symbol_glyph()
    g = union(step, head)
    if glyph_scale != 1.0:
        x0, y0, x1, y1 = g.bounds
        cxg, cyg = (x0 + x1) / 2, (y0 + y1) / 2
        g = move(g, 60 - cxg * glyph_scale, 60 - cyg * glyph_scale + (cyg - 57.5) * 0, glyph_scale)
    tile = rect(0, 0, TILE, TILE) if full_bleed else symbol_tile()
    return svg_doc(TILE, TILE, [(d_of(tile), ORANGE), (d_of(g), INK)], "indow", "indow app icon")


def write_ico(pngs, out):
    """pngs: list of (size, bytes). Writes a PNG-compressed .ico."""
    header = struct.pack("<HHH", 0, 1, len(pngs))
    offset = 6 + 16 * len(pngs)
    entries, blobs = b"", b""
    for size, data in pngs:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data); blobs += data
    with open(out, "wb") as f:
        f.write(header + entries + blobs)


def build_favicons():
    d = os.path.join(OUT, "04-favicon")
    std = icon_svg()
    small = icon_svg(sixteen=True)
    bleed = icon_svg(full_bleed=True)
    mask = icon_svg(full_bleed=True, glyph_scale=0.84)
    write("04-favicon/favicon.svg", std)
    files = {}
    for size, src in [(16, small), (32, small), (48, small)]:  # pixel-snapped geometry (16-px grid) stays crisp at 16/32/48
        files[size] = png_from_string(src, f"04-favicon/favicon-{size}x{size}.png", size, size)
    write_ico([(s, open(files[s], "rb").read()) for s in (16, 32, 48)], os.path.join(d, "favicon.ico"))
    png_from_string(bleed, "04-favicon/apple-touch-icon.png", 180, 180)
    png_from_string(std, "04-favicon/android-chrome-192x192.png", 192, 192)
    png_from_string(std, "04-favicon/android-chrome-512x512.png", 512, 512)
    png_from_string(mask, "04-favicon/maskable-icon-512x512.png", 512, 512)
    # App-store icon: full bleed, no alpha
    p = png_from_string(bleed, "04-favicon/app-icon-1024.png", 1024, 1024)
    Image.open(p).convert("RGB").save(p)
    for s in (64, 128, 256, 512, 1024):
        png_from_string(std, f"04-favicon/png/indow-symbol-color-{s}.png", s, s)
    manifest = {
        "name": "indow", "short_name": "indow",
        "icons": [
            {"src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "theme_color": "#0A0A0A", "background_color": "#0A0A0A", "display": "standalone",
    }
    write("04-favicon/site.webmanifest", json.dumps(manifest, indent=2) + "\n")
    write("04-favicon/head-snippet.html", """<!-- indow favicons: copy the files in this folder to your site root -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0A0A0A">
""")


# ---------------- 5. brand elements ----------------
TAGLINE = "مربی‌گری کن، نه بایگانی."
NAME_FA = "ایندو"


def build_elements():
    made = {}
    # Persian lockup (RTL): Persian name left of symbol, read right→left: symbol first.
    for cw in ("reversed", "color"):
        fa = text_path(NAME_FA, 190, 0, 100, "Black")
        col = WHITE if cw == "reversed" else INK
        x0, y0, x1, y1 = fa.bounds
        sym = place(symbol_layers(cw), x1 + 44, -52, SYM_IN_LOCKUP / TILE)
        doc, w, h = to_doc([(fa, col)] + sym, "ایندو", f"Persian lockup — {CW_DESC[cw]}")
        made[f"fa-{cw}"] = write(f"05-brand-elements/indow-lockup-fa-{cw}.svg", doc)
        png(made[f"fa-{cw}"], f"05-brand-elements/png/indow-lockup-fa-{cw}-1200w.png", width=1200)
    # Tagline lockup (stacked + Persian tagline)
    for cw in ("reversed", "color"):
        st = stacked(cw)
        x0, y0, x1, y1 = bounds(*[p for p, _ in st])
        tcol = GRAY if cw == "reversed" else "#525252"
        tag = text_path(TAGLINE, 64, (x0 + x1) / 2, y1 + 120, "Medium", anchor="middle")
        doc, w, h = to_doc(st + [(tag, tcol)], "indow — مربی‌گری کن، نه بایگانی", f"Stacked logo with tagline — {CW_DESC[cw]}")
        made[f"tag-{cw}"] = write(f"05-brand-elements/indow-tagline-{cw}.svg", doc)
        png(made[f"tag-{cw}"], f"05-brand-elements/png/indow-tagline-{cw}-1200w.png", width=1200)

    # Seamless pattern tile (step glyphs on a half-drop grid)
    step, head = symbol_glyph()
    g = union(step, head)
    gx0, gy0, gx1, gy1 = g.bounds
    gn = move(g, -(gx0 + gx1) / 2, -(gy0 + gy1) / 2)  # centred at origin
    for name, bg, fg, sc in (("orange", ORANGE, INK, 0.42), ("dark", INK, "#1C1C1C", 0.42), ("dark-orange", INK, ORANGE, 0.42)):
        T = 200
        cells = [(50, 50), (150, 150)]
        ps = [move(gn, x, y, sc) for x, y in cells]
        dots = [circle(150, 50, 7), circle(50, 150, 7)]
        d = d_of(union(*ps, *dots))
        tile_svg = svg_doc(T, T, [(d, fg)], "indow pattern tile", f"Seamless {name} pattern tile", bg=bg)
        made[f"pattern-{name}"] = write(f"05-brand-elements/pattern-{name}-tile.svg", tile_svg)
        # 1080 preview using <pattern>
        prev = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">'
                f'<defs><pattern id="p" width="{T}" height="{T}" patternUnits="userSpaceOnUse"><rect width="{T}" height="{T}" fill="{bg}"/>'
                f'<path fill="{fg}" d="{d}"/></pattern></defs><rect width="1080" height="1080" fill="url(#p)"/></svg>')
        png_from_string(prev, f"05-brand-elements/png/pattern-{name}-1080.png", 1080, 1080)

    # Palette sheet
    sw = [("Indow Orange", ORANGE, "255 154 31", "0 40 88 0", "PMS 1375 C*"),
          ("Ink", INK, "10 10 10", "60 40 40 100", "Black 6 C*"),
          ("White", WHITE, "255 255 255", "0 0 0 0", "—"),
          ("Surface", SURFACE, "20 20 20", "0 0 0 92", "—"),
          ("Muted", GRAY, "163 163 163", "0 0 0 36", "Cool Gray 6 C*")]
    W, H = 1500, 640
    parts = []
    for i, (n, hx, rgb, cmyk, pms) in enumerate(sw):
        x = 40 + i * 290
        fg = INK if hx in (ORANGE, WHITE, GRAY) else WHITE
        parts.append((rrect(x, 40, 260, 400, 24), hx))
        if hx == WHITE:
            parts.append((diff(rrect(x, 40, 260, 400, 24), rrect(x + 1.5, 41.5, 257, 397, 22.5)), "#D4D4D4"))
        parts.append((text_path(n, 30, x + 24, 400, "Bold"), fg))
        for j, line in enumerate([hx, f"RGB {rgb}", f"CMYK {cmyk}", pms]):
            parts.append((text_path(line, 22, x + 4, 490 + j * 34, "Medium"), INK if j == 0 else "#525252"))
    parts.append((text_path("* nearest Pantone match — verify against a physical swatch book before printing", 18, 40, 620, "Regular"), "#737373"))
    doc = svg_doc(W, H, [(d_of(p), f) for p, f in parts], "indow colour palette", "indow brand colours with HEX, RGB, CMYK", bg="#FAFAFA")
    made["palette"] = write("05-brand-elements/indow-palette.svg", doc)
    png(made["palette"], "05-brand-elements/png/indow-palette.png", width=1500)

    # Instagram avatar (circle-safe), reel watermark, reel end card
    av = place([(union(step, head), INK)], 0, 0)
    gx0, gy0, gx1, gy1 = g.bounds
    s = 470 / (gy1 - gy0)
    avatar = svg_doc(1080, 1080, [(d_of(move(g, 540 - (gx0 + gx1) / 2 * s, 540 - (gy0 + gy1) / 2 * s, s)), INK)],
                     "indow avatar", "Instagram profile picture", bg=ORANGE)
    made["avatar"] = write("05-brand-elements/social/indow-avatar-1080.svg", avatar)
    png(made["avatar"], "05-brand-elements/social/indow-avatar-1080.png", width=1080)

    # domain lockups (indow.ir in the custom letterforms)
    for cw in COLORWAYS:
        letters, dots = wordmark_url()
        if cw == "color": L = [(letters, INK), (dots, ORANGE)]
        elif cw == "reversed": L = [(letters, WHITE), (dots, ORANGE)]
        else: L = [(union(letters, dots), {"black": INK, "white": WHITE, "orange": ORANGE}[cw])]
        doc, w, h = to_doc(L, "indow.ir", f"The indow.ir domain wordmark — {CW_DESC[cw]}")
        made[f"url-{cw}"] = write(f"05-brand-elements/indow-url-{cw}.svg", doc)
        png(made[f"url-{cw}"], f"05-brand-elements/png/indow-url-{cw}-1200w.png", width=1200)

    letters, dots = wordmark_url()
    wm_layers = place(symbol_layers("white"), 0, -52, SYM_IN_LOCKUP / TILE) + [(union(letters, dots), WHITE)]
    wm_layers = [wm_layers[0]] + place([wm_layers[1]], SYM_IN_LOCKUP + GAP_LOCKUP, 0)
    doc, w, h = to_doc(wm_layers, "indow watermark", "White watermark for reels and photos (85% opacity)")
    doc = doc.replace("<path ", '<path fill-opacity="0.85" ')
    made["watermark"] = write("05-brand-elements/social/indow-watermark-white.svg", doc)
    png(made["watermark"], "05-brand-elements/social/indow-watermark-white-600w.png", width=600)

    st = stacked("reversed")
    x0, y0, x1, y1 = bounds(*[p for p, _ in st])
    sc = 640 / (x1 - x0)
    st = place(st, 540 - (x0 + x1) / 2 * sc, 600 - y0 * sc, sc)
    tag = text_path(TAGLINE, 58, 540, 1262, "Bold", anchor="middle")
    ul, ud = wordmark_url(); url = move(union(ul, ud), 540 - 351 * 0.28, 1660, 0.28)
    end = svg_doc(1080, 1920, [(d_of(p), f) for p, f in st] + [(d_of(tag), WHITE), (d_of(url), ORANGE)],
                  "indow end card", "Reel/story end card 1080×1920", bg=INK)
    made["endcard"] = write("05-brand-elements/social/indow-endcard-1080x1920.svg", end)
    png(made["endcard"], "05-brand-elements/social/indow-endcard-1080x1920.png", width=1080)
    return made


if __name__ == "__main__":
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    m = build_logos()
    build_favicons()
    e = build_elements()
    print("ok", len(m), len(e))
