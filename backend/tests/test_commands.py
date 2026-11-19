from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from coaching.models import Athlete, Coach
from training.models import WorkoutLog

from .conftest import make_coach

pytestmark = pytest.mark.django_db


def test_daily_jobs(assigned, coach):
    expired = make_coach("old@x.app", expires_at=timezone.now() - timedelta(hours=1))
    soon = make_coach("soon@x.app", expires_at=timezone.now() + timedelta(days=1, hours=1), reminder_days=2)
    yesterday = timezone.localdate() - timedelta(days=1)
    assigned.program_start = yesterday
    assigned.save()
    open_log = WorkoutLog.objects.create(athlete=assigned, date=yesterday - timedelta(days=1), status="in-progress")

    call_command("daily_jobs", stdout=open("/dev/null", "w"))
    expired.refresh_from_db()
    soon.refresh_from_db()
    assert expired.status == "inactive"
    assert [m.to for m in mail.outbox] == [["soon@x.app"]] and soon.reminder_sent_for == soon.expires_at
    # opened before the program started (nothing prescribed) and never used → dropped, not «missed» (#89)
    assert not WorkoutLog.objects.filter(pk=open_log.pk).exists()
    assert WorkoutLog.objects.get(athlete=assigned, date=yesterday).status == "missed"

    call_command("daily_jobs", stdout=open("/dev/null", "w"))  # idempotent: no second reminder
    assert len(mail.outbox) == 1


def test_seed_demo(api):
    call_command("seed_demo", "--force", stdout=open("/dev/null", "w"))  # tests run with DEBUG off
    assert Coach.objects.count() == 6
    ali = Athlete.objects.get(email="ali.rostami@gmail.com")
    assert ali.program_week == 4 and ali.workouts.count() > 80 and ali.records.exists() and ali.recovery.count() > 30
    assert ali.test_results.filter(test__category="end").count() >= 5
    api.as_user(ali.coach.user)
    for section in ("overview", "strength", "endurance", "body", "recovery"):
        assert api.get(f"/api/athletes/{ali.pk}/analytics/", {"section": section}).status_code == 200
    assert api.get("/api/notifications/").json()["results"]
    api.anon()
    r = api.post("/api/auth/login/", {"email": "ali.rostami@gmail.com", "password": "baseline-demo", "role": "athlete"})
    assert r.status_code == 200
