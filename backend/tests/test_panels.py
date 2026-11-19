"""Top-bar search & notifications, the recovery plan, analytics (C25–C30) and exercise usage."""

from datetime import timedelta

import pytest
from django.utils import timezone

from coaching.models import Coach
from messaging.models import Message
from tracking.models import NutritionPlan, RecoveryCheckIn
from training.models import PersonalRecord

from .conftest import make_athlete

pytestmark = pytest.mark.django_db


def test_search_is_scoped_to_the_coach(api, coach, other_coach, athlete, bench):
    make_athlete(other_coach, email="x@y.z", name="علی دیگر")
    api.as_user(coach.user)
    hits = api.get("/api/search/", {"q": "علی"}).json()["results"]
    assert [(h["kind"], h["title"]) for h in hits] == [("athlete", "علی رستمی")]
    assert api.get("/api/search/", {"q": bench.name[:4]}).json()["results"][0]["kind"] == "exercise"
    api.as_user(athlete.user)
    assert api.get("/api/search/", {"q": "علی"}).status_code == 403


def test_admin_search_finds_coaches(api, admin, coach):
    api.as_user(admin)
    hits = api.get("/api/search/", {"q": coach.app_name[:3]}).json()["results"]
    assert hits[0]["kind"] == "coach" and hits[0]["id"] == coach.pk


def test_coach_notifications_and_read_marker(api, coach, athlete, bench):
    today = timezone.localdate()
    PersonalRecord.objects.create(athlete=athlete, exercise=bench, type="8RM", value=70, date=today, previous=67.5)
    RecoveryCheckIn.objects.create(athlete=athlete, date=today, soreness=9)
    Message.objects.create(athlete=athlete, sender="athlete", sender_user=athlete.user, text="سلام")
    api.as_user(coach.user)
    r = api.get("/api/notifications/").json()
    assert {x["kind"] for x in r["results"]} == {"pr", "soreness", "message"} and r["unread"] == 3
    assert api.post("/api/notifications/read/").status_code == 204
    assert api.get("/api/notifications/").json()["unread"] == 0


def test_admin_notifications(api, admin, coach):
    Coach.objects.filter(pk=coach.pk).update(status="invited", created_at=timezone.now() - timedelta(days=3))
    api.as_user(admin)
    kinds = [x["kind"] for x in api.get("/api/notifications/").json()["results"]]
    assert "coach.invite_pending" in kinds


def test_recovery_plan_shares_water_with_nutrition(api, coach, athlete, other_coach):
    api.as_user(coach.user)
    plan = api.get(f"/api/recovery-plans/{athlete.pk}/").json()
    assert plan["sleepHours"] == 8 and plan["checks"] == ["sleep", "quality", "energy", "stress", "soreness", "fatigue"]
    r = api.put(
        f"/api/recovery-plans/{athlete.pk}/", {"sleepHours": 7.5, "waterL": 3, "restDays": ["fri"], "checks": ["sleep", "soreness"], "sorenessAlert": 7}
    )
    assert r.status_code == 200 and r.json()["restDays"] == ["fri"] and r.json()["waterL"] == 3
    assert NutritionPlan.objects.get(athlete=athlete).water_l == 3
    assert api.put(f"/api/recovery-plans/{athlete.pk}/", {"restDays": ["xyz"]}).status_code == 400
    # the athlete reads their own, can't edit it; another coach can't see it
    api.as_user(athlete.user)
    assert api.get("/api/recovery-plans/me/").json()["sleepHours"] == 7.5
    assert api.put("/api/recovery-plans/me/", {"sleepHours": 9}).status_code == 403
    api.as_user(other_coach.user)
    assert api.get(f"/api/recovery-plans/{athlete.pk}/").status_code == 404


def test_goal_weight_and_schedule_are_coach_fields(api, coach, athlete):
    api.as_user(coach.user)
    r = api.patch(f"/api/athletes/{athlete.pk}/", {"goalWeightKg": 84, "measureSchedule": {"freq": "w2", "day": "fr", "req": ["w", "f"]}}, format="json")
    assert r.status_code == 200 and r.json()["measureSchedule"]["freq"] == "w2"
    assert api.patch(f"/api/athletes/{athlete.pk}/", {"measureSchedule": {"freq": "daily", "day": "fr"}}, format="json").status_code == 400
    api.as_user(athlete.user)
    api.patch("/api/me/athlete/", {"goalWeightKg": 60}, format="json")
    athlete.refresh_from_db()
    assert athlete.goal_weight_kg == 84


def test_analytics_sections(api, coach, assigned, bench):
    athlete = assigned
    api.as_user(athlete.user)
    log = api.post("/api/workouts/start/").json()
    for s in log["sets"][:3]:
        api.patch(f"/api/sets/{s['id']}/", {"done": True})
    api.post(f"/api/workouts/{log['id']}/finish/", {"rpe": 8})
    today = timezone.localdate()
    RecoveryCheckIn.objects.create(athlete=athlete, date=today, sleep_hours=5.5, soreness=8, resting_hr=58)
    api.as_user(coach.user)
    url = f"/api/athletes/{athlete.pk}/analytics/"
    o = api.get(url, {"section": "overview", "days": 30}).json()
    assert o["days"] == 30 and o["lifts"][0]["name"] == bench.name and o["sessions"]["partial"] == 1
    assert o["adherence"]["training"]["value"] == 50 and len(o["adherence"]["training"]["spark"]) == 6
    s = api.get(url, {"section": "strength"}).json()
    assert len(s["months"]) == 12 and s["lifts"][0]["current"] == round(70 * (1 + 8 / 30), 1)
    assert api.get(url, {"section": "endurance"}).json()["tests"] == []
    assert api.get(url, {"section": "body"}).json()["entries"] == []
    rec = api.get(url, {"section": "recovery", "days": 7}).json()
    assert len(rec["days"]) == 7 and rec["days"][-1]["soreness"] == 8 and rec["sleepTarget"] == 8
    assert api.get(url, {"section": "nope"}).status_code == 400
    api.as_user(athlete.user)
    assert api.get(url, {"section": "overview"}).status_code == 403


def test_exercise_programs_lists_where_it_is_used(api, coach, program, bench):
    api.as_user(coach.user)
    rows = api.get(f"/api/exercises/{bench.pk}/programs/").json()
    assert rows[0]["id"] == program.pk and rows[0]["kind"] == "template" and "sat" in rows[0]["weekdays"]


def test_me_can_remove_photo(api, athlete):
    api.as_user(athlete.user)
    assert api.patch("/api/auth/me/", {"removePhoto": True}, format="json").json()["photo"] is None


def test_renewal_request_emails_admins_once_a_day(api, admin, coach):
    from django.core import mail

    api.as_user(coach.user)
    assert api.post("/api/coach/renewal-request/").status_code == 202
    assert api.post("/api/coach/renewal-request/").status_code == 202
    assert [m.to for m in mail.outbox] == [[admin.email]]
    api.as_user(admin)
    kinds = [x["kind"] for x in api.get("/api/notifications/").json()["results"]]
    assert "coach.renewal_request" in kinds
