from datetime import timedelta

import pytest
from django.utils import timezone

from coaching import stats
from training.models import PersonalRecord, WorkoutLog

from .conftest import make_athlete, make_coach

pytestmark = pytest.mark.django_db


def test_today_start_log_and_finish(api, assigned, bench):
    api.as_user(assigned.user)
    today = api.get("/api/me/today/").json()
    assert today["program"]["name"] == "عضله‌سازی ۸ هفته" and today["week"] == 1 and not today["rest"]
    assert len(today["exercises"]) == 2 and today["exercises"][0]["exercise"]["name"] == bench.name
    assert today["log"] is None

    log = api.post("/api/workouts/start/").json()
    assert log["status"] == "in-progress" and len(log["sets"]) == 6
    assert api.post("/api/workouts/start/").json()["id"] == log["id"]  # idempotent
    first = log["sets"][0]
    assert (first["targetReps"], first["targetValue"], first["done"]) == ("8", 70.0, False)

    # tick = done as prescribed; editing only when different
    r = api.patch(f"/api/sets/{first['id']}/", {"done": True})
    assert r.json()["done"] is True and r.json()["actualValue"] is None
    r = api.patch(f"/api/sets/{log['sets'][1]['id']}/", {"done": True, "actualValue": 67.5, "actualReps": "8"})
    assert r.json()["actualValue"] == 67.5 and r.json()["actualReps"] == ""

    summary = api.post(f"/api/workouts/{log['id']}/finish/", {"rpe": 8, "note": "خوب بود"}).json()
    assert summary["done"] == 2 and summary["total"] == 6 and summary["volumeKg"] == 70 * 8 + 67.5 * 8
    assert WorkoutLog.objects.get(pk=log["id"]).status == "partial"
    assert api.get("/api/me/today/").json()["exercises"][0]["sets"][1]["logged"]["actualValue"] == 67.5


def test_pr_detection_and_undo(api, assigned, bench):
    api.as_user(assigned.user)
    # Baseline from an earlier session: 70 kg × 8.
    earlier = WorkoutLog.objects.create(athlete=assigned, date=timezone.localdate() - timedelta(days=7), status="completed")
    earlier.sets.create(exercise=bench, slot=0, index=0, target_reps="8", target_value=70, unit="kg", done=True)

    log = api.post("/api/workouts/start/").json()
    s0, s1 = log["sets"][0]["id"], log["sets"][1]["id"]
    assert api.patch(f"/api/sets/{s0}/", {"done": True}).json()["isPr"] is False  # equal, not better
    r = api.patch(f"/api/sets/{s1}/", {"done": True, "actualValue": 72.5})
    assert r.json()["isPr"] is True
    pr = PersonalRecord.objects.get()
    assert (pr.type, pr.value, pr.previous) == ("8RM", 72.5, 70.0)
    assert api.get("/api/records/").json()["results"][0]["auto"] is True
    # the same load for fewer reps is no record; a heavier one for fewer reps is a new 5RM
    assert api.patch(f"/api/sets/{log['sets'][2]['id']}/", {"done": True, "actualValue": 72.5, "actualReps": "5"}).json()["isPr"] is False
    assert api.patch(f"/api/sets/{log['sets'][2]['id']}/", {"done": True, "actualValue": 75, "actualReps": "5"}).json()["isPr"] is True
    assert api.patch(f"/api/sets/{log['sets'][2]['id']}/", {"done": False}).json()["isPr"] is False

    summary = api.post(f"/api/workouts/{log['id']}/finish/", {}).json()
    assert summary["prs"] == [{"exerciseId": bench.pk, "exerciseName": bench.name, "type": "8RM", "value": 72.5, "previous": 70.0}]

    assert api.patch(f"/api/sets/{s1}/", {"done": False}).json()["isPr"] is False  # undo
    assert not PersonalRecord.objects.exists()


def test_athlete_cannot_touch_others_sets(api, assigned, coach):
    log = api.as_user(assigned.user).post("/api/workouts/start/").json()
    other = make_athlete(coach, "b@x.com", "ب")
    assert api.as_user(other.user).patch(f"/api/sets/{log['sets'][0]['id']}/", {"done": True}).status_code == 404
    # a coach may correct their own athlete's sets, but not another gym's
    assert api.as_user(coach.user).patch(f"/api/sets/{log['sets'][0]['id']}/", {"done": True}).status_code == 200
    outsider = make_coach("other@x.io")
    assert api.as_user(outsider.user).patch(f"/api/sets/{log['sets'][0]['id']}/", {"done": True}).status_code == 404


def test_coach_reads_history_and_gives_feedback(api, assigned, coach):
    log = api.as_user(assigned.user).post("/api/workouts/start/").json()
    api.as_user(coach.user)
    rows = api.get(f"/api/workouts/?athlete={assigned.pk}").json()["results"]
    assert [r["id"] for r in rows] == [log["id"]]
    r = api.post(f"/api/workouts/{log['id']}/feedback/", {"text": "ست آخر را ۶۷٫۵ بزن"})
    assert r.json()["coachFeedback"] == ["ست آخر را ۶۷٫۵ بزن"]
    assert api.post("/api/workouts/start/").status_code == 403


def test_nutrition_day_totals(api, coach, athlete):
    plan = {
        "targets": {"kcal": 2600, "protein": 160, "carbs": 300, "fat": 75, "waterL": 2.5},
        "meals": [
            {"name": "صبحانه", "foods": [{"name": "a", "grams": 100, "kcalPer100g": 600, "proteinPer100g": 40}]},
            {"name": "ناهار", "foods": [{"name": "b", "grams": 200, "kcalPer100g": 400, "proteinPer100g": 30}]},
            {"name": "شام", "foods": [{"name": "c", "grams": 100, "kcalPer100g": 700}]},
        ],
    }
    meals = api.as_user(coach.user).put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json").json()["meals"]
    api.as_user(athlete.user)
    day = "2026-09-25"
    api.post("/api/meal-logs/", {"mealId": meals[0]["id"], "date": day, "status": "followed"})
    api.post("/api/meal-logs/", {"mealId": meals[1]["id"], "date": day, "status": "skipped"})
    api.post("/api/meal-logs/", {"mealId": meals[1]["id"], "date": day, "status": "partial"})  # upsert
    assert api.put("/api/me/water/", {"date": day, "liters": 1.5}).status_code == 200
    r = api.get(f"/api/me/nutrition/?date={day}").json()
    assert [m["status"] for m in r["meals"]] == ["followed", "partial", "unlogged"]
    assert r["eaten"]["kcal"] == 600 + 800 * 0.5 and r["eaten"]["protein"] == 40 + 60 * 0.5
    assert r["waterL"] == 1.5 and r["targets"]["kcal"] == 2600
    assert api.get("/api/nutrition-plans/me/").json()["meals"][0]["name"] == "صبحانه"
    assert api.put("/api/nutrition-plans/me/", plan, format="json").status_code == 403


def test_recovery_checkin_upsert(api, coach, athlete):
    api.as_user(athlete.user)
    r = api.post("/api/recovery/", {"date": "2026-09-25", "sleepHours": 7.5, "sleepQuality": 7, "energy": 8, "stress": 3})
    assert r.status_code == 201
    r = api.post("/api/recovery/", {"date": "2026-09-25", "sleepHours": 7.5, "sleepQuality": 7, "energy": 8, "stress": 3, "soreness": 6})
    assert r.status_code == 200 and r.json()["soreness"] == 6
    assert api.post("/api/recovery/", {"date": "2026-09-26", "energy": 11}).status_code == 400
    api.as_user(coach.user)
    assert api.get(f"/api/recovery/?athlete={athlete.pk}&from=2026-09-01").json()["count"] == 1
    assert api.post("/api/recovery/", {"date": "2026-09-25", "energy": 5}).status_code == 403


def test_measurements(api, coach, athlete):
    api.as_user(athlete.user)
    r = api.post("/api/measurements/batch/", {"date": "2026-09-01", "values": [{"metric": "weight", "value": 83.1}, {"metric": "height", "value": 181}]})
    assert r.status_code == 201 and {m["unit"] for m in r.json()} == {"kg", "cm"}
    api.post("/api/measurements/", {"metric": "weight", "value": 82.4, "date": "2026-09-21"})
    latest = {m["metric"]: m for m in api.get("/api/measurements/latest/").json()}
    assert latest["weight"]["value"] == 82.4 and latest["weight"]["previous"] == 83.1
    assert "bodyFat" not in latest  # never fabricated
    assert api.get("/api/me/athlete/").json()["heightCm"] == 181

    api.as_user(coach.user)
    r = api.post("/api/measurements/", {"athlete": athlete.pk, "metric": "bodyFat", "value": 14.8, "date": "2026-09-21"})
    assert r.status_code == 201 and r.json()["recordedBy"] == "coach" and r.json()["unit"] == "%"
    athlete_row = api.get(f"/api/measurements/?athlete={athlete.pk}&metric=weight").json()["results"][0]
    assert api.delete(f"/api/measurements/{athlete_row['id']}/").status_code == 403  # recorded by the athlete


def test_chat(api, coach, athlete):
    api.as_user(athlete.user)
    m1 = api.post("/api/messages/", {"text": "سلام مربی"}).json()
    assert m1["sender"] == "athlete" and m1["status"] == "sent"
    assert api.post("/api/messages/", {"text": "  "}).status_code == 400

    api.as_user(coach.user)
    threads = api.get("/api/coach/threads/").json()
    assert threads == [
        {"athleteId": athlete.pk, "name": athlete.name, "lastAt": threads[0]["lastAt"], "lastText": "سلام مربی", "lastSender": "athlete", "unread": 1}
    ]
    assert api.get("/api/messages/").status_code == 400  # coach must choose the athlete
    api.post("/api/messages/", {"athlete": athlete.pk, "text": "سلام علی"})
    assert api.post("/api/messages/read/", {"athlete": athlete.pk}).json() == {"updated": 1}

    api.as_user(athlete.user)
    msgs = api.get("/api/messages/").json()
    assert [m["text"] for m in msgs] == ["سلام مربی", "سلام علی"] and msgs[0]["status"] == "read"
    assert [m["text"] for m in api.get(f"/api/messages/?after={m1['id']}").json()] == ["سلام علی"]


def test_stats_are_computed_or_none(assigned, bench):
    today = timezone.localdate()
    assert stats.adherence_pct(assigned, today=today) is None  # program starts today: nothing expected yet
    assigned.program_start = today - timedelta(days=4)
    assigned.save()
    WorkoutLog.objects.create(athlete=assigned, date=today - timedelta(days=4), status="completed")
    WorkoutLog.objects.create(athlete=assigned, date=today - timedelta(days=3), status="partial")
    assert stats.adherence_pct(assigned, today=today) == round(100 * 1.5 / 4)
    assert stats.attention(assigned, today)[0] == "missed"
    assert stats.strength_change_pct(assigned, today=today) is None


def test_coach_reads_water_logs(api, coach, athlete):
    api.as_user(athlete.user).put("/api/me/water/", {"date": "2026-09-25", "liters": 2})
    rows = api.as_user(coach.user).get(f"/api/water-logs/?athlete={athlete.pk}").json()["results"]
    assert rows == [{"date": "2026-09-25", "liters": 2.0}]


def test_my_progress(api, assigned, bench):
    log = WorkoutLog.objects.create(athlete=assigned, date=timezone.localdate() - timedelta(days=3), status="completed")
    log.sets.create(exercise=bench, slot=0, index=0, target_reps="8", target_value=60, unit="kg", done=True)
    p = api.as_user(assigned.user).get("/api/me/progress/?days=30").json()
    assert p["lifts"][0]["name"] == bench.name and p["lifts"][0]["values"] == [76.0]
    assert set(p["adherence"]) == {"training", "nutrition", "recovery"}
