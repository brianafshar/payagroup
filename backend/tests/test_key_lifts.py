"""Strength analytics: the coach picks the key lifts and records tested 1RMs."""

from datetime import timedelta

import pytest
from django.utils import timezone

from training.models import Exercise, LoggedSet, WorkoutLog

pytestmark = pytest.mark.django_db


def _session(athlete, ex, weight, reps="5", days_ago=3):
    log = WorkoutLog.objects.create(athlete=athlete, date=timezone.localdate() - timedelta(days=days_ago), status="completed")
    LoggedSet.objects.create(log=log, exercise=ex, slot=0, index=0, target_reps=reps, target_value=weight, unit="kg", done=True)


def test_auto_lifts_skip_sets_without_a_load(api, coach, assigned, bench, squat):
    split = Exercise.objects.create(coach=coach, name="اسپلیت اسکوات دمبل", category="legs", equipment="dumbbell", unit="kg")
    for i in range(3):
        _session(assigned, split, None, days_ago=10 + i)  # logged without a weight
    _session(assigned, bench, 80)
    api.as_user(coach.user)
    d = api.get(f"/api/athletes/{assigned.pk}/analytics/?section=strength").json()
    assert [x["name"] for x in d["lifts"]] == [bench.name] and d["keyLiftsCustom"] is False


def test_coach_picks_key_lifts_and_records_a_tested_max(api, coach, assigned, bench, squat):
    _session(assigned, bench, 80)
    _session(assigned, squat, 100, reps="3", days_ago=5)
    api.as_user(coach.user)
    r = api.patch(f"/api/athletes/{assigned.pk}/", {"keyLifts": [squat.pk, bench.pk]}, format="json")
    assert r.status_code == 200 and r.json()["keyLifts"] == [squat.pk, bench.pk]

    rec = api.post(
        "/api/records/",
        {"athlete": assigned.pk, "exerciseId": squat.pk, "type": "1RM", "value": 115, "unit": "kg", "date": str(timezone.localdate())},
        format="json",
    )
    assert rec.status_code == 201, rec.json()
    d = api.get(f"/api/athletes/{assigned.pk}/analytics/?section=strength").json()
    assert d["keyLiftsCustom"] is True and [x["exerciseId"] for x in d["lifts"]] == [squat.pk, bench.pk]
    sq = d["lifts"][0]
    assert sq["tested"][-1]["value"] == 115 and sq["rm1"] == 115 and sq["current"] == 115

    # The athlete's progress charts follow the coach's choice.
    api.as_user(assigned.user)
    assert [x["name"] for x in api.get("/api/me/progress/?days=90").json()["trends"]["lifts"]] == [squat.name, bench.name]

    # Back to automatic; a tested record can be removed.
    api.as_user(coach.user)
    api.patch(f"/api/athletes/{assigned.pk}/", {"keyLifts": []}, format="json")
    assert api.delete(f"/api/records/{rec.json()['id']}/").status_code == 204
    d = api.get(f"/api/athletes/{assigned.pk}/analytics/?section=strength").json()
    assert d["keyLiftsCustom"] is False and all(not x["tested"] for x in d["lifts"])


def test_key_lifts_must_be_the_coachs_kg_exercises(api, coach, assigned, other_coach):
    plank = Exercise.objects.create(coach=coach, name="پلانک", category="core", equipment="none", unit="s")
    theirs = Exercise.objects.create(coach=other_coach, name="ددلیفت", category="back", equipment="barbell", unit="kg")
    api.as_user(coach.user)
    for ids in ([plank.pk], [theirs.pk], list(range(1, 9))):
        assert api.patch(f"/api/athletes/{assigned.pk}/", {"keyLifts": ids}, format="json").status_code == 400
