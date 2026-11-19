"""Geometry for the indow logo system. All shapes are built as boolean-clean outlines (skia-pathops)
so every SVG is pure paths: no fonts, no strokes, no overlaps."""
import math
import pathops
from pathops import PathOp
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
import uharfbuzz as hb
from fontTools.pens.recordingPen import DecomposingRecordingPen


def draw_glyph(gs, name, pen):
    rec = DecomposingRecordingPen(gs)
    gs[name].draw(rec)
    rec.replay(pen)


KAPPA = 0.5522847498
FONT_DIR = "/tmp/fonts/vazirmatn/misc/Farsi-Digits/fonts/ttf/"

ORANGE = "#FF9A1F"
INK = "#0A0A0A"
WHITE = "#FFFFFF"


# ---------- primitives ----------
def P():
    return pathops.Path()


def rect(x, y, w, h):
    p = P(); pen = p.getPen()
    pen.moveTo((x, y)); pen.lineTo((x + w, y)); pen.lineTo((x + w, y + h)); pen.lineTo((x, y + h)); pen.closePath()
    return p


def rrect(x, y, w, h, r):
    p = P(); pen = p.getPen(); k = KAPPA * r
    pen.moveTo((x + r, y))
    pen.lineTo((x + w - r, y)); pen.curveTo((x + w - r + k, y), (x + w, y + r - k), (x + w, y + r))
    pen.lineTo((x + w, y + h - r)); pen.curveTo((x + w, y + h - r + k), (x + w - r + k, y + h), (x + w - r, y + h))
    pen.lineTo((x + r, y + h)); pen.curveTo((x + r - k, y + h), (x, y + h - r + k), (x, y + h - r))
    pen.lineTo((x, y + r)); pen.curveTo((x, y + r - k), (x + r - k, y), (x + r, y))
    pen.closePath()
    return p


def circle(cx, cy, r):
    p = P(); pen = p.getPen(); k = KAPPA * r
    pen.moveTo((cx + r, cy))
    pen.curveTo((cx + r, cy + k), (cx + k, cy + r), (cx, cy + r))
    pen.curveTo((cx - k, cy + r), (cx - r, cy + k), (cx - r, cy))
    pen.curveTo((cx - r, cy - k), (cx - k, cy - r), (cx, cy - r))
    pen.curveTo((cx + k, cy - r), (cx + r, cy - k), (cx + r, cy))
    pen.closePath()
    return p


def op(a, b, kind):
    return pathops.op(a, b, kind)


def union(*paths):
    out = paths[0]
    for q in paths[1:]:
        out = op(out, q, PathOp.UNION)
    return out


def diff(a, *bs):
    for b in bs:
        a = op(a, b, PathOp.DIFFERENCE)
    return a


def inter(a, b):
    return op(a, b, PathOp.INTERSECTION)


def transformed(path, m):
    """m = (a, b, c, d, e, f) affine, SVG convention."""
    out = P()
    path.draw(TransformPen(out.getPen(), m))
    return out


def move(path, dx, dy, s=1.0):
    return transformed(path, (s, 0, 0, s, dx, dy))


def d_of(path, nd=2):
    pen = SVGPathPen(None, ntos=lambda v: (f"{v:.{nd}f}").rstrip("0").rstrip(".") if "." in f"{v:.{nd}f}" else f"{v:.{nd}f}")
    path.draw(pen)
    return pen.getCommands()


def bounds(*paths):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for p in paths:
        b = p.bounds
        xs0.append(b[0]); ys0.append(b[1]); xs1.append(b[2]); ys1.append(b[3])
    return min(xs0), min(ys0), max(xs1), max(ys1)


# ---------- wordmark "indow" ----------
# Units: x-height = 100, baseline at y = 100, stroke = 26.
def annulus(cx, cy, ro, ri):
    return diff(circle(cx, cy, ro), circle(cx, cy, ri))


def glyph_i():
    return rect(0, 0, 26, 100), circle(13, -32, 15)


def glyph_n():
    arch = inter(annulus(45, 45, 45, 19), rect(-1, -1, 92, 46.5))
    return union(arch, rect(0, 45, 26, 55), rect(64, 45, 26, 55))


def glyph_d():
    return union(annulus(50, 50, 51, 25), rect(75, -52, 26, 153))


def glyph_o():
    return annulus(51, 50, 51, 25)


def glyph_w():
    left = inter(annulus(45, 55, 45, 19), rect(-1, 54.5, 92, 47))
    right = inter(annulus(109, 55, 45, 19), rect(63, 54.5, 92, 47))
    return union(left, right, rect(0, 0, 26, 56), rect(64, 30, 26, 26), rect(128, 0, 26, 56))


def glyph_r():
    arch = inter(annulus(45, 45, 45, 19), rect(-1, -1, 50, 46.5))
    return union(arch, rect(0, 45, 26, 55))


def wordmark_url():
    """'indow.ir' in the same custom letterforms. Returns (letters, accent_dots)."""
    letters, dot1 = wordmark()
    period = circle(578, 85, 15)
    stem2, dot2 = glyph_i()
    i2 = move(stem2, 609, 0); dot2 = move(dot2, 609, 0)
    r = move(glyph_r(), 655, 0)
    return union(letters, period, i2, r), union(dot1, dot2)


def wordmark():
    """Returns (letters_path, dot_path) — the dot is drawn separately so it can carry the accent colour."""
    stem, dot = glyph_i()
    n = move(glyph_n(), 46, 0)
    d = move(glyph_d(), 152, 0)
    o = move(glyph_o(), 273, 0)
    w = move(glyph_w(), 391, 0)
    return union(stem, n, d, o, w), dot


# ---------- symbol: "the step" ----------
# A lowercase i standing on a step: the athlete (dot = head) one step higher than yesterday.
TILE = 120
TILE_R = 30


def symbol_glyph():
    step = union(rect(34, 74, 27, 22), rect(60, 52, 26, 44))
    head = circle(73, 32, 13)
    return step, head


def symbol_tile():
    return rrect(0, 0, TILE, TILE, TILE_R)


def symbol_glyph_16():
    """Pixel-snapped glyph for 16 px rendering, expressed in 120-unit space (1 px = 7.5 units)."""
    u = TILE / 16
    step = union(rect(4 * u, 10 * u, 4.2 * u, 3 * u), rect(8 * u, 7 * u, 4 * u, 6 * u))
    head = circle(10 * u, 4 * u, 2 * u)
    return step, head


# ---------- text → outlines ----------
_fonts = {}


def _font(weight):
    if weight not in _fonts:
        path = (FONT_DIR + f"Vazirmatn-FD-{weight[:-3]}.ttf") if weight.endswith("-FD") else f"/tmp/fonts/vazirmatn/fonts/ttf/Vazirmatn-{weight}.ttf"
        tt = TTFont(path)
        blob = hb.Blob.from_file_path(path)
        _fonts[weight] = (tt, tt.getGlyphSet(), hb.Font(hb.Face(blob)), tt["head"].unitsPerEm)
    return _fonts[weight]


def shape(text, weight="ExtraBold", tracking=0.0):
    """Shape text with HarfBuzz (handles Persian joining/RTL). Returns list of (glyphName, x_advance_start, x_offset, y_offset, advance) in font units, plus total advance."""
    tt, gs, font, upem = _font(weight)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})
    order = tt.getGlyphOrder()
    out = []; x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        adv = pos.x_advance + (tracking * upem if pos.x_advance else 0)
        out.append((order[info.codepoint], x, pos.x_offset, pos.y_offset, adv))
        x += adv
    if out and tracking:
        x -= tracking * upem  # no trailing tracking
    return out, x, upem


def text_path(text, size, x=0, baseline=0, weight="ExtraBold", tracking=0.0, anchor="start"):
    glyphs, total, upem = shape(text, weight, tracking)
    tt, gs, _, _ = _font(weight)
    s = size / upem
    if anchor == "middle":
        x -= total * s / 2
    elif anchor == "end":
        x -= total * s
    out = P()
    for name, gx, ox, oy, adv in glyphs:
        draw_glyph(gs, name, TransformPen(out.getPen(), (s, 0, 0, -s, x + (gx + ox) * s, baseline - oy * s)))
    return union(out, P())


def text_width(text, size, weight="ExtraBold", tracking=0.0):
    _, total, upem = shape(text, weight, tracking)
    return total * size / upem


def ring_text(text, size, cx, cy, r, start_deg, weight="Bold", tracking=0.0):
    """Lay text clockwise around a circle (baseline radius r, letters pointing outward).
    start_deg is measured clockwise from 12 o'clock where the text begins. Returns (path, end_deg)."""
    tt, gs, _, _ = _font(weight)
    glyphs, total, upem = shape(text, weight, tracking)
    s = size / upem
    out = P()
    for name, gx, ox, oy, adv in glyphs:
        gcx = gx + ox + gs[name].width / 2
        theta = math.radians(start_deg) + gcx * s / r
        c, sn = math.cos(theta), math.sin(theta)
        px, py = cx + r * sn, cy - r * c
        lc = ox + gs[name].width / 2  # glyph centre in its own coordinates
        m = (c * s, sn * s, sn * s, -c * s, px - c * s * lc, py - sn * s * lc)
        draw_glyph(gs, name, TransformPen(out.getPen(), m))
    return union(out, P()), start_deg + math.degrees(total * s / r)
