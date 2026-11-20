import pytest

from training.models import LoggedSet, WorkoutLog

pytestmark = pytest.mark.django_db


def test_coach_marks_attendance_and_edits_weights(api, coach, assigned):
    api.as_user(coach.user)
    rows = api.get("/api/attendance/").json()["athletes"]
    mine = next(r for r in rows if r["athleteId"] == assigned.pk)
    assert mine["sessions"] and mine["sessions"][0]["present"] is None

    # present → logged as prescribed and counted in analytics
    r = api.post("/api/attendance/", {"athlete": assigned.pk, "present": True}, format="json")
    assert r.status_code == 200 and r.json()["status"] == "completed" and r.json()["volumeKg"] > 0
    log = WorkoutLog.objects.get(pk=r.json()["id"])
    assert log.sets.filter(done=True).count() == log.sets.count() > 0

    # the coach corrects one set's weight; the session is recounted
    s = log.sets.first()
    assert api.patch(f"/api/sets/{s.pk}/", {"actualValue": 80}, format="json").status_code == 200
    s.refresh_from_db()
    assert s.weight == 80
    # un-ticking one set makes the session partial
    assert api.patch(f"/api/sets/{s.pk}/", {"done": False}, format="json").status_code == 200
    log.refresh_from_db()
    assert log.status == "partial"

    # absent → missed, nothing counts
    r = api.post("/api/attendance/", {"athlete": assigned.pk, "present": False}, format="json")
    assert r.json()["status"] == "missed"
    assert not LoggedSet.objects.filter(log=log, done=True).exists()
    assert api.get("/api/attendance/").json()["athletes"][0]["sessions"][0]["present"] is False

    # cleared
    r = api.post("/api/attendance/", {"athlete": assigned.pk, "present": None}, format="json")
    assert r.json()["status"] == "planned"


def test_attendance_not_for_future_or_unknown(api, coach, assigned, django_user_model):
    api.as_user(coach.user)
    assert api.post("/api/attendance/", {"athlete": assigned.pk, "date": "2999-01-01", "present": True}, format="json").status_code == 400
    assert api.post("/api/attendance/", {"athlete": 99999, "present": True}, format="json").status_code == 400
