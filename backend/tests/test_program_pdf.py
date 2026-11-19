"""The weekly program PDF: what goes into it, who may download it, sending it to chat, the athlete's signed link."""

from datetime import date

import pytest
from django.utils import timezone

from core.pdf.program import context, week_dates
from messaging.models import Message
from tracking.models import Food

from .conftest import Api

pytestmark = pytest.mark.django_db


def as_(user) -> Api:
    return Api().as_user(user)


@pytest.fixture
def planned(assigned, coach):
    white = Food.objects.get(name="سفیده تخم‌مرغ")
    plan = {
        "targets": {"kcal": 1800, "protein": 160, "carbs": 190, "fat": 50, "waterL": 3},
        "supplements": [{"name": "کراتین", "dose": "۵ گرم", "timing": "بعد از تمرین"}],
        "meals": [
            {"name": "صبحانه", "time": "08:00", "foods": [{"food": white.pk, "unit": "عدد", "quantity": 3}, {"name": "قهوه", "grams": 200, "kcalPer100g": 2}]},
            {"name": "شام جمعه", "days": ["fri"], "foods": [{"name": "پیتزا", "grams": 300, "kcalPer100g": 250, "proteinPer100g": 11}]},
        ],
    }
    assert as_(coach.user).put(f"/api/nutrition-plans/{assigned.pk}/", plan, format="json").status_code == 200
    as_(coach.user).put(f"/api/recovery-plans/{assigned.pk}/", {"sleepHours": 8, "stretchMin": 10, "restDays": ["fri"]}, format="json")
    return assigned


def test_week_starts_on_saturday():
    days = week_dates(date(2026, 10, 14))  # a Wednesday
    assert days[0] == date(2026, 10, 10) and days[0].weekday() == 5 and len(days) == 7


def test_context_has_training_menus_supplements_and_recovery(planned):
    c = context(planned)
    assert planned.name in c["athlete"] and "مربی:" in c["meta"] and "هفته ۱ از ۸" in c["meta"]
    assert c["nutrition"]["targets"]["kcal"] == "۱۸۰۰"
    # day by day: the program started today, so the days before it are rest days and the rest train
    days = c["training"]["days"]
    today = timezone.localdate()
    trained = [d for d in days if not d["rest"]]
    assert len(days) == 7 and len(trained) == 7 - week_dates(today).index(today)
    [part] = trained[0]["parts"]
    [session] = part["sessions"]
    assert part["label"] == "" and session["rows"][0]["sets"] == "۳" and session["rows"][0]["reps"] == "۸"
    # Saturday–Thursday share a menu; Friday adds its own meal
    menus = c["nutrition"]["menus"]
    assert [len(m["meals"]) for m in menus] == [1, 2] and menus[1]["title"] == "منوی جمعه"
    egg = menus[0]["meals"][0]["foods"][0]
    assert egg == {"name": "سفیده تخم‌مرغ", "amount": "۳ عدد", "grams": "۹۹g", "kcal": "۵۲", "protein": "۱۱"}
    assert menus[0]["meals"][0]["foods"][1]["amount"] == "۲۰۰ گرم"
    assert c["nutrition"]["supplements"][0]["name"] == "کراتین"
    assert any("خواب: ۸ ساعت" in line for line in c["recovery"]) and any("جمعه" in line for line in c["recovery"])


def test_coach_downloads_pdf(planned, coach, other_coach):
    r = as_(coach.user).get(f"/api/athletes/{planned.pk}/program.pdf")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and "attachment" in r["Content-Disposition"]
    assert as_(other_coach.user).get(f"/api/athletes/{planned.pk}/program.pdf").status_code == 404
    assert as_(planned.user).get(f"/api/athletes/{planned.pk}/program.pdf").status_code == 403


def test_empty_athlete_still_gets_a_pdf(athlete, coach):
    r = as_(coach.user).get(f"/api/athletes/{athlete.pk}/program.pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_send_to_chat_attaches_pdf(planned, coach, pushes):
    r = as_(coach.user).post(f"/api/athletes/{planned.pk}/program-pdf/send/")
    assert r.status_code == 201, r.content
    msg = Message.objects.get(athlete=planned)
    assert msg.sender == "coach" and msg.attachment.name.endswith(".pdf")
    assert msg.attachment.open("rb").read(4) == b"%PDF"
    assert r.json()["attachment"].endswith(".pdf")
    # the athlete sees it in their thread
    assert as_(planned.user).get("/api/messages/").json()[0]["id"] == msg.pk


def test_athlete_downloads_own_pdf_and_signed_link(planned, coach):
    me = as_(planned.user)
    r = me.get("/api/me/program.pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert as_(coach.user).get("/api/me/program.pdf").status_code == 403
    link = me.post("/api/me/program-link/").json()["url"]
    path = link.split("testserver", 1)[1]
    r = Api().get(path)  # no token needed
    assert r.status_code == 200 and r.content.startswith(b"%PDF") and "inline" in r["Content-Disposition"]
    assert Api().get(path[:-3] + "xx/").status_code == 404


def test_meals_are_grouped_into_parts_of_the_day():
    from datetime import time
    from types import SimpleNamespace as M

    from core.pdf.program import part_of_day

    assert part_of_day(M(time=time(7, 30), name="x"), None) == "morning"
    assert part_of_day(M(time=time(13, 0), name="x"), None) == "noon"
    assert part_of_day(M(time=time(16, 30), name="میان‌وعده"), None) == "afternoon"
    assert part_of_day(M(time=time(21, 0), name="x"), None) == "night"
    # without a time: by name, else the part of the meal before it
    assert part_of_day(M(time=None, name="شام"), "noon") == "night"
    assert part_of_day(M(time=None, name="میان‌وعده"), "noon") == "noon"


def test_pdf_menu_has_day_parts(planned):
    menus = context(planned)["nutrition"]["menus"]
    assert [p["label"] for p in menus[1]["parts"]] == ["صبح", "شب"]  # breakfast 08:00, Friday dinner (by name)


def test_training_day_by_day_grouped_by_time(assigned, coach, bench, squat):
    """Two programs the same day: the evening gym session comes after the morning run, under صبح / عصر."""
    from training.models import Program
    from training.services import assign

    from .conftest import week

    gym = assigned.program
    for w in gym.weeks:
        for d in w["days"]:
            d["time"] = "afternoon"
    gym.save()
    run_weeks = [week([squat.pk])]
    for d in run_weeks[0]["days"]:
        d["time"], d["focus"] = "morning", "دویدن"
    run = Program.objects.create(coach=coach, name="دو", duration_weeks=4, weeks=run_weeks)
    assign(run, [assigned], timezone.localdate(), replace=False)
    today = [d for d in context(assigned)["training"]["days"] if not d["rest"]][0]
    assert [p["label"] for p in today["parts"]] == ["صبح", "عصر"]
    assert today["parts"][0]["sessions"][0]["focus"] == "دویدن"


def test_program_time_is_the_default_for_its_days(coach, athlete, bench):
    """The program's time applies to every day without its own; the athlete's copy keeps it."""
    from training.models import Program
    from training.services import assign

    from .conftest import Api, week

    c = Api().as_user(coach.user)
    wk = week([bench.pk])
    wk["days"][0]["time"] = "night"  # Saturday has its own time
    r = c.post("/api/programs/", {"name": "دو", "durationWeeks": 4, "time": "morning", "weeks": [wk]}, format="json")
    assert r.status_code == 201, r.content
    tpl = Program.objects.get(pk=r.json()["id"])
    assert tpl.time == "morning" and c.post("/api/programs/", {"name": "x", "time": "midnight"}, format="json").status_code == 400
    [copy] = assign(tpl, [athlete], timezone.localdate())
    assert copy.time == "morning"
    assert copy.day(1, "sat")["time"] == "night" and copy.day(1, "sun")["time"] == "morning"
    athlete.refresh_from_db()
    labels = {p["label"] for d in context(athlete)["training"]["days"] for p in d["parts"]}
    assert "صبح" in labels


def test_one_day_several_times(coach, athlete, bench, squat):
    """A day can hold a morning and a night session in the same program."""
    from training.models import Program
    from training.services import assign

    from .conftest import Api, week

    wk = week([bench.pk, squat.pk])
    for d in wk["days"]:
        d["time"] = "morning"
        d["exercises"][1]["time"] = "night"
    r = Api().as_user(coach.user).post("/api/programs/", {"name": "دو نوبت", "durationWeeks": 4, "weeks": [wk]}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["weeks"][0]["days"][0]["exercises"][1]["time"] == "night"
    assign(Program.objects.get(pk=r.json()["id"]), [athlete], timezone.localdate())
    athlete.refresh_from_db()
    day = [d for d in context(athlete)["training"]["days"] if not d["rest"]][0]
    assert [(p["label"], [r["name"] for s in p["sessions"] for r in s["rows"]]) for p in day["parts"]] == [
        ("صبح", [bench.name]),
        ("شب", [squat.name]),
    ]
    # each part is its own session: started, logged and finished on its own
    me = Api().as_user(athlete.user)
    today = me.get("/api/me/today/").json()
    assert today["part"] == "morning" and [x["exercise"]["name"] for x in today["exercises"]] == [bench.name]
    assert [(x["part"], x["focus"].split(" · ")[0]) for x in today["sessions"]] == [("morning", "صبح"), ("night", "شب")]
    w1 = me.post("/api/workouts/start/", {}, format="json").json()
    assert w1["part"] == "morning" and {x["exerciseId"] for x in w1["sets"]} == {bench.pk}
    me.post(f"/api/workouts/{w1['id']}/finish/", {}, format="json")
    after = me.get("/api/me/today/").json()
    assert after["part"] == "night" and [x["exercise"]["name"] for x in after["exercises"]] == [squat.name]
    w2 = me.post("/api/workouts/start/", {"part": "night"}, format="json").json()
    assert w2["id"] != w1["id"] and w2["part"] == "night" and {x["exerciseId"] for x in w2["sets"]} == {squat.pk}
