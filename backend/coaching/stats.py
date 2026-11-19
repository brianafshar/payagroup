"""Derived athlete stats for lists and dashboards (C10, C11, A06). Everything is computed from logged
data; when there is nothing to compute from the value is `None` («ثبت نشده») — never estimated."""

from datetime import date, timedelta

from django.db.models import Max
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Athlete

WINDOW = 30


def expected_sessions(athlete: Athlete, start: date, end: date) -> list[date]:
    """Training days (non-rest, with exercises) the athlete's program prescribes in [start, end]."""
    from training.models import PY_WEEKDAY

    from .models import program_week_of

    program, program_start = athlete.program, athlete.program_start
    if program is None or program_start is None:
        return []
    out = []
    d = max(start, program_start)
    while d <= end:
        week = program_week_of(program_start, d)
        if week <= program.duration_weeks:
            day = program.day(week, PY_WEEKDAY[d.weekday()])
            if day and not day.get("rest") and day.get("exercises"):
                out.append(d)
        d += timedelta(days=1)
    return out


def adherence_pct(athlete: Athlete, days: int = WINDOW, today: date | None = None) -> int | None:
    today = today or timezone.localdate()
    expected = expected_sessions(athlete, today - timedelta(days=days - 1), today - timedelta(days=1))
    if not expected:
        return None
    # A day with several sessions (morning / night…) scores the average of its sessions.
    per_day: dict[date, list[float]] = {}
    for d, st in athlete.workouts.filter(date__in=expected).values_list("date", "status"):
        per_day.setdefault(d, []).append(1.0 if st == "completed" else 0.5 if st == "partial" else 0.0)
    score = sum(sum(per_day[d]) / len(per_day[d]) if d in per_day else 0.0 for d in expected)
    return round(100 * score / len(expected))


def strength_change_pct(athlete: Athlete, days: int = WINDOW, today: date | None = None) -> float | None:
    """Mean change of each exercise's best done load (kg): last `days` vs the `days` before."""
    from training.models import LoggedSet

    today = today or timezone.localdate()
    split = today - timedelta(days=days)
    base = LoggedSet.objects.filter(log__athlete=athlete, done=True, unit="kg")

    def best(qs):
        rows = qs.values("exercise_id").annotate(w=Max(Coalesce("actual_value", "target_value")))
        return {r["exercise_id"]: r["w"] for r in rows if r["w"] is not None}

    recent = best(base.filter(log__date__gt=split, log__date__lte=today))
    before = best(base.filter(log__date__gt=split - timedelta(days=days), log__date__lte=split))
    changes = [(recent[e] - before[e]) / before[e] * 100 for e in recent.keys() & before.keys() if before[e]]
    return round(sum(changes) / len(changes), 1) if changes else None


def nutrition_pct(athlete: Athlete, days: int = 7, today: date | None = None) -> int | None:
    from tracking.models import MealLog

    today = today or timezone.localdate()
    logs = list(athlete.meal_logs.filter(date__gt=today - timedelta(days=days), date__lte=today).values_list("status", flat=True))
    if not logs:
        return None
    return round(100 * sum(MealLog.FACTOR[s] for s in logs) / len(logs))


def attention(athlete: Athlete, today: date | None = None) -> tuple[str | None, float | None]:
    """The single most important flag for the coach, with its value where it has one."""
    today = today or timezone.localdate()
    week_ago = today - timedelta(days=7)
    if athlete.records.filter(date__gt=week_ago).exists():
        return "pr", None
    expected = expected_sessions(athlete, week_ago, today - timedelta(days=1))
    if expected:
        done = set(athlete.workouts.filter(date__in=expected, status__in=["completed", "partial"]).values_list("date", flat=True))
        missed = len([d for d in expected if d not in done])
        if missed:
            return "missed", missed
    checkin = athlete.recovery.filter(date__gte=today - timedelta(days=2)).exclude(soreness=None).first()
    if checkin and checkin.soreness >= 7:
        return "soreness", checkin.soreness
    nut = nutrition_pct(athlete, today=today)
    if nut is not None and nut < 60:
        return "nutrition", nut
    change = strength_change_pct(athlete, today=today)
    if change is not None and change <= -5:
        return "down", change
    return None, None


def athlete_stats(athlete: Athlete) -> dict:
    flag, value = attention(athlete)
    out = {"adherence_pct": adherence_pct(athlete), "strength_change_pct": strength_change_pct(athlete)}
    if flag:
        out["flag"] = flag
        if value is not None:
            out["flag_value"] = value
    return out
