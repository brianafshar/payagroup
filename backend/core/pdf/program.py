"""The athlete's weekly program as a printable A4 PDF (RTL, Vazirmatn, the coach's brand colour and logo):
header → macro targets → each training session of the week (every active program) → each distinct daily
menu with amounts in household units → supplements → recovery. Rendered with WeasyPrint."""

import base64
import mimetypes
from datetime import date, timedelta
from pathlib import Path

from django.template.loader import render_to_string
from django.utils import timezone

from core.jalali import fa_date
from core.text import fa_digits

FONTS = Path(__file__).resolve().parent / "fonts"
WEEK = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"]
DAY_FA = {"sat": "شنبه", "sun": "یکشنبه", "mon": "دوشنبه", "tue": "سه‌شنبه", "wed": "چهارشنبه", "thu": "پنجشنبه", "fri": "جمعه"}


def week_dates(today: date) -> list[date]:
    sat = today - timedelta(days=(today.weekday() - 5) % 7)
    return [sat + timedelta(days=i) for i in range(7)]


def num(v, digits: int = 0) -> str:
    """A number in Persian digits without a pointless «.0»."""
    if v is None or v == "":
        return ""
    v = round(float(v), digits)
    return fa_digits(int(v) if v == int(v) else v)


def _tint(hex_color: str, k: float) -> str:
    """Mix a brand colour with white (k = share of white)."""
    try:
        r, g, b = (int(hex_color.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        r, g, b = 44, 75, 199
    return "#{:02x}{:02x}{:02x}".format(*(round(c + (255 - c) * k) for c in (r, g, b)))


def _logo(coach) -> str | None:
    if not coach.logo:
        return None
    try:
        with coach.logo.open("rb") as f:
            raw = f.read()
    except (OSError, ValueError):
        return None
    mime = mimetypes.guess_type(coach.logo.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


UNIT_FA = {"km": "کیلومتر", "m": "متر", "min": "دقیقه", "sec": "ثانیه", "s": "ثانیه", "kg": "کیلو"}
BAND_LEVELS = ["زرد", "قرمز", "سبز", "آبی", "مشکی"]  # band intensity 1–5 (see packages/core exercises)


def _row(i: int, slot: dict, exercises: dict) -> dict:
    ex = exercises.get(slot.get("exercise_id"))
    sets = slot.get("sets") or []
    first = sets[0] if sets else {}
    reps = [str(s.get("reps") or "").strip() for s in sets if str(s.get("reps") or "").strip()]
    reps_text = reps[0] if reps and len(set(reps)) == 1 else "/".join(reps)
    unit = first.get("unit") or "kg"
    value = num(first.get("value"), 2) + " " + UNIT_FA.get(unit, unit) if first.get("value") not in (None, "") else ""
    load = ""
    if unit == "band":
        level = int(first.get("value") or 0)
        load, value = ("کش " + BAND_LEVELS[level - 1] if 1 <= level <= 5 else ""), ""
    if unit == "kg":
        load = value
    elif value:  # distance / time work: «۵ کیلومتر», intervals «۲ × ۴۰۰ متر»
        reps_text = value if reps_text in ("", "1") else reps_text + " × " + value
    note = " · ".join(x for x in [load, f"RPE {num(first['rpe'])}" if first.get("rpe") else "", (slot.get("note") or "").strip()] if x)
    return {
        "i": num(i),
        "name": ex.name if ex else "حرکت",
        "sets": num(len(sets)) if sets else "",
        "reps": fa_digits(reps_text),
        "rest": num(first.get("rest_sec")) + "ث" if first.get("rest_sec") else "",
        "note": fa_digits(note),
    }


TIME_ORDER = {"morning": 0, "noon": 1, "afternoon": 2, "night": 3, "": 4}
TIME_FA = {"morning": "صبح", "noon": "ظهر", "afternoon": "عصر", "night": "شب", "": ""}


def _by_time(day: dict) -> dict[str, list[dict]]:
    """A day's exercises split by their part of the day (an exercise's own time, else the day's)."""
    out: dict[str, list[dict]] = {}
    for slot in day.get("exercises") or []:
        out.setdefault(slot.get("time") or day.get("time") or "", []).append(slot)
    return out


def training(athlete, dates: list[date]) -> dict:
    """This week day by day: each day's sessions from every active program (main program first), grouped
    under صبح / ظهر / عصر / شب by the time the coach set on the day; days with nothing are rest days."""
    from training import services
    from training.models import Exercise

    programs = athlete.active_programs()
    if athlete.program_id and all(p.pk != athlete.program_id for p in programs):
        programs.insert(0, athlete.program)
    programs.sort(key=lambda p: p.pk != athlete.program_id)
    week_no, weeks_total = None, None
    per_day: list[tuple[date, list[tuple[object, dict]]]] = []
    for d in dates:
        todays = []
        for program in programs:
            s = services.session_for(athlete, d, program)
            if program.pk == athlete.program_id and s["week"] is not None and week_no is None:
                week_no, weeks_total = s["week"], program.duration_weeks
            if services.trains(s):
                todays.append((program, s["day"]))
        per_day.append((d, todays))
    ids = {slot.get("exercise_id") for _, todays in per_day for _, day in todays for slot in day.get("exercises") or []}
    names = {e.pk: e for e in Exercise.objects.filter(pk__in=ids)}
    days = []
    for d, todays in per_day:
        sessions = sorted(
            (
                {
                    "time": t,
                    "program": program.name if len(programs) > 1 else "",
                    "focus": day.get("focus", ""),
                    "note": fa_digits(day.get("note", "") or ""),
                    "rows": [_row(i, slot, names) for i, slot in enumerate(slots, 1)],
                }
                for program, day in todays
                for t, slots in _by_time(day).items()
            ),
            key=lambda x: TIME_ORDER.get(x["time"], 4),
        )
        parts: list[dict] = []
        for x in sessions:
            if not parts or parts[-1]["time"] != x["time"]:
                parts.append({"time": x["time"], "label": TIME_FA.get(x["time"], ""), "sessions": []})
            parts[-1]["sessions"].append(x)
        days.append({"title": DAY_FA[WEEK[(d.weekday() + 2) % 7]] + " " + fa_date(d, year=False), "rest": not sessions, "parts": parts})
    if week_no is None and athlete.program_id:
        weeks_total = athlete.program.duration_weeks
    return {
        "days": days,
        "any": any(not x["rest"] for x in days),
        "week": week_no,
        "weeks_total": weeks_total,
    }


def _amount(f) -> tuple[str, str]:
    """(«۳ عدد», «۹۹g») for a bank food in a unit; («۱۵۰ گرم», «۱۵۰g») otherwise."""
    grams = num(f.grams, 1) + "g"
    if f.food_id and f.unit and f.unit != "گرم" and f.quantity is not None:
        return num(f.quantity, 2) + " " + f.unit, grams
    return num(f.grams, 1) + " گرم", grams


PARTS = [("morning", "صبح"), ("noon", "ظهر"), ("afternoon", "عصر"), ("night", "شب")]
PART_WORDS = {
    "صبحانه": "morning",
    "صبح": "morning",
    "ناهار": "noon",
    "نهار": "noon",
    "ظهر": "noon",
    "عصرانه": "afternoon",
    "عصر": "afternoon",
    "شام": "night",
    "شب": "night",
    "خواب": "night",
}


def part_of_day(meal, prev: str | None) -> str:
    """صبح / ظهر / عصر / شب for a meal: by its time (before 11, 11–15, 15–19, after), else by words in its name
    (صبحانه، ناهار، عصرانه، شام…), else the same part as the meal before it."""
    if meal.time:
        h = meal.time.hour + meal.time.minute / 60
        return "morning" if h < 11 else "noon" if h < 15 else "afternoon" if h < 19 else "night"
    name = meal.name.replace("\u200c", "")
    for word, part in PART_WORDS.items():
        if word in name:
            return part
    return prev or "morning"


def nutrition(plan) -> dict:
    """Each distinct daily menu (days with the same meals share one), with per-meal and per-day totals."""
    if plan is None:
        return {"menus": [], "targets": None, "supplements": []}
    meals = list(plan.meals.prefetch_related("foods"))
    by_day: dict[tuple, list[str]] = {}
    for w in WEEK:
        by_day.setdefault(tuple(m.pk for m in meals if m.on(w)), []).append(w)
    menus = []
    for ids, days in by_day.items():
        if not ids:
            continue
        rows, day_kcal, day_p, part = [], 0.0, 0.0, None
        for m in (m for m in meals if m.pk in ids):
            part = part_of_day(m, part)
            foods = []
            mk = mp = 0.0
            for f in m.foods.all():
                amount, grams = _amount(f)
                k, p = f.amount(f.kcal_per_100g), f.amount(f.protein_per_100g)
                mk, mp = mk + k, mp + p
                foods.append({"name": f.name, "amount": amount, "grams": grams, "kcal": num(k), "protein": num(p)})
            day_kcal, day_p = day_kcal + mk, day_p + mp
            rows.append(
                {
                    "name": m.name,
                    "part": part,
                    "time": fa_digits(m.time.strftime("%H:%M")) if m.time else "",
                    "foods": foods,
                    "kcal": num(mk),
                    "protein": num(mp),
                    "kcal_raw": mk,
                }
            )
        # Group the day's meals into صبح / ظهر / عصر / شب (in the day's order; a part with no meal is left out).
        parts = [{"label": label, "meals": [r for r in rows if r["part"] == key]} for key, label in PARTS]
        parts = [p for p in parts if p["meals"]]
        for p in parts:
            p["kcal"] = num(sum(r["kcal_raw"] for r in p["meals"]))
        title = "منوی هر روز" if len(days) == len(WEEK) else "منوی " + "، ".join(DAY_FA[w] for w in days)
        menus.append({"title": title, "meals": rows, "parts": parts, "kcal": num(day_kcal), "protein": num(day_p)})
    return {
        "menus": menus,
        "targets": {"kcal": num(plan.kcal), "protein": num(plan.protein), "carbs": num(plan.carbs), "fat": num(plan.fat), "water": num(plan.water_l, 1)},
        "supplements": [
            {"name": s.get("name", ""), "dose": fa_digits(s.get("dose", "")), "timing": fa_digits(s.get("timing", ""))} for s in plan.supplements or []
        ],
    }


def recovery(rplan, water_l) -> list[str]:
    if rplan is None:
        return []
    lines = [f"خواب: {num(rplan.sleep_hours, 1)} ساعت در شب"]
    if rplan.stretch_min:
        lines.append(f"کشش و تحرک: {num(rplan.stretch_min)} دقیقه در روز")
    if rplan.rest_days:
        lines.append("روزهای استراحت: " + "، ".join(DAY_FA.get(d, d) for d in WEEK if d in rplan.rest_days))
    if water_l:
        lines.append(f"آب: حداقل {num(water_l, 1)} لیتر در روز")
    if rplan.note.strip():
        lines.append(fa_digits(rplan.note.strip()))
    return lines


def context(athlete, today: date | None = None) -> dict:
    from tracking.models import NutritionPlan, RecoveryPlan

    today = today or timezone.localdate()
    coach = athlete.coach
    primary = coach.primary or "#2c4bc7"
    plan = NutritionPlan.objects.filter(athlete=athlete).first()
    rplan = RecoveryPlan.objects.filter(athlete=athlete).first()
    t = training(athlete, week_dates(today))
    meta = [f"مربی: {coach.user.name}", coach.app_name]
    if t["week"]:
        meta.append(fa_digits(f"هفته {t['week']} از {t['weeks_total']}"))
    meta.append("صادره " + fa_date(today))
    return {
        "athlete": athlete.name,
        "goal": athlete.get_goal_display() if athlete.goal else "",
        "meta": " · ".join(x for x in meta if x),
        "logo": _logo(coach),
        "initials": (coach.initials or coach.app_name[:1] or "i")[:2],
        "primary": primary,
        "tint": _tint(primary, 0.9),
        "tint2": _tint(primary, 0.96),
        "training": t,
        "nutrition": nutrition(plan),
        "recovery": recovery(rplan, plan.water_l if plan else None),
        "font_dir": FONTS.as_uri(),
        "indow_logo": (Path(__file__).resolve().parent / "indow-wordmark.svg").as_uri(),
    }


def render_pdf(athlete, today: date | None = None) -> bytes:
    from weasyprint import HTML

    html = render_to_string("pdf/program.html", context(athlete, today))
    return HTML(string=html, base_url=str(FONTS)).write_pdf()


def filename(athlete) -> str:
    return f"program-{athlete.pk}.pdf"
