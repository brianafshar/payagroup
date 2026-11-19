"""Regression tests for GitHub issues #62–#64."""

from datetime import timedelta

import pytest
from django.utils import timezone

from training.models import WorkoutLog

pytestmark = pytest.mark.django_db


def test_coach_feedback_reaches_the_athlete(api, coach, assigned, pushes, django_capture_on_commit_callbacks):
    """#62: feedback under a session is pushed and listed in the athlete's notifications, with the text."""
    from messaging.models import Device

    Device.objects.create(user=assigned.user, token="ExponentPushToken[a]", platform="android")
    coach.quiet_hours = False  # the test may run at night
    coach.save()
    log = WorkoutLog.objects.create(athlete=assigned, date=timezone.localdate() - timedelta(days=1), status="completed", focus="پا")
    api.as_user(coach.user)
    with django_capture_on_commit_callbacks(execute=True):
        r = api.post(f"/api/workouts/{log.pk}/feedback/", {"text": "عالی بود، هفته بعد ۵ کیلو اضافه کن"}, format="json")
    assert r.status_code == 200 and r.json()["feedbackAt"]
    assert pushes and pushes[-1]["data"] == {"type": "feedback", "workoutId": log.pk} and "پا" in pushes[-1]["title"]

    api.as_user(assigned.user)
    items = api.get("/api/notifications/").json()["results"]
    fb = next(x for x in items if x["kind"] == "feedback")
    assert fb["workoutId"] == log.pk and fb["text"].startswith("عالی بود") and fb["unread"]
    detail = api.get(f"/api/workouts/{log.pk}/").json()
    assert detail["coachFeedback"] == ["عالی بود، هفته بعد ۵ کیلو اضافه کن"]


def test_progress_trends_for_athlete_and_coach(api, coach, assigned, squat):
    """#63: dated points (one per day) for weight, distance, watch Training Effect / lactate threshold,
    strength; the charts group them by day, week or month. Ranges up to 3 years or everything."""
    from tracking.models import Measurement
    from training.models import LoggedSet

    today = timezone.localdate()
    for i, w in enumerate([86, 85, 84, 83]):
        Measurement.objects.create(athlete=assigned, metric="weight", value=w, date=today - timedelta(days=60 - 20 * i), recorded_by="athlete")
    for d, km, mins, te in [(40, 5, 27, None), (20, 5, 25, (3.1, 0.8, 162, 5.2)), (5, 6, 33, (3.6, 1.9, 165, 5.05))]:
        log = WorkoutLog.objects.create(athlete=assigned, date=today - timedelta(days=d), status="completed", duration_min=mins, rpe=7, distance_km=km)
        if te:
            log.aerobic_te, log.anaerobic_te, log.lt_hr, log.lt_pace = te
            log.save()
        LoggedSet.objects.create(log=log, exercise=squat, slot=0, index=0, target_reps="5", target_value=100, unit="kg", done=True)

    api.as_user(assigned.user)
    t = api.get("/api/me/progress/?days=90").json()["trends"]
    s = t["series"]
    assert [p["value"] for p in s["weight"]] == [86, 85, 84, 83] and t["weight"]["change"] == -3
    assert len(s["km"]) == 3 and t["totals"]["km"] == 16
    # watch values only: the session without a watch adds nothing
    assert [p["value"] for p in s["aerobicTe"]] == [3.1, 3.6] and [p["value"] for p in s["ltHr"]] == [162, 165]
    assert t["watch"] == {"aerobicTe": 3.6, "anaerobicTe": 1.9, "ltHr": 165, "ltPace": 5.05}
    assert t["lifts"][0]["name"] == squat.name and len(t["lifts"][0]["points"]) == 3
    long = api.get("/api/me/progress/?days=3650").json()["trends"]
    assert long["days"] < 90  # «all» starts at the first logged data

    # the athlete can send the watch numbers when finishing or correcting a session
    log = WorkoutLog.objects.filter(athlete=assigned).first()
    r = api.patch(f"/api/workouts/{log.pk}/metrics/", {"aerobicTe": 4.2, "anaerobicTe": 2.1, "ltHr": 168, "ltPace": 4.9}, format="json")
    assert r.status_code == 200 and r.json()["aerobicTe"] == 4.2
    assert api.patch(f"/api/workouts/{log.pk}/metrics/", {"aerobicTe": 7}, format="json").status_code == 400

    api.as_user(coach.user)
    c = api.get(f"/api/athletes/{assigned.pk}/analytics/", {"section": "trends", "days": 730}).json()
    assert c["series"]["weight"] and c["weight"]["last"] == 83


def test_saving_an_edited_session_keeps_its_details(api, assigned):
    """#64: «ویرایش تمرین» then save recounts the status but keeps duration, RPE and heart rate."""
    api.as_user(assigned.user)
    log = api.post("/api/workouts/start/").json()
    first = log["sets"][0]["id"] if log["sets"] else None
    api.post(f"/api/workouts/{log['id']}/finish/", {"rpe": 8, "durationMin": 50, "avgHr": 140}, format="json")
    if first:
        api.patch(f"/api/sets/{first}/", {"done": True}, format="json")
    r = api.post(f"/api/workouts/{log['id']}/finish/", {}, format="json").json()
    w = WorkoutLog.objects.get(pk=log["id"])
    assert w.rpe == 8 and w.duration_min == 50 and w.avg_hr == 140 and r["durationMin"] == 50


def test_athlete_sees_the_program_ahead(api, assigned):
    """The athlete's week view: this week by default, any later week, with the prescribed exercises."""
    from datetime import date

    api.as_user(assigned.user)
    r = api.get("/api/me/schedule/").json()
    days = r["days"]
    assert len(days) == 7 and date.fromisoformat(days[0]["date"]).weekday() == 5  # Saturday first
    assert sum(d["today"] for d in days) == 1 and r["program"]["name"]
    trained = [d for d in days if not d["rest"]]
    assert trained and trained[0]["exercises"][0]["name"] and trained[0]["exercises"][0]["sets"] == 3
    nxt = api.get("/api/me/schedule/", {"start": days[-1]["date"], "days": 14}).json()["days"]
    assert len(nxt) == 14 and nxt[0]["date"] == days[-1]["date"]
    assert api.get("/api/me/schedule/", {"start": "nope"}).status_code == 400


def test_personal_info_editable_by_athlete_and_coach(api, coach, athlete):
    """Birth date (age) and goal from the app; the coach edits the athlete's personal info too."""
    api.as_user(athlete.user)
    r = api.patch("/api/me/athlete/", {"birthDate": "1998-08-03", "goal": "loss"}, format="json")
    assert r.status_code == 200 and r.json()["birthDate"] == "1998-08-03" and r.json()["goal"] == "loss"
    assert r.json()["coachName"] == coach.user.name

    api.as_user(coach.user)
    r = api.patch(
        f"/api/athletes/{athlete.pk}/",
        {"name": "علی رستمی‌نژاد", "birthDate": "1999-01-01", "gender": "m", "goal": "str", "phone": "09121234567"},
        format="json",
    )
    assert r.status_code == 200, r.json()
    athlete.refresh_from_db()
    assert (athlete.name, str(athlete.birth_date), athlete.gender, athlete.goal) == ("علی رستمی‌نژاد", "1999-01-01", "m", "str")
    assert api.patch(f"/api/athletes/{athlete.pk}/", {"birthDate": None, "goal": "", "gender": ""}, format="json").status_code == 200


def test_strength_volume_in_kg_by_muscle_group(api, coach, assigned, bench, squat):
    """Strength volume in kg (not tonnes), stacked by muscle group, and the last 7 days against the 7
    before. A session still in progress counts: its ticked sets are done."""
    from training.models import LoggedSet

    today = timezone.localdate()
    yesterday = WorkoutLog.objects.create(athlete=assigned, date=today - timedelta(days=1), status="in-progress")
    for i in range(3):
        LoggedSet.objects.create(log=yesterday, exercise=squat, slot=0, index=i, target_reps="8", target_value=80, unit="kg", done=True)
    LoggedSet.objects.create(log=yesterday, exercise=bench, slot=1, index=0, target_reps="8", target_value=60, unit="kg", done=True)
    LoggedSet.objects.create(log=yesterday, exercise=bench, slot=1, index=1, target_reps="8", target_value=60, unit="kg", done=False)
    before = WorkoutLog.objects.create(athlete=assigned, date=today - timedelta(days=9), status="completed")
    LoggedSet.objects.create(log=before, exercise=bench, slot=0, index=0, target_reps="10", target_value=50, actual_reps="12", unit="kg", done=True)

    api.as_user(assigned.user)
    v = api.get("/api/me/progress/?days=30").json()["trends"]["volume"]
    assert [(g["category"], g["kg"]) for g in v["groups"]] == [("legs", 1920), ("chest", 1080)]
    assert v["last7"] == {"kg": 2400, "sets": 4} and v["prev7"] == {"kg": 600, "sets": 1}
    assert v["sets"][-1]["value"] == 4

    api.as_user(coach.user)
    t = api.get(f"/api/athletes/{assigned.pk}/analytics/?section=trends&days=30").json()
    assert t["series"]["volumeKg"][-1]["value"] == 2400
