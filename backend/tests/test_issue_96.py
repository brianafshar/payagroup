"""#96: an admin adds an athlete for a coach and gets the invite link, in the coach's name."""

import pytest

from accounts.models import Invite
from coaching.models import Athlete

from .conftest import Api

pytestmark = pytest.mark.django_db


def test_admin_adds_athlete_for_a_coach(admin, coach):
    c = Api().as_user(admin)
    body = {"name": "سارا نوری", "email": "sara.n@example.com", "goal": "loss", "invite": "link"}
    assert c.post("/api/athletes/", body, format="json").status_code == 400  # which coach?
    r = c.post("/api/athletes/", {**body, "coach": coach.pk}, format="json")
    assert r.status_code == 201, r.content
    a = Athlete.objects.get(email="sara.n@example.com")
    assert a.coach == coach and a.status == "invited" and r.json()["inviteLink"]["url"]
    assert Invite.objects.get(athlete=a).created_by == coach.user  # sent in the coach's name
    # the coach sees the new athlete
    assert any(x["id"] == a.pk for x in Api().as_user(coach.user).get("/api/athletes/").json()["results"])
    # a new link later (copy) is also in the coach's name
    assert c.post(f"/api/athletes/{a.pk}/invite/", {"send": False}, format="json").status_code == 200
    assert Invite.objects.filter(athlete=a).latest("id").created_by == coach.user
