"""Coach analytics for one athlete (C26–C30), computed from logged data only.

`GET /api/athletes/{id}/analytics/?section=overview|strength|endurance|body|recovery&days=N`.
Values that can't be computed are `None` («ثبت نشده») — never estimated or filled in.
"""

import math
from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from .models import Athlete, TestDefinition

EPLEY_MAX_REPS = 12


def epley(weight: float, reps: int) -> float:
    """Estimated 1RM (Epley). A single is its own 1RM."""
    return round(weight if reps <= 1 else weight * (1 + reps / 30), 1)


def _pct(a: float | None, b: float | None) -> float | None:
    return round((b - a) / a * 100, 1) if a and b is not None else None


def _done_sets(a: Athlete, since: date, until: date):
    from training.models import LoggedSet

    return LoggedSet.objects.filter(log__athlete=a, done=True, log__date__gte=since, log__date__lte=until).select_related("exercise", "log")


def _session_score(logs) -> int | None:
    """Training adherence: completed 100 %, partial 50 %, missed 0 over the logged sessions."""
    counted = [x for x in logs if x in ("completed", "partial", "missed")]
    if not counted:
        return None
    return round(100 * sum(1 if x == "completed" else 0.5 if x == "partial" else 0 for x in counted) / len(counted))


def _training(a: Athlete, since: date, until: date) -> int | None:
    return _session_score(list(a.workouts.filter(date__gte=since, date__lte=until).values_list("status", flat=True)))


def _nutrition(a: Athlete, since: date, until: date) -> int | None:
    from tracking.models import MealLog

    logs = list(MealLog.objects.filter(athlete=a, date__gte=since, date__lte=until).values_list("status", flat=True))
    if not logs:
        return None
    return round(100 * sum(MealLog.FACTOR[s] for s in logs) / len(logs))


def _recovery(a: Athlete, since: date, until: date) -> int | None:
    days = (until - since).days + 1
    n = a.recovery.filter(date__gte=since, date__lte=until).count()
    return round(100 * n / days) if days > 0 and n else None


def _buckets(since: date, until: date, n: int = 6) -> list[tuple[date, date]]:
    span = max(1, (until - since).days + 1)
    step = span / n
    out = []
    for i in range(n):
        a = since + timedelta(days=round(i * step))
        b = since + timedelta(days=round((i + 1) * step) - 1)
        out.append((a, max(a, b)))
    return out


def _adherence(fn, a: Athlete, since: date, until: date, days: int) -> dict:
    prev = fn(a, since - timedelta(days=days), since - timedelta(days=1))
    cur = fn(a, since, until)
    return {"value": cur, "previous": prev, "spark": [fn(a, x, y) for x, y in _buckets(since, until)]}


def _best_by_exercise(sets) -> dict:
    """exercise_id → {name, category, best: (e1rm, date)}; kg sets with 1–12 reps."""
    best: dict = {}
    for s in sets:
        w, reps = s.weight, s.reps
        if s.unit != "kg" or not w or not reps or reps > EPLEY_MAX_REPS:
            continue
        e = epley(w, reps)
        cur = best.get(s.exercise_id)
        if cur is None or e > cur["e1rm"]:
            best[s.exercise_id] = {"exercise_id": s.exercise_id, "name": s.exercise.name, "category": s.exercise.category, "e1rm": e, "date": s.log.date}
    return best


def main_lifts(a: Athlete, since: date, until: date, n: int = 3) -> list[int]:
    """The athlete's most-trained kg exercises in the window (by done sets that carried a load)."""
    rows = (
        _done_sets(a, since, until)
        .filter(unit="kg")
        .filter(Q(actual_value__gt=0) | Q(actual_value__isnull=True, target_value__gt=0))
        .values("exercise_id")
        .annotate(c=Count("id"))
        .order_by("-c", "exercise_id")[:n]
    )
    return [r["exercise_id"] for r in rows]


def key_lifts(a: Athlete) -> list[int]:
    """The lifts the coach picked for this athlete's strength analytics (that still exist), in order."""
    from training.models import Exercise

    ids = [i for i in (a.key_lifts or []) if isinstance(i, int)]
    have = set(Exercise.objects.filter(pk__in=ids).values_list("pk", flat=True))
    return [i for i in ids if i in have]


def weekly_volume(a: Athlete, until: date, weeks: int = 12) -> list[dict]:
    """Tonnes lifted per Saturday-first week, oldest first."""
    start = until - timedelta(days=(until.weekday() - 5) % 7) - timedelta(weeks=weeks - 1)
    totals = defaultdict(float)
    for s in _done_sets(a, start, until).filter(unit="kg"):
        if s.weight and s.reps:
            totals[(s.log.date - start).days // 7] += s.weight * s.reps
    return [{"week_start": start + timedelta(weeks=i), "tonnes": round(totals[i] / 1000, 2)} for i in range(weeks)]


def overview(a: Athlete, days: int) -> dict:
    from tracking.models import TestResult

    today = timezone.localdate()
    since = today - timedelta(days=days - 1)
    lifts = []
    ids = main_lifts(a, since, today)
    sets = list(_done_sets(a, since, today).filter(exercise_id__in=ids))
    for ex_id in ids:
        mine = [s for s in sets if s.exercise_id == ex_id]
        by_day = defaultdict(list)
        for s in mine:
            by_day[s.log.date].append(s)
        dates = sorted(by_day)
        first = _best_by_exercise(by_day[dates[0]]).get(ex_id)
        last = _best_by_exercise(by_day[dates[-1]]).get(ex_id)
        if first and last:
            lifts.append(
                {
                    "exercise_id": ex_id,
                    "name": first["name"],
                    "first": first["e1rm"],
                    "first_date": first["date"],
                    "current": last["e1rm"],
                    "current_date": last["date"],
                }
            )
    statuses = list(a.workouts.filter(date__gte=since, date__lte=today).values_list("status", flat=True))
    latest_tests = []
    for cat in ("pow", "spd", "mob", "agi"):
        r = TestResult.objects.filter(athlete=a, test__category=cat).select_related("test").first()
        latest_tests.append(
            {"category": cat, **({"test_id": r.test_id, "name": r.test.name, "value": r.value, "unit": r.test.unit, "date": r.date} if r else {})}
        )
    return {
        "days": days,
        "since": since,
        "adherence": {
            "training": _adherence(_training, a, since, today, days),
            "nutrition": _adherence(_nutrition, a, since, today, days),
            "recovery": _adherence(_recovery, a, since, today, days),
        },
        "lifts": lifts,
        "sessions": {s: statuses.count(s) for s in ("completed", "partial", "missed")},
        "volume": weekly_volume(a, today, 12 if days > 31 else 4),
        "tests": latest_tests,
    }


def _months(until: date, n: int) -> list[date]:
    out = []
    y, m = until.year, until.month
    for _ in range(n):
        out.append(date(y, m, 1))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return out[::-1]


def strength(a: Athlete) -> dict:
    from training.models import PersonalRecord

    today = today_ = timezone.localdate()
    months = _months(today, 12)
    start = months[0]
    from training.models import Exercise

    chosen = key_lifts(a)
    ids = chosen or main_lifts(a, start, today, n=4)
    names = dict(Exercise.objects.filter(pk__in=ids).values_list("pk", "name"))
    sets = list(_done_sets(a, start, today).filter(exercise_id__in=ids))
    lifts = []
    for ex_id in ids:
        mine = [s for s in sets if s.exercise_id == ex_id]
        monthly = []
        for m in months:
            nxt = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
            best = _best_by_exercise([s for s in mine if m <= s.log.date < nxt]).get(ex_id)
            monthly.append(best["e1rm"] if best else None)
        # Tested maxes: 1RM records, placed on their month.
        tested = []
        for r in PersonalRecord.objects.filter(athlete=a, exercise_id=ex_id, type="1RM", date__gte=start).order_by("date", "id"):
            tested.append({"id": r.pk, "month": sum(1 for m in months if m <= r.date) - 1, "value": r.value, "date": r.date})
        # Heaviest load for at least k reps, from logged sets and the coach's tested records.
        manual = list(PersonalRecord.objects.filter(athlete=a, exercise_id=ex_id, type__in=["1RM", "3RM", "5RM"], unit="kg"))
        rm = {}
        for k in (1, 3, 5):
            ws = [s.weight for s in mine if s.weight and s.reps and s.reps >= k and s.unit == "kg"]
            ws += [r.value for r in manual if int(r.type[:-2]) >= k]
            rm[f"rm{k}"] = max(ws) if ws else None
        # First / current: the month's best estimate or tested 1RM, whichever is higher.
        per_month = list(monthly)
        for t in tested:
            i = t["month"]
            per_month[i] = max(per_month[i] or 0, t["value"])
        vals = [v for v in per_month if v is not None]
        lifts.append(
            {
                "exercise_id": ex_id,
                "name": names.get(ex_id, ""),
                "monthly": monthly,
                "tested": tested,
                "first": vals[0] if vals else None,
                "current": vals[-1] if vals else None,
                **rm,
            }
        )
    # Volume per muscle group: previous 30 days vs the last 30.
    muscles = defaultdict(lambda: [0.0, 0.0])
    for s in _done_sets(a, today_ - timedelta(days=59), today_).filter(unit="kg"):
        if s.weight and s.reps:
            muscles[s.exercise.category][0 if s.log.date <= today_ - timedelta(days=30) else 1] += s.weight * s.reps / 1000
    weight = a.measurements.filter(metric="weight").order_by("-date", "-id").first()
    prs = PersonalRecord.objects.filter(athlete=a).select_related("exercise").order_by("-date", "-id")[:3]
    # Hard sets per muscle group this week (10–20 is the usual hypertrophy range) and average effort.
    week_sets = defaultdict(int)
    for s in _done_sets(a, today_ - timedelta(days=6), today_).exclude(unit__in=["km", "m", "min", "s"]):
        week_sets[s.exercise.category] += 1
    rpes = list(a.workouts.filter(date__gt=today_ - timedelta(days=28), rpe__isnull=False).values_list("rpe", flat=True))
    # Muscle freshness (as recovery heat maps): days since each group was last trained and sets in 7 days.
    last = {}
    for s in _done_sets(a, today_ - timedelta(days=13), today_).exclude(unit__in=["km", "m", "min", "s"]).order_by("log__date"):
        last[s.exercise.category] = s.log.date
    fresh = [{"category": k, "days_since": (today_ - d).days, "sets_7d": week_sets.get(k, 0)} for k, d in sorted(last.items())]
    return {
        "bands": band_progress(a, start, today_),
        "weekly_tonnes": weekly_volume(a, today_, 12),
        "freshness": fresh,
        "relative": [
            {"exercise_id": x["exercise_id"], "name": x["name"], "e1rm": x["current"], "ratio": round(x["current"] / weight.value, 2)}
            for x in lifts
            if x["current"] and weight and weight.value
        ],
        "week_sets": [{"category": k, "sets": v} for k, v in sorted(week_sets.items(), key=lambda kv: -kv[1])],
        "avg_rpe": round(sum(rpes) / len(rpes), 1) if rpes else None,
        "sessions_28d": a.workouts.filter(date__gt=today_ - timedelta(days=28), status__in=["completed", "partial"]).count(),
        "months": months,
        "key_lifts": ids,
        "key_lifts_custom": bool(chosen),
        "body_weight": weight.value if weight else None,
        "lifts": lifts,
        "muscles": [{"category": k, "previous": round(v[0], 2), "current": round(v[1], 2)} for k, v in sorted(muscles.items())],
        "records": [
            {"id": r.pk, "exercise": r.exercise.name, "type": r.type, "value": r.value, "unit": r.unit, "previous": r.previous, "date": r.date} for r in prs
        ],
    }


def band_progress(a: Athlete, since: date, until: date) -> list[dict]:
    """Band exercises (logged as a band level 1 yellow … 5 black, not kilos): each session's best set —
    the highest level, then the most reps — so progress reads as «green × 12 → blue × 10»."""
    per: dict[int, dict] = {}
    for s in _done_sets(a, since, until).filter(unit="band").order_by("log__date", "id"):
        level, reps = int(s.weight or 0), s.reps or 0
        if not level:
            continue
        ex = per.setdefault(s.exercise_id, {"exercise_id": s.exercise_id, "name": s.exercise.name, "sessions": {}})
        best = ex["sessions"].get(s.log.date)
        if best is None or (level, reps) > (best["level"], best["reps"]):
            ex["sessions"][s.log.date] = {"date": s.log.date, "level": level, "reps": reps}
    out = []
    for ex in per.values():
        points = list(ex.pop("sessions").values())
        out.append({**ex, "points": points, "first": points[0], "current": points[-1]})
    return sorted(out, key=lambda x: -len(x["points"]))


def max_hr(a: Athlete) -> int | None:
    """Measured max HR, else Tanaka's estimate from age (208 − 0.7 × age)."""
    if a.max_hr:
        return a.max_hr
    if a.birth_date:
        age = (timezone.localdate() - a.birth_date).days / 365.25
        return round(208 - 0.7 * age)
    return None


def vdot(distance_m: float, minutes: float) -> float | None:
    """Daniels & Gilbert VO₂max estimate from a race-like effort (≥ 1.5 km, 3.5–240 min)."""
    if distance_m < 1500 or not 3.5 <= minutes <= 240:
        return None
    v = distance_m / minutes  # m/min
    vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v
    frac = 0.8 + 0.1894393 * math.exp(-0.012778 * minutes) + 0.2989558 * math.exp(-0.1932605 * minutes)
    return round(vo2 / frac, 1)


RACES = [("5k", 5.0), ("10k", 10.0), ("half", 21.0975), ("marathon", 42.195)]
# Heart-rate zones as % of max HR (Garmin's default 50/60/70/80/90).
ZONES = [0.5, 0.6, 0.7, 0.8, 0.9]


def _run_distance(log) -> float | None:
    """Session distance: what the athlete entered, else the distance sets they ticked."""
    if log.distance_km:
        return log.distance_km
    km = sum((s.weight or 0) * (0.001 if s.unit == "m" else 1) for s in log.sets.all() if s.done and s.unit in ("km", "m"))
    return round(km, 2) or None


def running(a: Athlete, days: int = 90) -> dict:
    """Garmin-style running summary from logged sessions: weekly distance, pace, load (acute:chronic),
    heart-rate zones, VO₂max (VDOT) and race predictions (Riegel)."""
    today = timezone.localdate()
    logs = list(
        a.workouts.filter(date__gt=today - timedelta(days=max(days, 42)), status__in=["completed", "partial"]).prefetch_related("sets").order_by("date")
    )
    runs = []
    for x in logs:
        km = _run_distance(x)
        if not km:
            continue
        pace = round(x.duration_min / km, 2) if x.duration_min else None  # min/km
        runs.append({"id": x.pk, "date": x.date, "focus": x.focus, "km": km, "minutes": x.duration_min, "pace": pace,
                     "avg_hr": x.avg_hr, "max_hr": x.max_hr, "cadence": x.cadence_spm, "elevation": x.elevation_m, "rpe": x.rpe,
                     "aerobic_te": x.aerobic_te, "anaerobic_te": x.anaerobic_te, "lt_hr": x.lt_hr, "lt_pace": x.lt_pace})  # fmt: skip
    # Weekly distance/time, Saturday-first weeks, last 12.
    start = today - timedelta(days=(today.weekday() - 5) % 7) - timedelta(weeks=11)
    weeks = [{"week_start": start + timedelta(weeks=i), "km": 0.0, "minutes": 0, "runs": 0} for i in range(12)]
    for r in runs:
        i = (r["date"] - start).days // 7
        if 0 <= i < 12:
            weeks[i]["km"] = round(weeks[i]["km"] + r["km"], 2)
            weeks[i]["minutes"] += r["minutes"] or 0
            weeks[i]["runs"] += 1

    # Session load (Foster): minutes × RPE. Acute = last 7 days, chronic = weekly average of the last 28.
    def load(since):
        return sum((x.duration_min or 0) * (x.rpe or 0) for x in logs if x.date > since)

    acute, chronic = load(today - timedelta(days=7)), load(today - timedelta(days=28)) / 4
    ratio = round(acute / chronic, 2) if chronic else None
    status = None if ratio is None else "low" if ratio < 0.8 else "optimal" if ratio <= 1.3 else "high" if ratio <= 1.5 else "very_high"
    # Minutes per heart-rate zone (each run counted in the zone of its average HR).
    hr_max = max_hr(a)
    zones = [0] * 5
    if hr_max:
        for r in runs:
            if r["avg_hr"] and r["minutes"]:
                pct = r["avg_hr"] / hr_max
                z = max([i for i, lo in enumerate(ZONES) if pct >= lo], default=0)
                zones[z] += r["minutes"]
    # Best effort (fastest run of ≥ 3 km in the window) → VO₂max and race predictions.
    recent = [r for r in runs if r["date"] > today - timedelta(days=days) and r["minutes"] and r["km"] >= 3]
    best = min(recent, key=lambda r: r["minutes"] / r["km"], default=None)
    predictions = []
    if best:
        for key, km in RACES:
            predictions.append({"race": key, "km": km, "minutes": round(best["minutes"] * (km / best["km"]) ** 1.06, 1)})
    window = [r for r in runs if r["date"] > today - timedelta(days=days)]
    paced = [r for r in window if r["pace"]]
    # Best efforts (Strava): fastest pace among runs at least that long, as the equivalent time.
    best_efforts = []
    for key, km in (("1k", 1.0), ("5k", 5.0), ("10k", 10.0), ("half", 21.0975)):
        fit = [r for r in paced if r["km"] >= km]
        if fit:
            b = min(fit, key=lambda r: r["pace"])
            best_efforts.append({"race": key, "km": km, "minutes": round(b["pace"] * km, 1), "date": b["date"], "run_km": b["km"]})
    # Load focus (Garmin): minutes in low aerobic (zones 1–2), high aerobic (3–4) and anaerobic (5).
    focus = {"low_aerobic": sum(zones[:2]), "high_aerobic": sum(zones[2:4]), "anaerobic": zones[4]}
    # Monthly distance, last 6 months (oldest first).
    months = []
    for i in range(5, -1, -1):
        m = date(today.year, today.month, 1)
        for _ in range(i):
            m = date(m.year - (m.month == 1), (m.month - 2) % 12 + 1, 1)
        nxt = date(m.year + (m.month == 12), m.month % 12 + 1, 1)
        months.append({"month": m, "km": round(sum(r["km"] for r in runs if m <= r["date"] < nxt), 1)})
    for r in window:  # stride length (m) = speed ÷ cadence
        r["stride_m"] = round((1000 / r["pace"]) / r["cadence"], 2) if r["pace"] and r["cadence"] else None
    cad = [r["cadence"] for r in window if r["cadence"]]
    return {
        "days": days,
        "runs": window[-30:],
        "weeks": weeks,
        "totals": {
            "km_7d": round(sum(r["km"] for r in runs if r["date"] > today - timedelta(days=7)), 1),
            "km_30d": round(sum(r["km"] for r in runs if r["date"] > today - timedelta(days=30)), 1),
            "runs_30d": sum(1 for r in runs if r["date"] > today - timedelta(days=30)),
            "longest_km": max((r["km"] for r in window), default=None),
            "avg_pace": round(sum(r["minutes"] for r in paced) / sum(r["km"] for r in paced), 2) if paced else None,
            "best_pace": min((r["pace"] for r in paced), default=None),
            "avg_cadence": round(sum(cad) / len(cad)) if cad else None,
            "elevation_30d": sum(r["elevation"] or 0 for r in runs if r["date"] > today - timedelta(days=30)) or None,
        },
        "load": {"acute": acute, "chronic": round(chronic), "ratio": ratio, "status": status},
        "hr": {"max": hr_max, "estimated": not a.max_hr, "zones": zones},
        "vo2max": vdot(best["km"] * 1000, best["minutes"]) if best else None,
        "best": best,
        "predictions": predictions,
        "best_efforts": best_efforts,
        "load_focus": focus,
        "months": months,
    }


def endurance(a: Athlete) -> dict:
    from tracking.models import TestResult
    from training.models import LoggedSet

    today = timezone.localdate()
    tests = defaultdict(list)
    for r in TestResult.objects.filter(athlete=a, test__category__in=["spd", "end"]).select_related("test").order_by("date", "id"):
        tests[r.test_id].append(r)
    series = [
        {
            "test_id": tid,
            "name": rs[0].test.name,
            "unit": rs[0].test.unit,
            "better": rs[0].test.better,
            "category": rs[0].test.category,
            "results": [{"id": r.pk, "value": r.value, "date": r.date, "note": r.note} for r in rs],
        }
        for tid, rs in tests.items()
    ]
    # Cardio sessions: workouts with a conditioning exercise.
    cardio_ids = set(
        LoggedSet.objects.filter(
            log__athlete=a, exercise__category__in=["conditioning", "run", "drill"], log__date__gte=today - timedelta(days=90)
        ).values_list("log_id", flat=True)
    )
    logs = list(a.workouts.filter(pk__in=cardio_ids).order_by("-date"))
    rhr = list(a.recovery.filter(resting_hr__isnull=False, date__gte=today - timedelta(days=100)).order_by("date").values_list("date", "resting_hr"))
    recent = [v for d, v in rhr if d > today - timedelta(days=14)]
    old = [v for d, v in rhr if d <= today - timedelta(days=76)]
    longest = max(logs, key=lambda x: x.duration_min or 0, default=None)
    return {
        "tests": series,
        "sessions": [
            {"id": x.pk, "date": x.date, "focus": x.focus, "duration_min": x.duration_min, "avg_hr": x.avg_hr, "rpe": x.rpe, "note": x.athlete_note}
            for x in logs
            if x.date > today - timedelta(days=30)
        ],
        "longest": {"duration_min": longest.duration_min, "focus": longest.focus, "date": longest.date} if longest and longest.duration_min else None,
        "resting_hr": {"current": round(sum(recent) / len(recent)) if recent else None, "previous": round(sum(old) / len(old)) if old else None},
        "running": running(a),
    }


def body(a: Athlete) -> dict:
    rows = defaultdict(dict)
    by = {}
    for m in a.measurements.order_by("date", "id"):
        rows[m.date][m.metric] = m.value
        by[m.date] = m.recorded_by
    return {
        "goal_weight_kg": a.goal_weight_kg,
        "schedule": a.measure_schedule or (a.coach.preferences or {}).get("m"),
        "custom_schedule": a.measure_schedule is not None,
        "entries": [{"date": d, "recorded_by": by[d], "values": v} for d, v in sorted(rows.items())],
    }


def recovery(a: Athlete, days: int = 14) -> dict:
    from tracking.models import RecoveryPlan

    today = timezone.localdate()
    since = today - timedelta(days=days - 1)
    checkins = {c.date: c for c in a.recovery.filter(date__gte=since - timedelta(days=days), date__lte=today)}
    plan = RecoveryPlan.objects.filter(athlete=a).first()
    rows = []
    for i in range(days):
        d = since + timedelta(days=i)
        c = checkins.get(d)
        rows.append({"date": d, **({k: getattr(c, k) for k in CHECKIN_FIELDS} if c else {}), "extra": (c.extra if c else {})})
    prev = [c.sleep_hours for d, c in checkins.items() if d < since and c.sleep_hours is not None]
    return {
        "days": rows,
        "logged_30d": a.recovery.filter(date__gt=today - timedelta(days=30), date__lte=today).count(),
        "sleep_target": plan.sleep_hours if plan else 8,
        "soreness_alert": plan.soreness_alert if plan else 8,
        "previous_sleep": round(sum(prev) / len(prev), 1) if prev else None,
        "custom_fields": plan.custom_fields if plan else [],
        "checks": plan.checks if plan else list(RecoveryPlan.CHECKS),
    }


CHECKIN_FIELDS = (
    "sleep_hours",
    "sleep_quality",
    "energy",
    "stress",
    "soreness",
    "fatigue",
    "resting_hr",
    "hrv_ms",
    "sleep_score",
    "body_battery",
    "spo2",
    "steps",
)


def _daily_load(a: Athlete, since: date, until: date) -> dict:
    """Session load per day (Foster's sRPE = minutes × RPE; 5 when RPE is missing), all sports."""
    out = defaultdict(float)
    for x in a.workouts.filter(date__gte=since, date__lte=until, status__in=["completed", "partial"]):
        if x.duration_min:
            out[x.date] += x.duration_min * (x.rpe or 5)
    return out


def fitness_fatigue(a: Athlete, days: int = 120) -> list[dict]:
    """Banister impulse-response, as Strava «Fitness & Freshness» / TrainingPeaks PMC: fitness (CTL) is a
    42-day exponentially weighted load, fatigue (ATL) a 7-day one, form (TSB) = yesterday's CTL − ATL.
    Loads are sRPE ÷ 10 so the numbers sit in the familiar 0–150 range."""
    today = timezone.localdate()
    warm = 42 * 2  # history before the window so the averages have settled
    start = today - timedelta(days=days + warm - 1)
    loads = _daily_load(a, start, today)
    ctl = atl = 0.0
    out = []
    for i in range(days + warm):
        d = start + timedelta(days=i)
        form = ctl - atl
        load = loads.get(d, 0) / 10
        ctl += (load - ctl) / 42
        atl += (load - atl) / 7
        if i >= warm:
            out.append({"date": d, "load": round(load, 1), "fitness": round(ctl, 1), "fatigue": round(atl, 1), "form": round(form, 1)})
    return out


def _baseline(values: list, n: int = 7):
    v = [x for x in values[-n:] if x is not None]
    return sum(v) / len(v) if v else None


def readiness(a: Athlete, pmc: list[dict]) -> dict:
    """Garmin-style Training Readiness (0–100) from what's logged this morning — each factor only when
    present: HRV and resting HR against the athlete's 7-day baseline, sleep against the target,
    soreness / fatigue / stress, and form. Returns the score, a level and the factors behind it."""
    from tracking.models import RecoveryPlan

    today = timezone.localdate()
    hist = list(a.recovery.filter(date__gte=today - timedelta(days=21), date__lte=today).order_by("date"))
    c = hist[-1] if hist and hist[-1].date >= today - timedelta(days=1) else None
    if c is None:
        return {"score": None, "level": None, "factors": [], "date": None}
    before = [h for h in hist if h.date < c.date]
    plan = RecoveryPlan.objects.filter(athlete=a).first()
    target = plan.sleep_hours if plan else 8
    factors = []  # (key, 0–100 score, weight, detail)

    def add(key, score, weight, detail):
        factors.append({"key": key, "score": max(0, min(100, round(score))), "weight": weight, "detail": detail})

    if c.sleep_hours is not None:
        add("sleep", 100 * min(1, c.sleep_hours / target) ** 2, 25, {"value": c.sleep_hours, "target": target})
    elif c.sleep_score is not None:
        add("sleep", c.sleep_score, 25, {"score": c.sleep_score})
    base = _baseline([h.hrv_ms for h in before])
    if c.hrv_ms is not None and base:
        add("hrv", 70 + 150 * (c.hrv_ms - base) / base, 25, {"value": c.hrv_ms, "baseline": round(base)})
    base = _baseline([h.resting_hr for h in before])
    if c.resting_hr is not None and base:
        add("rhr", 80 - 8 * (c.resting_hr - base), 15, {"value": c.resting_hr, "baseline": round(base)})
    for k, w in (("soreness", 12), ("fatigue", 12), ("stress", 8)):
        v = getattr(c, k)
        if v is not None:
            add(k, 100 - (v - 1) * 11, w, {"value": v})
    if c.body_battery is not None:
        add("body_battery", c.body_battery, 10, {"value": c.body_battery})
    if pmc:
        form = pmc[-1]["form"]
        add("form", 60 + 3 * form, 15, {"value": form})
    if not factors:
        return {"score": None, "level": None, "factors": [], "date": c.date}
    score = round(sum(f["score"] * f["weight"] for f in factors) / sum(f["weight"] for f in factors))
    level = "prime" if score >= 75 else "high" if score >= 60 else "moderate" if score >= 40 else "low"
    return {"score": score, "level": level, "factors": factors, "date": c.date}


def training_status(pmc: list[dict]) -> dict:
    """Garmin-style status from the fitness trend (7-day CTL change) and the fatigue/fitness balance."""
    if len(pmc) < 8 or not any(p["fitness"] for p in pmc):
        return {"status": None, "fitness_change": None}
    now, week = pmc[-1], pmc[-8]
    change = round(now["fitness"] - week["fitness"], 1)
    ratio = now["fatigue"] / now["fitness"] if now["fitness"] else 0
    if ratio > 1.5:
        status = "overreaching"
    elif change > 1:
        status = "productive"
    elif change < -2 and ratio < 0.8:
        status = "detraining"
    elif change < -1:
        status = "recovery"
    else:
        status = "maintaining"
    return {"status": status, "fitness_change": change}


def consistency(a: Athlete, weeks: int = 12) -> dict:
    """Training calendar (one cell per day, last N weeks) and the streak of weeks that hit the plan."""
    today = timezone.localdate()
    start = today - timedelta(days=(today.weekday() - 5) % 7) - timedelta(weeks=weeks - 1)
    logs = {x.date: x.status for x in a.workouts.filter(date__gte=start, date__lte=today)}
    target = (a.program.sessions_per_week if a.program_id else None) or 3
    days = [{"date": start + timedelta(days=i), "status": logs.get(start + timedelta(days=i))} for i in range((today - start).days + 1)]
    per_week = [sum(1 for d in days[i : i + 7] if d["status"] in ("completed", "partial")) for i in range(0, len(days), 7)]
    streak = 0
    for n in reversed(per_week[:-1]):  # the current week isn't over yet
        if n < target:
            break
        streak += 1
    return {"days": days, "per_week": per_week, "target": target, "streak_weeks": streak}


MAX_DAYS = 3650  # «همه» (all) in the range pickers


def trends(a: Athlete, days: int = 180) -> dict:
    """Progress over time for the athlete app (M43) and coach analytics (#63) as dated points — at most one
    per day — that the charts group by day, week or month themselves. Sums per day for volumes (km,
    minutes, tonnage), daily values otherwise. Aerobic / anaerobic Training Effect and lactate threshold
    are only what the athlete's watch reported for a session; nothing is estimated."""
    from tracking.models import Measurement
    from training.models import Exercise, first_int

    today = timezone.localdate()
    days = min(MAX_DAYS, max(7, days))
    # A long range («همه») starts at the first thing the athlete logged, not years of empty months.
    firsts = [
        a.workouts.order_by("date").values_list("date", flat=True).first(),
        Measurement.objects.filter(athlete=a).order_by("date").values_list("date", flat=True).first(),
    ]
    first = min((d for d in firsts if d), default=today)
    days = max(30, min(days, (today - first).days + 1)) if days > 365 else days
    since = today - timedelta(days=days)
    # In-progress sessions count too: ticked sets are done even before «پایان تمرین».
    logs = list(a.workouts.filter(date__gt=since, status__in=["completed", "partial", "in-progress"]).prefetch_related("sets__exercise").order_by("date"))

    series: dict[str, dict] = defaultdict(dict)  # metric → {date: value}
    groups: dict[str, dict] = defaultdict(lambda: defaultdict(float))  # muscle group → {date: kg}
    sets_by_day: dict[date, int] = defaultdict(int)

    def put(metric, d, v, add=False):
        if v is None:
            return
        cur = series[metric]
        cur[d] = round(cur.get(d, 0) + v, 2) if add else v

    lift_counts: dict[str, int] = defaultdict(int)
    for x in logs:
        km = _run_distance(x)
        if km:
            put("km", x.date, km, add=True)
            if x.duration_min:
                put("run_minutes", x.date, x.duration_min, add=True)
                if km >= 3:
                    put("vo2max", x.date, vdot(km * 1000, x.duration_min))
        for f in ("aerobic_te", "anaerobic_te", "lt_hr", "lt_pace"):
            put(f, x.date, getattr(x, f))
        volume = 0.0
        for st in x.sets.all():
            if not st.done:
                continue
            if st.unit in ("kg", "rep"):
                sets_by_day[x.date] += 1
            if st.unit == "kg" and st.weight:
                reps = st.reps or first_int(st.target_reps)
                kg = st.weight * (reps or 0)
                volume += kg
                groups[st.exercise.category][x.date] += kg
                if reps:
                    key = st.exercise.name
                    lift_counts[key] += 1
                    e1 = round(st.weight * (1 + reps / 30), 1) if reps > 1 else st.weight
                    series["lift:" + key][x.date] = max(series["lift:" + key].get(x.date, 0), e1)
        if volume:
            put("volume_kg", x.date, round(volume), add=True)
    for metric, key in (("weight", "weight"), ("bodyFat", "body_fat")):
        for d, v in Measurement.objects.filter(athlete=a, metric=metric, date__gt=since).order_by("date").values_list("date", "value"):
            put(key, d, v)
    for d, rhr, hrv in a.recovery.filter(date__gt=since).values_list("date", "resting_hr", "hrv_ms"):
        put("resting_hr", d, rhr)
        put("hrv", d, hrv)

    chosen = [n for n in Exercise.objects.filter(pk__in=key_lifts(a)).values_list("pk", "name")]
    if chosen:
        order = {pk: i for i, pk in enumerate(key_lifts(a))}
        top = [name for _, name in sorted(chosen, key=lambda x: order[x[0]])]
        for k in top:
            series.setdefault("lift:" + k, {})
    else:
        top = [k for k, _ in sorted(lift_counts.items(), key=lambda kv: -kv[1])[:3]]
    lifts = {k: series.pop("lift:" + k) for k in top}
    for k in [k for k in series if k.startswith("lift:")]:
        series.pop(k)

    def pts(m):
        return [{"date": d, "value": v} for d, v in sorted(m.items())]

    def latest(metric):
        m = series.get(metric) or {}
        return m[max(m)] if m else None

    w = series.get("weight") or {}
    wd = sorted(w)
    # Strength volume (kg = weight × reps of done sets) per muscle group, biggest first, and the last 7
    # days against the 7 before (rolling, so a Saturday morning isn't an empty week).
    d7 = today - timedelta(days=6)
    weeks = {"current": [0.0, 0], "previous": [0.0, 0]}
    for st in _done_sets(a, d7 - timedelta(days=7), today).filter(unit__in=["kg", "rep"], log__status__in=["completed", "partial", "in-progress"]):
        k = weeks["current" if st.log.date >= d7 else "previous"]
        k[1] += 1
        if st.unit == "kg" and st.weight:
            k[0] += st.weight * (st.reps or 0)
    by_group = sorted(groups.items(), key=lambda kv: -sum(kv[1].values()))
    return {
        "days": days,
        "since": since + timedelta(days=1),
        "series": {k: pts(v) for k, v in series.items()},
        "lifts": [{"name": k, "points": pts(v)} for k, v in lifts.items()],
        "weight": {
            "first": w[wd[0]] if wd else None,
            "last": w[wd[-1]] if wd else None,
            "change": round(w[wd[-1]] - w[wd[0]], 1) if len(wd) > 1 else None,
            "goal": a.goal_weight_kg,
        },
        "volume": {
            "groups": [
                {"category": k, "kg": round(sum(v.values())), "points": [{"date": d, "value": round(x)} for d, x in sorted(v.items())]} for k, v in by_group
            ],
            "sets": [{"date": d, "value": n} for d, n in sorted(sets_by_day.items())],
            "last7": {"kg": round(weeks["current"][0]), "sets": weeks["current"][1]},
            "prev7": {"kg": round(weeks["previous"][0]), "sets": weeks["previous"][1]},
        },
        "watch": {k: latest(k) for k in ("aerobic_te", "anaerobic_te", "lt_hr", "lt_pace")},
        "totals": {"km": round(sum((series.get("km") or {}).values()), 1), "sessions": len(logs), "vo2max": latest("vo2max")},
    }


def test_board(a: Athlete) -> list[dict]:
    """Every test the coach designed (any category), with this athlete's latest, best and trend (#54)."""
    from tracking.models import TestResult

    by_test = defaultdict(list)
    for r in TestResult.objects.filter(athlete=a).order_by("date", "id"):
        by_test[r.test_id].append(r)
    board = []
    for t in TestDefinition.objects.filter(coach=a.coach).order_by("category", "name"):
        rs = by_test.get(t.id, [])
        lower = t.better == TestDefinition.Better.LOWER
        best = (min if lower else max)(rs, key=lambda r: r.value) if rs else None
        first, last = (rs[0], rs[-1]) if rs else (None, None)
        change = None
        if first and last and first is not last and first.value:
            change = round((last.value - first.value) / first.value * 100, 1)
        board.append(
            {
                "test_id": t.id,
                "name": t.name,
                "category": t.category,
                "unit": t.unit,
                "better": t.better,
                "protocol": t.protocol,
                "count": len(rs),
                "latest": {"value": last.value, "date": last.date} if last else None,
                "best": {"value": best.value, "date": best.date} if best else None,
                "change_pct": change,
                # Improvement in the test's own direction: positive = better.
                "improved": None if change is None else (change < 0 if lower else change > 0),
                "points": [{"date": r.date, "value": r.value} for r in rs[-8:]],
            }
        )
    return board


LOAD_ZONES = ((0.8, "low"), (1.3, "optimal"), (1.5, "high"))


def _zone(ratio):
    if ratio is None:
        return None
    return next((z for top, z in LOAD_ZONES if ratio < top), "danger")


def weekly_load(a: Athlete, weeks: int = 12) -> dict:
    """Training load per week against the athlete's own recent normal (#76): the acute:chronic workload
    ratio (this week ÷ the average of the 4 weeks before; Gabbett 2016) with the usual zones — under 0.8
    detraining, 0.8–1.3 the sweet spot, 1.3–1.5 high, over 1.5 a spike that raises injury risk. Load is
    Foster's session RPE (minutes × RPE, 5 when RPE is missing), so every sport counts. Weeks run
    Saturday–Friday; «now» is the last 7 days against the 28 before, so it works mid-week too."""
    today = timezone.localdate()
    week0 = today - timedelta(days=(today.weekday() - 5) % 7)  # this Saturday
    start = week0 - timedelta(weeks=weeks + 3)  # 4 earlier weeks for the first bar's average
    loads = _daily_load(a, start, today)
    timed = a.workouts.filter(date__gt=today - timedelta(days=28), date__lte=today, status__in=["completed", "partial"])
    untimed = timed.filter(duration_min__isnull=True).count()

    def total(since, n):
        return sum(loads.get(since + timedelta(days=i), 0) for i in range(n))

    rows = []
    for i in range(weeks + 4):
        ws = start + timedelta(weeks=i)
        rows.append(
            {
                "start": ws,
                "load": round(total(ws, 7)),
                "sessions": a.workouts.filter(date__gte=ws, date__lt=ws + timedelta(days=7), status__in=["completed", "partial"]).count(),
            }
        )
    out = []
    for i in range(4, len(rows)):
        prev = [r["load"] for r in rows[i - 4 : i]]
        chronic = sum(prev) / 4 if sum(1 for x in prev if x) >= 2 else None
        r = rows[i]
        current = r["start"] == week0
        ratio = round(r["load"] / chronic, 2) if chronic and not current else None
        out.append({**r, "average": round(chronic) if chronic else None, "ratio": ratio, "zone": _zone(ratio), "current": current})

    acute = round(total(today - timedelta(days=6), 7))
    prev28 = total(today - timedelta(days=34), 28)
    chronic = prev28 / 4 if prev28 else None
    ratio = round(acute / chronic, 2) if chronic else None
    # Next 7 days: 0.8–1.3 × the weekly average of the last 4 weeks (including this one).
    base = total(today - timedelta(days=27), 28) / 4
    return {
        "weeks": out,
        "now": {"load": acute, "average": round(chronic) if chronic else None, "ratio": ratio, "zone": _zone(ratio)},
        "next_range": [round(base * 0.8), round(base * 1.3)] if base else None,
        "untimed_sessions": untimed,
    }


def performance(a: Athlete, days: int = 120) -> dict:
    pmc = fitness_fatigue(a, days)
    return {
        "load": weekly_load(a),
        "pmc": pmc,
        "readiness": readiness(a, pmc),
        "status": training_status(pmc),
        "consistency": consistency(a),
        "tests": test_board(a),
    }


SECTIONS = {
    "trends": trends,
    "overview": overview,
    "strength": strength,
    "endurance": endurance,
    "body": body,
    "recovery": recovery,
    "performance": performance,
}
