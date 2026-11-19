"""Regression tests for GitHub issues #47–#54."""

from datetime import timedelta

import pytest
from django.utils import timezone

from coaching import analytics
from coaching import models as cm
from tracking import models as tm
from training.models import WorkoutLog

pytestmark = pytest.mark.django_db


def _food(kcal):
    return [{"name": "x", "grams": 100, "kcalPer100g": kcal}]


def test_nutrition_plan_has_a_menu_per_weekday(api, coach, athlete):
    """#47: meals can be served on some weekdays only; the athlete's day shows that day's menu."""
    plan = {
        "targets": {"kcal": 2500, "protein": 150, "carbs": 280, "fat": 70, "waterL": 2.5},
        "meals": [
            {"name": "صبحانه", "foods": _food(500)},  # every day
            {"name": "ناهار", "days": ["sat", "sun", "mon", "tue", "wed", "thu"], "foods": _food(800)},
            {"name": "ناهار جمعه", "days": ["fri", "fri"], "foods": _food(600)},
            {"name": "هر روز", "days": ["sat", "sun", "mon", "tue", "wed", "thu", "fri"], "foods": _food(100)},
        ],
    }
    api.as_user(coach.user)
    r = api.put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json").json()
    assert [m["days"] for m in r["meals"]] == [[], ["sat", "sun", "mon", "tue", "wed", "thu"], ["fri"], []]
    assert r["dayTotals"]["fri"]["kcal"] == 1200 and r["dayTotals"]["sat"]["kcal"] == 1400
    assert r["totals"]["kcal"] == round((1400 * 6 + 1200) / 7, 1)
    bad = {**plan, "meals": [{"name": "x", "days": ["xyz"], "foods": []}]}
    assert api.put(f"/api/nutrition-plans/{athlete.pk}/", bad, format="json").status_code == 400

    api.as_user(athlete.user)
    friday = [m["name"] for m in api.get("/api/me/nutrition/?date=2026-09-25").json()["meals"]]  # a Friday
    saturday = [m["name"] for m in api.get("/api/me/nutrition/?date=2026-09-26").json()["meals"]]
    assert friday == ["صبحانه", "ناهار جمعه", "هر روز"]
    assert saturday == ["صبحانه", "ناهار", "هر روز"]
    # a meal already logged that day stays visible even if the coach moved it to another day
    lunch = r["meals"][1]["id"]
    api.post("/api/meal-logs/", {"mealId": lunch, "date": "2026-09-25", "status": "followed"})
    assert "ناهار" in [m["name"] for m in api.get("/api/me/nutrition/?date=2026-09-25").json()["meals"]]


def test_coach_adds_custom_and_watch_checkin_fields(api, coach, athlete):
    """#53: the coach adds their own check-in questions and optional watch numbers; the athlete answers them."""
    api.as_user(coach.user)
    fields = [{"key": "c_mood", "label": "حال و انگیزه", "kind": "scale"}, {"key": "c_pain", "label": "درد زانو", "kind": "yesno"}]
    r = api.put(f"/api/recovery-plans/{athlete.pk}/", {"checks": ["sleep", "soreness", "hrv", "rhr"], "customFields": fields}, format="json")
    assert r.status_code == 200 and [f["key"] for f in r.json()["customFields"]] == ["c_mood", "c_pain"]
    dup = api.put(f"/api/recovery-plans/{athlete.pk}/", {"customFields": [fields[0], fields[0]]}, format="json")
    bad = api.put(f"/api/recovery-plans/{athlete.pk}/", {"customFields": [{"key": "Bad Key", "label": "x", "kind": "scale"}]}, format="json")
    assert dup.status_code == 400 and bad.status_code == 400

    api.as_user(athlete.user)
    day = timezone.localdate().isoformat()
    body = {"date": day, "sleepHours": 7, "soreness": 3, "hrvMs": 62, "restingHr": 52, "extra": {"c_mood": 8, "c_pain": False}}
    assert api.post("/api/recovery/", body, format="json").status_code in (200, 201)
    c = tm.RecoveryCheckIn.objects.get(athlete=athlete)
    assert c.hrv_ms == 62 and c.extra == {"c_mood": 8, "c_pain": False}

    api.as_user(coach.user)
    rec = api.get(f"/api/athletes/{athlete.pk}/analytics/", {"section": "recovery"}).json()
    assert [f["key"] for f in rec["customFields"]] == ["c_mood", "c_pain"]


def _session(athlete, days_ago, minutes, rpe):
    day = timezone.localdate() - timedelta(days=days_ago)
    return WorkoutLog.objects.update_or_create(athlete=athlete, date=day, defaults={"status": "completed", "duration_min": minutes, "rpe": rpe})[0]


def test_fitness_fatigue_form_and_training_status(athlete):
    """#54 (Strava Fitness & Freshness / TrainingPeaks PMC): 42-day fitness, 7-day fatigue and form."""
    for d in range(1, 60, 2):
        _session(athlete, d, 60, 7)
    pmc = analytics.fitness_fatigue(athlete, days=60)
    last = pmc[-1]
    assert len(pmc) == 60 and last["fitness"] > 0 and last["fatigue"] > 0
    prev = pmc[-2]  # form (TSB) is yesterday's fitness − fatigue, as in TrainingPeaks
    assert last["form"] == pytest.approx(prev["fitness"] - prev["fatigue"], abs=0.2)
    assert analytics.training_status(pmc)["status"] in {"productive", "maintaining", "recovery", "detraining", "overreaching"}
    # a hard block the last week → fatigue well above fitness → overreaching
    for d in range(0, 7):
        _session(athlete, d, 150, 10)
    assert analytics.training_status(analytics.fitness_fatigue(athlete, days=60))["status"] == "overreaching"


def test_readiness_uses_checkin_and_watch_baselines(athlete):
    """#54 (Garmin Training Readiness): today's HRV/RHR against the 7-day baseline, sleep and soreness."""
    today = timezone.localdate()
    for d in range(1, 8):
        tm.RecoveryCheckIn.objects.create(athlete=athlete, date=today - timedelta(days=d), sleep_hours=8, soreness=2, hrv_ms=70, resting_hr=50)
    tm.RecoveryCheckIn.objects.create(athlete=athlete, date=today, sleep_hours=8, soreness=2, hrv_ms=72, resting_hr=50)
    good = analytics.readiness(athlete, analytics.fitness_fatigue(athlete))
    tm.RecoveryCheckIn.objects.filter(athlete=athlete, date=today).update(sleep_hours=4, soreness=9, hrv_ms=45, resting_hr=62)
    bad = analytics.readiness(athlete, analytics.fitness_fatigue(athlete))
    assert good["score"] > bad["score"] and good["level"] in {"prime", "high"} and bad["level"] in {"low", "moderate"}
    assert {"sleep", "hrv", "rhr", "soreness"} <= {f["key"] for f in good["factors"]}


def test_coach_designed_tests_show_on_the_performance_board(api, coach, athlete):
    """#54: the coach designs any test (unit, direction, protocol) and sees latest, best and trend."""
    api.as_user(coach.user)
    r = api.post("/api/tests/", {"name": "شاتل ران", "category": "agi", "unit": "level", "better": "higher", "protocol": "بیپ تست ۲۰ متر"}, format="json")
    assert r.status_code == 201 and r.json()["protocol"] == "بیپ تست ۲۰ متر"
    t = cm.TestDefinition.objects.get(pk=r.json()["id"])
    today = timezone.localdate()
    for i, v in enumerate([6.5, 7.2, 7.0]):
        tm.TestResult.objects.create(athlete=athlete, test=t, value=v, date=today - timedelta(days=30 * (2 - i)))
    cm.TestDefinition.objects.create(coach=coach, name="بدون نتیجه", unit="s", better="lower")
    perf = api.get(f"/api/athletes/{athlete.pk}/analytics/", {"section": "performance"}).json()
    row = next(b for b in perf["tests"] if b["name"] == "شاتل ران")
    assert row["latest"]["value"] == 7.0 and row["best"]["value"] == 7.2 and row["count"] == 3
    assert row["changePct"] == pytest.approx(7.7, abs=0.1) and row["improved"] is True and row["protocol"]
    empty = next(b for b in perf["tests"] if b["name"] == "بدون نتیجه")
    assert empty["latest"] is None and empty["improved"] is None
    assert {"pmc", "readiness", "status", "consistency"} <= perf.keys()


def test_program_sport_and_exercise_own_image(api, coach):
    """#37: programs carry a sport; #48: the coach's own picture wins over the library one and can be removed."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    from training.models import Exercise

    api.as_user(coach.user)
    p = api.post("/api/programs/", {"name": "۵ کیلومتر", "sport": "running", "durationWeeks": 4, "sessionsPerWeek": 3, "weeks": []}, format="json")
    assert p.status_code == 201 and p.json()["sport"] == "running"
    ex = Exercise.objects.create(coach=coach, name="اسکوات", category="strength", stock_image="library/squat.jpg")
    assert api.get(f"/api/exercises/{ex.pk}/").json()["hasOwnImage"] is False
    ex.image = SimpleUploadedFile("mine.png", b"x")
    ex.save()
    assert api.get(f"/api/exercises/{ex.pk}/").json()["hasOwnImage"] is True
    after = api.patch(f"/api/exercises/{ex.pk}/", {"removeImage": True}, format="json").json()
    assert after["hasOwnImage"] is False and "/media/library/" in after["imageSrc"]  # back to the library picture
