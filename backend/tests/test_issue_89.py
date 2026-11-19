"""#89: a day the coach prescribed nothing for is a rest day (done), never «missed»; a prescribed session
that wasn't done is missed; and the day says what wasn't logged (training, nutrition, recovery, measurement)."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from training.models import PY_WEEKDAY, Program, WorkoutLog
from training.services import assign

from .conftest import Api, week

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(athlete, coach, bench):
    """Program that trains only on the weekday 3 days ago; started 6 days ago."""
    today = timezone.localdate()
    train_day = today - timedelta(days=3)
    tpl = Program.objects.create(coach=coach, name="سه روز", duration_weeks=4, weeks=[week([bench.pk], weekdays=(PY_WEEKDAY[train_day.weekday()],))])
    assign(tpl, [athlete], today - timedelta(days=6))
    athlete.refresh_from_db()
    return athlete, today, train_day


def test_coach_calendar_rest_missed_and_missing(setup, coach):
    athlete, today, train_day = setup
    rest_day = today - timedelta(days=2)
    # a session opened on the rest day and never used (the nightly job used to mark it «missed»)
    WorkoutLog.objects.create(athlete=athlete, program=athlete.program, date=rest_day, status="missed")
    c = Api().as_user(coach.user)
    rows = {r["date"]: r for r in c.get(f"/api/athletes/{athlete.pk}/calendar/?from={today - timedelta(days=6)}&to={today}").json()}
    assert rows[str(rest_day)]["status"] == "rest" and rows[str(rest_day)]["workoutId"] is None
    missed = rows[str(train_day)]
    assert missed["status"] == "missed" and missed["missing"][0] == "تمرین انجام نشد"
    # nothing else was asked (no nutrition / recovery plan) → nothing else is missing
    assert rows[str(rest_day)]["missing"] == [] and rows[str(rest_day)]["nutrition"] == "none"

    # with a nutrition plan and a recovery plan, an unlogged day lists them
    c.put(
        f"/api/nutrition-plans/{athlete.pk}/",
        {"targets": {"kcal": 2000, "protein": 100, "carbs": 200, "fat": 60, "waterL": 2}, "meals": [{"name": "صبحانه", "foods": []}]},
        format="json",
    )
    c.put(f"/api/recovery-plans/{athlete.pk}/", {"sleepHours": 8}, format="json")
    rows = {r["date"]: r for r in c.get(f"/api/athletes/{athlete.pk}/calendar/?from={rest_day}&to={rest_day}").json()}
    assert rows[str(rest_day)]["missing"] == ["تغذیه ثبت نشد", "ریکاوری ثبت نشد"]


def test_athlete_schedule_past_rest_and_missed(setup):
    athlete, today, train_day = setup
    start = today - timedelta(days=6)
    days = {d["date"]: d for d in Api().as_user(athlete.user).get(f"/api/me/schedule/?start={start}&days=7").json()["days"]}
    assert days[str(train_day)]["status"] == "missed"
    assert days[str(today - timedelta(days=2))]["status"] == "rest"
    assert days[str(today)]["status"] is None  # today is still ahead


def test_nightly_job_drops_unused_session_on_rest_day(setup):
    athlete, today, train_day = setup
    rest_day = today - timedelta(days=2)
    stray = WorkoutLog.objects.create(athlete=athlete, program=athlete.program, date=rest_day, status="in-progress")
    call_command("daily_jobs", stdout=open("/dev/null", "w"))
    assert not WorkoutLog.objects.filter(pk=stray.pk).exists()
