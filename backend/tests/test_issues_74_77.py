"""Regression tests for GitHub issues #74–#77."""

from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import User
from coaching.models import Athlete
from training.models import Program, WorkoutLog

pytestmark = pytest.mark.django_db


def test_coach_deletes_an_athlete_with_their_account(api, coach, other_coach, assigned):
    """#77: deleting an athlete removes their data and app account; other coaches and admins can't."""
    from messaging.models import Device, Message

    WorkoutLog.objects.create(athlete=assigned, date=timezone.localdate() - timedelta(days=1), status="completed")
    Message.objects.create(athlete=assigned, sender="athlete", text="سلام")
    Device.objects.create(user=assigned.user, token="ExponentPushToken[x]", platform="android")
    user_id = assigned.user_id

    assert api.as_user(other_coach.user).delete(f"/api/athletes/{assigned.pk}/").status_code == 404
    assert api.as_user(coach.user).delete(f"/api/athletes/{assigned.pk}/").status_code == 204
    assert not Athlete.objects.filter(pk=assigned.pk).exists()
    assert not User.objects.filter(pk=user_id).exists()
    assert not WorkoutLog.objects.exists() and not Message.objects.exists() and not Device.objects.exists()
    assert not Program.objects.filter(athlete_id=assigned.pk).exists()
    assert Program.objects.filter(kind="template").count() == 1  # the coach's template stays


def test_draft_athlete_without_account_can_be_deleted(api, coach):
    from tests.conftest import make_athlete

    a = make_athlete(coach, email="new@example.com", name="تازه", with_user=False)
    assert api.as_user(coach.user).delete(f"/api/athletes/{a.pk}/").status_code == 204
    assert not Athlete.objects.filter(pk=a.pk).exists()


def test_program_delete_archives_by_default_and_deletes_when_permanent(api, coach, program, assigned):
    """#77: plain DELETE archives a template (as before); ?permanent=true removes it for good while the
    athlete's copy and logged history stay."""
    copy = assigned.program
    log = WorkoutLog.objects.create(athlete=assigned, program=copy, date=timezone.localdate(), status="completed")
    api.as_user(coach.user)
    assert api.delete(f"/api/programs/{program.pk}/").status_code == 204
    program.refresh_from_db()
    assert program.archived

    assert api.delete(f"/api/programs/{program.pk}/?permanent=true").status_code == 204
    assert not Program.objects.filter(pk=program.pk).exists()
    copy.refresh_from_db()
    assert copy.template_id is None

    assert api.delete(f"/api/programs/{copy.pk}/?permanent=true").status_code == 204
    assigned.refresh_from_db()
    log.refresh_from_db()
    assert assigned.program_id is None and log.program_id is None


def test_swim_and_ride_sessions_have_their_own_categories():
    """#75: the library files swim and cycling sessions under their sport's categories, not «آمادگی هوازی»."""
    from training.library import entries

    for row in entries():
        if row["sport"] == "swimming":
            assert row["category"] == "swim", row["name"]
        if row["sport"] == "cycling":
            assert row["category"] == "ride", row["name"]


def test_weekly_load_compares_each_week_with_the_athletes_normal(api, coach, assigned):
    """#76: weekly session-RPE load with the acute:chronic ratio and its zone; a sudden doubling is flagged."""
    from coaching.analytics import weekly_load

    today = timezone.localdate()
    week0 = today - timedelta(days=(today.weekday() - 5) % 7)
    # Five steady weeks (3 × 60 min at RPE 5 = 900), then a week at double load.
    for w in range(6, 1, -1):
        for k in range(3):
            WorkoutLog.objects.create(athlete=assigned, date=week0 - timedelta(weeks=w) + timedelta(days=k * 2), status="completed", duration_min=60, rpe=5)
    for k in range(3):
        WorkoutLog.objects.create(athlete=assigned, date=week0 - timedelta(weeks=1) + timedelta(days=k * 2), status="completed", duration_min=120, rpe=5)
    WorkoutLog.objects.create(athlete=assigned, date=today, status="completed", rpe=6)  # no duration

    data = weekly_load(assigned)
    by_start = {w["start"]: w for w in data["weeks"]}
    steady = by_start[week0 - timedelta(weeks=2)]
    spike = by_start[week0 - timedelta(weeks=1)]
    assert steady["load"] == 900 and steady["zone"] == "optimal" and steady["ratio"] == 1.0
    assert spike["load"] == 1800 and spike["ratio"] == 2.0 and spike["zone"] == "danger"
    assert by_start[week0]["current"] and by_start[week0]["ratio"] is None  # the week isn't over
    assert data["untimed_sessions"] == 1 and data["next_range"][0] < data["next_range"][1]

    r = api.as_user(coach.user).get(f"/api/athletes/{assigned.pk}/analytics/?section=performance").json()
    assert r["load"]["weeks"] and "nextRange" in r["load"]


def _run_program(coach):
    from tests.conftest import week

    run = __import__("training.models", fromlist=["Exercise"]).Exercise.objects.create(
        coach=coach, name="دویدن آرام", sport="running", category="run", equipment="outdoor", unit="km", measure="distance"
    )
    p = Program.objects.create(coach=coach, name="دو ۱۰ کیلومتر", sport="running", duration_weeks=4, sessions_per_week=7, weeks=[week([run.pk])])
    p.sync_exercises()
    return p


def test_two_programs_at_once_and_a_session_for_each(api, coach, assigned):
    """#74: a running program alongside the gym program; today lists both and each gets its own workout."""
    gym = assigned.program
    run = _run_program(coach)
    api.as_user(coach.user)
    r = api.post(f"/api/programs/{run.pk}/assign/", {"athleteIds": [assigned.pk], "replace": False}, format="json")
    assert r.status_code == 201
    run_copy = Program.objects.get(pk=r.json()[0]["id"])
    assigned.refresh_from_db()
    assert assigned.program_id == gym.pk  # the main program stays
    assert {p.pk for p in assigned.active_programs()} == {gym.pk, run_copy.pk}

    api.as_user(assigned.user)
    today = api.get("/api/me/today/").json()
    assert [x["programId"] for x in today["sessions"]] == [gym.pk, run_copy.pk]
    assert today["program"]["id"] == gym.pk and today["exercises"]
    w1 = api.post("/api/workouts/start/", {}, format="json").json()
    # Once the gym session is open, today's default is the run that hasn't started yet.
    again = api.get("/api/me/today/").json()
    assert again["program"]["id"] == run_copy.pk
    w2 = api.post("/api/workouts/start/", {"program": run_copy.pk}, format="json").json()
    assert w1["id"] != w2["id"] and WorkoutLog.objects.filter(athlete=assigned, date=timezone.localdate()).count() == 2
    assert api.get(f"/api/me/today/?program={gym.pk}").json()["log"]["id"] == w1["id"]
    sched = api.get(f"/api/me/schedule/?days=1&start={timezone.localdate()}").json()["days"][0]
    assert sched["also"] and sched["also"][0]["programId"] == run_copy.pk


def test_back_to_the_custom_program_after_a_template(api, coach, program, athlete):
    """#74: a custom program, then a template replaces it; the coach makes the custom one current again."""
    api.as_user(coach.user)
    custom = api.post(
        "/api/programs/", {"name": "اختصاصی", "durationWeeks": 4, "sessionsPerWeek": 3, "weeks": [], "forAthlete": athlete.pk}, format="json"
    ).json()
    api.post(f"/api/programs/{program.pk}/assign/", {"athleteIds": [athlete.pk]}, format="json")
    athlete.refresh_from_db()
    assert athlete.program_id != custom["id"]
    assert not Program.objects.get(pk=custom["id"]).active

    r = api.post(f"/api/programs/{custom['id']}/activate/", {}, format="json")
    assert r.status_code == 200 and r.json()["active"] and r.json()["main"]
    athlete.refresh_from_db()
    assert athlete.program_id == custom["id"] and [p.pk for p in athlete.active_programs()] == [custom["id"]]

    # Stopping the main program hands over to the next running one (none here).
    assert api.post(f"/api/programs/{custom['id']}/deactivate/").status_code == 200
    athlete.refresh_from_db()
    assert athlete.program_id is None


def test_missed_sessions_are_recorded_per_program(coach, assigned):
    from django.core.management import call_command

    run = _run_program(coach)
    from training.services import assign

    assign(run, [assigned], timezone.localdate() - timedelta(days=3), replace=False)
    assigned.program_start = timezone.localdate() - timedelta(days=3)
    assigned.save()
    call_command("daily_jobs")
    y = timezone.localdate() - timedelta(days=1)
    assert WorkoutLog.objects.filter(athlete=assigned, date=y, status="missed").count() == 2


def test_athlete_app_is_told_when_their_programs_change(api, coach, program, athlete, monkeypatch, django_capture_on_commit_callbacks):
    """#74: assigning, editing or stopping an athlete's program sends a `program` event to their app."""
    sent = []
    monkeypatch.setattr("messaging.realtime.send_to_users", lambda ids, event: sent.append((list(ids), event["type"])))
    api.as_user(coach.user)
    with django_capture_on_commit_callbacks(execute=True):
        copy = api.post(f"/api/programs/{program.pk}/assign/", {"athleteIds": [athlete.pk]}, format="json").json()[0]
    with django_capture_on_commit_callbacks(execute=True):
        api.patch(f"/api/programs/{copy['id']}/", {"name": "نسخه ویرایش‌شده"}, format="json")
    with django_capture_on_commit_callbacks(execute=True):
        api.post(f"/api/programs/{copy['id']}/deactivate/")
    assert sent == [([athlete.user_id], "program.changed")] * 3
