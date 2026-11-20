"""#96: an admin adds an athlete for a coach and gets the invite link, in the coach's name."""

import pytest

from coaching.models import Athlete

from .conftest import Api

pytestmark = pytest.mark.django_db


def test_admin_adds_athlete_for_a_coach(admin, coach):
    c = Api().as_user(admin)
    body = {"name": "سارا نوری", "phone": "09123334455", "goal": "loss"}
    assert c.post("/api/athletes/", body, format="json").status_code == 400  # which coach?
    r = c.post("/api/athletes/", {**body, "coach": coach.pk}, format="json")
    assert r.status_code == 201, r.content
    a = Athlete.objects.get(phone="09123334455")
    assert a.coach == coach and a.status == "active"
    # the coach sees the new athlete
    assert any(x["id"] == a.pk for x in Api().as_user(coach.user).get("/api/athletes/").json()["results"])
