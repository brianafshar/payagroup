"""Regression tests for GitHub issues #37–#46."""

from datetime import timedelta

import pytest
from django.utils import timezone

from coaching.models import Athlete
from training import library
from training.models import Exercise, LoggedSet, Program, WorkoutLog

from .conftest import make_coach

pytestmark = pytest.mark.django_db


def test_program_list_counts_exercises_so_templates_are_not_drafts(api, coach, program):
    """#42: the list has no week tree; a saved template must not look empty (a draft)."""
    api.as_user(coach.user)
    rows = api.get("/api/programs/").json()["results"]
    assert rows[0]["exerciseCount"] == 2
    empty = api.post("/api/programs/", {"name": "خالی", "durationWeeks": 4, "sessionsPerWeek": 3, "weeks": []}).json()
    assert next(p for p in api.get("/api/programs/").json()["results"] if p["id"] == empty["id"])["exerciseCount"] == 0


def test_transfer_resets_the_program_but_keeps_personal_data(api, admin, assigned, other_coach):
    """#42 comment: a transferred athlete starts without the old coach's program; records stay."""
    old_copy = assigned.program
    api.as_user(admin)
    assert api.post(f"/api/athletes/{assigned.pk}/transfer/", {"coachId": other_coach.pk}).status_code == 200
    assigned.refresh_from_db()
    old_copy.refresh_from_db()
    assert assigned.program is None and assigned.program_start is None and old_copy.archived
    api.as_user(other_coach.user)
    assert api.get(f"/api/athletes/{assigned.pk}/overview/").status_code == 200


def test_library_is_installed_for_new_coaches_with_photos(api, admin):
    """#39: every new coach gets the standard library; photos are shared, not copied per coach."""
    r = api.as_user(admin).post(
        "/api/coaches/", {"name": "دونده", "email": "run@x.app", "appName": "Run", "sport": "running", "sendInvite": False, "durationDays": None}
    )
    coach_id = r.json()["id"]
    exs = Exercise.objects.filter(coach_id=coach_id)
    assert exs.count() == len(library.entries()) >= 130
    with_photo = {e["name"] for e in library.entries() if e.get("image")}
    assert exs.filter(sport="running", category="run").exists() and exs.filter(sport="swimming").exists()
    assert not exs.filter(name__in=with_photo, stock_image="").exists()  # offline: every bundled photo is used
    # re-running only fills gaps
    assert library.install(exs.first().coach) == 0


def test_library_photo_shows_until_the_coach_replaces_or_removes_it(api, coach):
    library.install(coach)
    ex = Exercise.objects.filter(coach=coach, name="اسکوات هالتر").first()
    api.as_user(coach.user)
    assert "/media/library/" in api.get(f"/api/exercises/{ex.pk}/").json()["imageSrc"]
    assert api.patch(f"/api/exercises/{ex.pk}/", {"removeImage": True}, format="json").json()["imageSrc"] is None


def _run(athlete, days_ago, km, minutes, rpe=7, avg_hr=150, treadmill=None):
    log = WorkoutLog.objects.create(
        athlete=athlete, date=timezone.localdate() - timedelta(days=days_ago), status="completed", duration_min=minutes, rpe=rpe, avg_hr=avg_hr
    )
    LoggedSet.objects.create(log=log, exercise=treadmill, slot=0, index=0, target_reps="1", target_value=km, unit="km", done=True)
    return log


def test_running_analytics(api, coach, athlete):
    """#44: weekly distance, pace, load ratio, HR zones, VO₂max and race predictions from logged runs."""
    run = Exercise.objects.create(coach=coach, name="دویدن", category="run", equipment="outdoor", unit="km")
    Athlete.objects.filter(pk=athlete.pk).update(max_hr=190)
    for d, km, mins in [(1, 5, 25), (4, 8, 44), (9, 5, 26), (16, 10, 55), (23, 6, 33)]:
        _run(athlete, d, km, mins, treadmill=run)
    api.as_user(coach.user)
    r = api.get(f"/api/athletes/{athlete.pk}/analytics/", {"section": "endurance"}).json()["running"]
    assert r["totals"]["km7d"] == 13 and r["totals"]["runs30d"] == 5 and r["totals"]["bestPace"] == 5.0
    assert 37.5 <= r["vo2max"] <= 39  # Daniels' tables: a 25:00 5 km ≈ VDOT 38
    assert [p["race"] for p in r["predictions"]] == ["5k", "10k", "half", "marathon"] and r["predictions"][0]["minutes"] == 25.0
    assert r["load"]["ratio"] is not None and r["hr"] == {"max": 190, "estimated": False, "zones": r["hr"]["zones"]} and sum(r["hr"]["zones"]) > 0


def test_session_metrics_are_editable_by_athlete_and_coach(api, coach, athlete, other_coach):
    """#44: cardio inputs come from the athlete; the coach can correct them."""
    log = WorkoutLog.objects.create(athlete=athlete, date=timezone.localdate(), status="completed", duration_min=30)
    api.as_user(athlete.user)
    r = api.patch(f"/api/workouts/{log.pk}/metrics/", {"distanceKm": 6.2, "avgHr": 151, "cadenceSpm": 172}, format="json")
    assert r.status_code == 200 and r.json()["distanceKm"] == 6.2 and r.json()["durationMin"] == 30
    api.as_user(coach.user)
    assert api.patch(f"/api/workouts/{log.pk}/metrics/", {"maxHr": 181, "elevationM": 40}, format="json").json()["maxHr"] == 181
    assert api.patch(f"/api/workouts/{log.pk}/metrics/", {"cadenceSpm": 900}, format="json").status_code == 400
    api.as_user(other_coach.user)
    assert api.patch(f"/api/workouts/{log.pk}/metrics/", {"maxHr": 170}, format="json").status_code == 404


def test_finish_accepts_cardio_details(api, assigned):
    api.as_user(assigned.user)
    log = api.post("/api/workouts/start/").json()
    r = api.post(f"/api/workouts/{log['id']}/finish/", {"rpe": 7, "distanceKm": 5.5, "maxHr": 178, "cadenceSpm": 170})
    assert r.status_code == 200
    w = WorkoutLog.objects.get(pk=log["id"])
    assert (w.distance_km, w.max_hr, w.cadence_spm) == (5.5, 178, 170)


def test_strength_volume_analytics(api, coach, assigned):
    api.as_user(assigned.user)
    log = api.post("/api/workouts/start/").json()
    for s in log["sets"][:4]:
        api.patch(f"/api/sets/{s['id']}/", {"done": True})
    api.post(f"/api/workouts/{log['id']}/finish/", {"rpe": 8})
    api.as_user(coach.user)
    d = api.get(f"/api/athletes/{assigned.pk}/analytics/", {"section": "strength"}).json()
    assert len(d["weeklyTonnes"]) == 12 and d["weeklyTonnes"][-1]["tonnes"] > 0
    assert sum(x["sets"] for x in d["weekSets"]) == 4 and d["avgRpe"] == 8


def test_program_unit_is_kept_for_distance_exercises(api, coach):
    """#38: a run prescribed in km is saved in km, not kg."""
    run = Exercise.objects.create(coach=coach, name="اینتروال ۴۰۰", category="run", equipment="outdoor", unit="m", measure="interval")
    week = {"index": 1, "days": [{"weekday": "sat", "exercises": [{"exerciseId": run.pk, "sets": [{"reps": "8", "value": 400, "unit": "m"}]}]}]}
    api.as_user(coach.user)
    p = api.post("/api/programs/", {"name": "دو", "durationWeeks": 1, "sessionsPerWeek": 1, "weeks": [week]}, format="json").json()
    assert Program.objects.get(pk=p["id"]).weeks[0]["days"][0]["exercises"][0]["sets"][0]["unit"] == "m"


def test_new_coach_other_sport(api, admin):
    """#37: sports beyond fitness can be chosen."""
    r = api.as_user(admin).post("/api/coaches/", {"name": "شناگر", "email": "swim@x.app", "appName": "Swim", "sport": "swimming", "sendInvite": False})
    assert r.status_code == 201 and r.json()["sport"] == "swimming"


def test_make_coach_helper_still_works():
    assert make_coach("x@y.z").exercises.count() == 0


def test_library_reads_as_utf8_whatever_the_os_default(monkeypatch):
    """Windows opens text as cp1252 by default, which can't read the Persian names."""
    import locale

    monkeypatch.setattr(locale, "getpreferredencoding", lambda *a, **k: "cp1252")
    monkeypatch.setattr(locale, "getencoding", lambda: "cp1252", raising=False)
    library.entries.cache_clear()
    assert library.entries()[0]["name"]


def test_library_illustrations_replace_photos_but_not_the_coachs_own(coach, settings, monkeypatch):
    """#48: illustrated poses (downloaded once, shared) replace the bundled photos; offline → photos."""
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile

    library.install(coach)  # offline: photos
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    assert squat.stock_image.startswith("library/") and "illustrations" not in squat.stock_image
    own = Exercise.objects.get(coach=coach, name="پرس سینه هالتر")
    own.image = SimpleUploadedFile("mine.png", b"x")
    own.save()
    calls = []

    def fake_urlopen(url, timeout=0):
        calls.append(url)
        return io.BytesIO(b"RIFF....WEBPVP8 ")

    settings.EXERCISE_ILLUSTRATIONS = True
    library._failed.clear()
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    library.install(coach)
    squat.refresh_from_db()
    own.refresh_from_db()
    assert squat.stock_image == "library/illustrations/squat-peak.webp"
    assert squat.stock_image_start == "library/illustrations/squat-start.webp"
    assert own.image.name.endswith(".png")  # the coach's own picture is kept
    n = len(calls)
    library.install(coach)  # already stored → no new downloads
    assert len(calls) == n
