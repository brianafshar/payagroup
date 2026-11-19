"""Gregorian → Jalali (Solar Hijri) dates, the same conversion the apps use (packages/core/src/jalali.ts)."""

from datetime import date

from .text import fa_digits

MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
_G_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]


def to_jalali(d: date) -> tuple[int, int, int]:
    gy, gm, gd = d.year, d.month, d.day
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + _G_DAYS[gm - 1]
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        return jy, 1 + days // 31, 1 + days % 31
    return jy, 7 + (days - 186) // 30, 1 + (days - 186) % 30


def fa_date(d: date, year: bool = True) -> str:
    """«۲۲ مهر ۱۴۰۵»."""
    jy, jm, jd = to_jalali(d)
    return fa_digits(f"{jd} {MONTHS[jm - 1]}" + (f" {jy}" if year else ""))
