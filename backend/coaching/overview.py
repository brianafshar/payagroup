from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from . import stats
from .models import Athlete


def athlete_overview(a: Athlete) -> dict:
    """C12 overview: today's session, adherence (training / nutrition / recovery), latest PR,
    the strength trend of the most-trained lift (monthly best estimated 1RM) and body weight."""
    from training.models import LoggedSet, first_int
    from training.services import session_for

    today = timezone.localdate()
    s = session_for(a, today)
    log = a.workouts.filter(date=today).prefetch_related("sets").first()
    sets = list(log.sets.all()) if log else []
    day = s["day"] or {}
    planned_sets = sum(len(x.get("sets", [])) for x in day.get("exercises", []))
    today_block = {
        "focus": (log.focus if log and log.focus else day.get("focus", "")),
        "week": s["week"],
        "rest": not day or bool(day.get("rest")),
        "status": log.status if log else ("rest" if not day or day.get("rest") else "planned"),
        "exercises": len(day.get("exercises", [])),
        "sets_done": sum(1 for x in sets if x.done),
        "sets_total": len(sets) or planned_sets,
        "started_at": log.started_at if log else None,
    }
    checkins = a.recovery.filter(date__gt=today - timedelta(days=30)).count()
    pr = a.records.select_related("exercise").first()
    year_ago = today - timedelta(days=365)
    base = LoggedSet.objects.filter(log__athlete=a, done=True, unit="kg", log__date__gt=year_ago)
    top = base.values("exercise_id", "exercise__name").annotate(n=Count("id")).order_by("-n").first()
    strength = None
    if top:
        best: dict[str, float] = {}
        for x in base.filter(exercise_id=top["exercise_id"]).select_related("log"):
            reps, w = x.reps or first_int(x.target_reps), x.weight
            if not reps or not w:
                continue
            month = x.log.date.replace(day=1).isoformat()
            best[month] = max(best.get(month, 0), round(w * (1 + reps / 30), 1))
        months = sorted(best)
        strength = {"exercise": top["exercise__name"], "labels": months, "values": [best[m] for m in months]}
    weights = list(a.measurements.filter(metric="weight").order_by("-date", "-id").values("date", "value")[:8])[::-1]
    return {
        "today": today_block,
        "adherence": {
            "training": stats.adherence_pct(a, today=today),
            "nutrition": stats.nutrition_pct(a, days=30, today=today),
            "recovery": round(100 * checkins / 30) if checkins else None,
        },
        "record": {"exercise": pr.exercise.name, "type": pr.type, "value": pr.value, "unit": pr.unit, "previous": pr.previous, "date": pr.date} if pr else None,
        "records_count": a.records.count(),
        "strength": strength,
        "weight": weights,
    }


def athlete_progress(a: Athlete, days: int = 180) -> dict:
    """M43: adherence over `days` and the monthly best estimated 1RM (Epley) of the three most-trained lifts."""
    from training.models import LoggedSet, first_int

    today = timezone.localdate()
    since = today - timedelta(days=days)
    checkins = a.recovery.filter(date__gt=since).count()
    base = LoggedSet.objects.filter(log__athlete=a, done=True, unit="kg", log__date__gt=today - timedelta(days=max(240, days)))
    top = list(base.values("exercise_id", "exercise__name").annotate(n=Count("id")).order_by("-n")[:3])
    lifts = []
    for t in top:
        best: dict[str, float] = {}
        for x in base.filter(exercise_id=t["exercise_id"]).select_related("log"):
            reps, w = x.reps or first_int(x.target_reps), x.weight
            if reps and w:
                m = x.log.date.replace(day=1).isoformat()
                best[m] = max(best.get(m, 0), round(w * (1 + reps / 30), 1))
        months = sorted(best)
        lifts.append({"exercise_id": t["exercise_id"], "name": t["exercise__name"], "labels": months, "values": [best[m] for m in months]})
    return {
        "adherence": {
            "training": stats.adherence_pct(a, days=days, today=today),
            "nutrition": stats.nutrition_pct(a, days=days, today=today),
            "recovery": round(100 * checkins / days) if checkins else None,
        },
        "lifts": lifts,
    }
