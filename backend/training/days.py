"""What an athlete was asked to do on a day and whether it was done (#89): training (any active program),
the day's meals, the recovery check-in and a scheduled body measurement. A day with nothing prescribed is a
rest day — done by definition, never «missed»."""

from datetime import date, timedelta

from django.utils import timezone

from coaching.models import Athlete

from . import services
from .models import PY_WEEKDAY, WorkoutLog

DONE = ("completed", "partial", "in-progress")
WEEKS = {"w1": 1, "w2": 2, "w3": 3}


def training_status(sessions: list[dict], logs: list[WorkoutLog], d: date, today: date) -> str:
    """rest · planned · missed · completed · partial · in-progress for one day over every program.
    Logs on a day nothing is prescribed for (a session opened on a rest day and never used) don't make it
    «missed»."""
    trained = [s for s in sessions if services.trains(s)]
    by_prog = {(x.program_id, x.part): x for x in logs}
    if not trained:
        done = [x for x in logs if x.status in DONE]
        return done[0].status if done else "rest"
    # every session of the day: each program, and each part of a day with several times
    expected = [(s["program"].pk if s["program"] else None, p) for s in trained for p in services.day_parts(s["day"])]
    statuses = [by_prog[k].status if k in by_prog else None for k in expected]
    if any(st in ("completed", "partial", "in-progress") for st in statuses):
        if all(st == "completed" for st in statuses):
            return "completed"
        return "in-progress" if "in-progress" in statuses else "partial"
    return "planned" if d >= today else "missed"


def measure_due(athlete: Athlete, d: date, measured: list[date]) -> bool:
    """The measurement schedule (athlete's own, else the coach default) asks for one on `d`: its weekday,
    and — every 2/3/N weeks or monthly — enough time since the last measurement before that day."""
    cfg = athlete.measure_schedule or (athlete.coach.preferences or {}).get("m")
    if not cfg or PY_WEEKDAY[d.weekday()][:2] != (cfg.get("day") or "fr")[:2]:
        return False
    last = max((x for x in measured if x < d), default=None)
    if cfg.get("freq") == "m1":
        return d.day <= 7 and not (last and (last.year, last.month) == (d.year, d.month))
    weeks = WEEKS.get(cfg.get("freq")) or int(cfg.get("n") or 1)
    return last is None or (d - last).days >= weeks * 7 - 6


def day_checks(athlete: Athlete, dates: list[date]) -> dict[date, dict]:
    """Per day: `training` (status), and `nutrition` / `recovery` / `measure`, each `done`, `missing`,
    `planned` (still ahead) or `none` (nothing asked), plus `missing` — the labels of what wasn't done."""
    from tracking.models import Meal, MealLog, Measurement, RecoveryCheckIn, RecoveryPlan

    if not dates:
        return {}
    today = timezone.localdate()
    lo, hi = min(dates), max(dates)
    logs: dict[date, list[WorkoutLog]] = {}
    for x in WorkoutLog.objects.filter(athlete=athlete, date__gte=lo, date__lte=hi):
        logs.setdefault(x.date, []).append(x)
    meals = list(Meal.objects.filter(plan__athlete=athlete))
    eaten = set(MealLog.objects.filter(athlete=athlete, date__gte=lo, date__lte=hi).values_list("date", flat=True))
    checked = set(RecoveryCheckIn.objects.filter(athlete=athlete, date__gte=lo, date__lte=hi).values_list("date", flat=True))
    has_recovery = RecoveryPlan.objects.filter(athlete=athlete).exists()
    measured = sorted(set(Measurement.objects.filter(athlete=athlete, date__gte=lo - timedelta(days=62), date__lte=hi).values_list("date", flat=True)))

    def state(asked: bool, done: bool, d: date) -> str:
        if done:
            return "done"
        if not asked:
            return "none"
        return "planned" if d >= today else "missing"

    out = {}
    for d in dates:
        wd = PY_WEEKDAY[d.weekday()]
        row = {
            "training": training_status(services.sessions_for(athlete, d), logs.get(d, []), d, today),
            "nutrition": state(any(m.on(wd) for m in meals), d in eaten, d),
            "recovery": state(has_recovery, d in checked, d),
            "measure": state(measure_due(athlete, d, measured), d in measured, d),
        }
        row["missing"] = [
            label
            for key, label in (("nutrition", "تغذیه ثبت نشد"), ("recovery", "ریکاوری ثبت نشد"), ("measure", "اندازه‌گیری ثبت نشد"))
            if row[key] == "missing"
        ]
        if row["training"] == "missed":
            row["missing"].insert(0, "تمرین انجام نشد")
        out[d] = row
    return out
