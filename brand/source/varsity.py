"""Varsity «i» — the indow wordmark and mark.

The slab «i» with its orange dot is both the first letter of the wordmark and, with the speed stripes,
the stand-alone symbol — so the logo never says «i indow».
Units: x-height 100, baseline y = 100, stroke W = 32, everything sheared forward by LEAN.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from geom import *

LEAN = -0.22          # ≈ 12.4° forward lean
W = 32


def lean(p, about_y=100):
    return transformed(p, (1, 0, LEAN, 1, -LEAN * about_y, 0))


def _ring(cx, cy, ro, ri):
    return diff(circle(cx, cy, ro), circle(cx, cy, ri))


# ---------- upright glyphs ----------
def g_i():
    stem = rect(0, 0, W, 100)
    flag = rect(-14, 0, W + 14, 16)
    foot = rect(-12, 84, W + 24, 16)
    return union(stem, flag, foot)


def g_i_dot():
    return rrect(0, -46, W, 30, 7)


def g_n():
    arch = inter(_ring(52, 52, 52, 20), rect(-1, -1, 106, 53.5))
    return union(arch, rect(0, 52, W, 48), rect(104 - W, 52, W, 48))


def g_d():
    return union(_ring(52, 50, 53, 20), rect(73, -52, W, 152))


def g_o():
    return _ring(53, 50, 53, 20)


def g_w():
    left = inter(_ring(52, 48, 52, 20), rect(-1, 47.5, 106, 54))
    right = inter(_ring(124, 48, 52, 20), rect(71, 47.5, 106, 54))
    return union(left, right, rect(0, 0, W, 49), rect(72, 28, W, 21), rect(144, 0, W, 49))


def g_stripes():
    return union(rrect(-90, 20, 62, 16, 8), rrect(-74, 44, 46, 16, 8), rrect(-58, 68, 30, 16, 8))


X_N, X_D, X_O, X_W = 60, 182, 306, 429


def wordmark_parts(stripes=False):
    letters = union(g_i(), move(g_n(), X_N, 0), move(g_d(), X_D, 0), move(g_o(), X_O, 0), move(g_w(), X_W, 0))
    if stripes:
        letters = union(letters, g_stripes())
    return {"main": lean(letters), "accent": lean(g_i_dot())}


def mark_parts():
    """The symbol: speed stripes + slab «i» + orange dot."""
    return {"main": lean(union(g_i(), g_stripes())), "accent": lean(g_i_dot())}


def url_parts():
    """indow.ir in the same letters (no stripes)."""
    end = X_W + 176
    period = rrect(end + 18, 72, 28, 28, 6)
    i2 = move(g_i(), end + 72, 0)
    r = move(union(inter(_ring(52, 52, 52, 20), rect(-1, -1, 58, 53.5)), rect(0, 52, W, 48)), end + 72 + 66, 0)
    letters = union(g_i(), move(g_n(), X_N, 0), move(g_d(), X_D, 0), move(g_o(), X_O, 0), move(g_w(), X_W, 0), period, i2, r)
    return {"main": lean(letters), "accent": lean(union(g_i_dot(), move(g_i_dot(), end + 72, 0)))}


def mark_parts_px16():
    """Pixel-snapped 16-px drawing in 120-unit space (1 px = 7.5 units): upright, no stripes."""
    u = 120 / 16
    i = union(rect(7 * u, 6.5 * u, 3 * u, 6.5 * u), rect(5.5 * u, 6.5 * u, 4.5 * u, 1.5 * u), rect(5 * u, 11.5 * u, 6.5 * u, 1.5 * u))
    return {"main": i, "accent": rect(7 * u, 2.5 * u, 3 * u, 3 * u)}
