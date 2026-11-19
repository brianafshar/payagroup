import pytest

from core.models import AuditEvent
from training.models import Exercise, Program

from .conftest import make_athlete, week

pytestmark = pytest.mark.django_db


def test_coach_sees_only_own_athletes(api, coach, other_coach, athlete):
    theirs = make_athlete(other_coach, "someone@x.com", "دیگری")
    api.as_user(coach.user)
    assert [a["id"] for a in api.get("/api/athletes/").json()["results"]] == [athlete.pk]
    assert api.get(f"/api/athletes/{theirs.pk}/").status_code == 404
    assert api.get(f"/api/athletes/{theirs.pk}/health/").status_code == 404
    assert api.post(f"/api/athletes/{theirs.pk}/transfer/", {"coachId": coach.pk}).status_code in (403, 404)


def test_athlete_cap(api, coach):
    coach.athlete_cap = 1
    coach.save()
    api.as_user(coach.user)
    assert api.post("/api/athletes/", {"name": "یک"}).status_code == 201
    r = api.post("/api/athletes/", {"name": "دو"})
    assert r.status_code == 400 and r.data["code"] == "cap_reached"


def test_add_athlete_validation(api, coach):
    api.as_user(coach.user)
    assert api.post("/api/athletes/", {"name": "x", "invite": "email"}).status_code == 400  # email required
    assert api.post("/api/athletes/", {"name": "x", "phone": "123"}).status_code == 400
    r = api.post("/api/athletes/", {"name": "x", "email": "X@Example.com", "invite": False, "goal": "gain"})
    assert r.status_code == 201 and r.json()["status"] == "draft" and r.json()["email"] == "x@example.com"
    assert r.json()["stats"] == {"adherencePct": None, "strengthChangePct": None}


def test_health_is_coach_only_and_audited(api, coach, athlete):
    api.as_user(coach.user)
    r = api.put(f"/api/athletes/{athlete.pk}/health/", {"injuries": "گیرافتادگی شانه چپ", "limitations": "پرس پشت گردن ممنوع"})
    assert r.status_code == 200 and r.json()["updatedByName"] == "علی احمدی"
    assert api.get(f"/api/athletes/{athlete.pk}/health/").json()["injuries"] == "گیرافتادگی شانه چپ"
    assert set(AuditEvent.objects.values_list("action", flat=True)) >= {"health.edit", "health.view"}
    api.as_user(athlete.user)
    assert api.get("/api/me/health/").json()["limitations"] == "پرس پشت گردن ممنوع"


def test_exercise_library(api, coach, other_coach, bench, program):
    Exercise.objects.create(coach=other_coach, name="not mine", category="x", equipment="x")
    api.as_user(coach.user)
    rows = api.get("/api/exercises/?ordering=name").json()["results"]
    assert [r["name"] for r in rows] == ["اسکوات هالتر", "پرس سینه هالتر"]
    assert rows[1]["used"] == 1 and rows[1]["cat"] == "chest"
    r = api.post(
        "/api/exercises/",
        {
            "name": "پشت بازو سیم‌کش",
            "cat": "arms",
            "equip": "cable",
            "diff": "beginner",
            "cues": ["آرنج ثابت"],
            "videoUrl": "https://example.com/v.mp4",
            "dur": "0:42",
        },
    )
    assert r.status_code == 201 and r.json()["hasVideo"] is True
    assert api.delete(f"/api/exercises/{bench.pk}/").status_code == 400  # used by a program


def test_program_builder_validation(api, coach, other_coach, bench):
    foreign = Exercise.objects.create(coach=other_coach, name="x", category="x", equipment="x")
    api.as_user(coach.user)
    base = {"name": "قدرت", "durationWeeks": 4, "sessionsPerWeek": 3}
    assert api.post("/api/programs/", {**base, "weeks": [week([foreign.pk])]}).status_code == 400
    bad_week = week([bench.pk])
    bad_week["days"].append(dict(bad_week["days"][0]))
    assert api.post("/api/programs/", {**base, "weeks": [bad_week]}).status_code == 400  # duplicate weekday
    assert api.post("/api/programs/", {**base, "weeks": [{**week([bench.pk]), "index": 9}]}).status_code == 400
    r = api.post("/api/programs/", {**base, "weeks": [week([bench.pk], ("mon", "sat"))]})
    assert r.status_code == 201
    days = r.json()["weeks"][0]["days"]
    assert [d["weekday"] for d in days] == ["sat", "mon"]  # Saturday-first
    assert days[0]["exercises"][0]["exerciseId"] == bench.pk and days[0]["exercises"][0]["sets"][0]["restSec"] == 90


def test_assign_copies_and_template_edits_do_not_flow_back(api, coach, athlete, program, bench):
    api.as_user(coach.user)
    r = api.post(f"/api/programs/{program.pk}/assign/", {"athleteIds": [athlete.pk], "startDate": "2026-09-19"})
    assert r.status_code == 201
    copy_id = r.json()[0]["id"]
    athlete.refresh_from_db()
    assert athlete.program_id == copy_id and str(athlete.program_start) == "2026-09-19"
    assert api.get(f"/api/programs/{program.pk}/").json()["assignedCount"] == 1

    r = api.patch(f"/api/programs/{program.pk}/", {"name": "نسخه جدید", "weeks": [week([bench.pk], ("sat",))]})
    assert r.json()["version"] == 2
    copy = Program.objects.get(pk=copy_id)
    assert copy.name == "عضله‌سازی ۸ هفته" and len(copy.weeks[0]["days"]) == 7 and copy.kind == "copy"

    r = api.patch(f"/api/programs/{copy_id}/", {"weeks": [week([bench.pk], ("sun",))]})
    assert r.json()["kind"] == "customized"
    assert api.get(f"/api/athletes/{athlete.pk}/").json()["customized"] is True


def test_nutrition_plan_edits_keep_meal_logs(api, coach, athlete):
    api.as_user(coach.user)
    plan = {
        "targets": {"kcal": 2600, "protein": 160, "carbs": 300, "fat": 75, "waterL": 2.5},
        "meals": [{"name": "صبحانه", "time": "07:30", "foods": [{"name": "تخم‌مرغ", "grams": 150, "kcalPer100g": 155, "proteinPer100g": 13}]}],
    }
    r = api.put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json")
    assert r.status_code == 200, r.data
    body = r.json()
    assert body["totals"]["kcal"] == 232.5 and body["targets"]["waterL"] == 2.5
    meal_id = body["meals"][0]["id"]

    api.as_user(athlete.user).post("/api/meal-logs/", {"mealId": meal_id, "date": "2026-09-25", "status": "followed"})
    plan["meals"][0]["id"] = meal_id
    plan["meals"].append({"name": "ناهار", "foods": []})
    r = api.as_user(coach.user).put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json")
    assert [m["id"] for m in r.json()["meals"]][0] == meal_id
    assert api.get(f"/api/meal-logs/?athlete={athlete.pk}").json()["count"] == 1


def test_tests_and_results(api, coach, athlete):
    api.as_user(coach.user)
    t = api.post("/api/tests/", {"name": "دوی ۲۰ متر", "unit": "s", "better": "lower"}).json()
    assert api.post("/api/tests/", {"name": "دوی ۲۰ متر", "unit": "s"}).status_code == 400
    r = api.post("/api/test-results/", {"athlete": athlete.pk, "testId": t["id"], "value": 3.4, "date": "2026-09-20"})
    assert r.status_code == 201 and r.json()["better"] == "lower"
    assert api.get("/api/coach/profile/").json()["customTests"][0]["name"] == "دوی ۲۰ متر"
    api.as_user(athlete.user)
    assert api.get("/api/test-results/").json()["count"] == 1
    assert api.post("/api/test-results/", {"testId": t["id"], "value": 1, "date": "2026-09-20"}).status_code == 403


def test_coach_profile_cadence(api, coach):
    api.as_user(coach.user)
    assert api.patch("/api/coach/profile/", {"cadence": "every-n-weeks"}).status_code == 400
    r = api.patch("/api/coach/profile/", {"cadence": "every-n-weeks", "cadenceWeeks": 2, "bio": "مربی بدنسازی"})
    assert r.status_code == 200 and r.json()["cadenceWeeks"] == 2
    assert api.patch("/api/coach/profile/", {"athleteCap": 999}).json()["athleteCap"] is None  # admin-managed


def test_coach_quiet_hours_setting(api, coach):
    r = api.as_user(coach.user).patch("/api/coach/profile/", {"quietHours": False})
    assert r.status_code == 200 and r.json()["quietHours"] is False


def test_coach_dashboard(api, coach, assigned):
    from datetime import timedelta

    from django.utils import timezone

    from coaching.models import Athlete

    Athlete.objects.create(coach=coach, name="دعوت‌شده", email="i@x.com", status="invited")
    assigned.program_start = timezone.localdate() - timedelta(days=3)
    assigned.save()
    d = api.as_user(coach.user).get("/api/coach/dashboard/").json()
    assert d["athletes"]["invited"] == 1 and d["today"]["scheduled"] == 1 and d["today"]["notStarted"] == 1
    assert d["attention"][0]["flag"] == "missed" and d["invites"][0]["name"] == "دعوت‌شده"


def test_athlete_overview_and_notes(api, coach, assigned, bench):
    api.as_user(assigned.user).post("/api/workouts/start/")
    api.as_user(coach.user)
    o = api.get(f"/api/athletes/{assigned.pk}/overview/").json()
    assert o["today"]["status"] == "in-progress" and o["today"]["setsTotal"] == 6 and o["record"] is None
    assert o["adherence"]["nutrition"] is None
    assert api.post(f"/api/athletes/{assigned.pk}/notes/", {"text": "فرم اسکوات خوب بود"}).status_code == 201
    assert [n["text"] for n in api.get(f"/api/athletes/{assigned.pk}/notes/").json()] == ["فرم اسکوات خوب بود"]
    assert api.as_user(assigned.user).get(f"/api/athletes/{assigned.pk}/notes/").status_code == 403


def test_program_for_one_athlete(api, coach, athlete, bench):
    r = api.as_user(coach.user).post(
        "/api/programs/",
        {"name": "برنامه اختصاصی", "durationWeeks": 4, "sessionsPerWeek": 2, "weeks": [week([bench.pk], ("sat",))], "forAthlete": athlete.pk},
        format="json",
    )
    assert r.status_code == 201 and r.json()["kind"] == "customized" and r.json()["athleteId"] == athlete.pk
    athlete.refresh_from_db()
    assert athlete.program_id == r.json()["id"]
    assert api.get("/api/programs/?kind=template").json()["count"] == 0


def test_template_copies_and_push_update(api, coach, athlete, program, bench):
    api.as_user(coach.user)
    copy_id = api.post(f"/api/programs/{program.pk}/assign/", {"athleteIds": [athlete.pk]}).json()[0]["id"]
    api.patch(f"/api/programs/{program.pk}/", {"weeks": [week([bench.pk], ("sat",))]})
    rows = api.get(f"/api/programs/{program.pk}/copies/").json()
    assert rows[0]["athleteName"] == athlete.name and rows[0]["version"] == 1 and rows[0]["current"] is True
    assert api.post(f"/api/programs/{program.pk}/push-update/", {"copyIds": [copy_id]}).json() == {"updated": 1}
    assert api.get(f"/api/programs/{copy_id}/").json()["version"] == 2


def test_athlete_calendar(api, coach, assigned):
    from datetime import timedelta

    from django.utils import timezone

    today = timezone.localdate()
    assigned.program_start = today - timedelta(days=2)
    assigned.save()
    api.as_user(assigned.user).post("/api/workouts/start/")
    rows = api.as_user(coach.user).get(f"/api/athletes/{assigned.pk}/calendar/?from={today - timedelta(days=3)}&to={today + timedelta(days=1)}").json()
    assert [r["status"] for r in rows] == ["rest", "missed", "missed", "in-progress", "planned"]
