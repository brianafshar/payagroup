import pytest
from rest_framework.test import APIClient

from accounts.models import User
from coaching.models import AccountStatus, Athlete, Coach
from training.models import Exercise, Program

pytestmark = pytest.mark.django_db


def make_coach(email, head=None, is_head=False):
    u = User.objects.create_user(email, password="pw-12345678", name=email, role="coach")
    return Coach.objects.create(user=u, app_name="PAYA", status=AccountStatus.ACTIVE, head=head, is_head=is_head)


def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_head_sees_team_athletes_but_coach_only_own():
    head = make_coach("h@x.io", is_head=True)
    a = make_coach("a@x.io", head=head)
    b = make_coach("b@x.io", head=head)
    Athlete.objects.create(coach=a, name="A1", status=AccountStatus.ACTIVE)
    Athlete.objects.create(coach=b, name="B1", status=AccountStatus.ACTIVE)

    def names(r):
        return sorted(x["name"] for x in (r.data["results"] if isinstance(r.data, dict) else r.data))

    assert names(client(head.user).get("/api/athletes/")) == ["A1", "B1"]
    assert names(client(a.user).get("/api/athletes/")) == ["A1"]


def test_library_and_templates_shared_in_gym_only():
    head = make_coach("h@x.io", is_head=True)
    a = make_coach("a@x.io", head=head)
    other = make_coach("o@x.io")
    Exercise.objects.create(coach=head, name="Squat")
    Exercise.objects.create(coach=other, name="Secret")
    Program.objects.create(coach=head, name="Shared", kind=Program.Kind.TEMPLATE, duration_weeks=4)

    def ids(r):
        data = r.data["results"] if isinstance(r.data, dict) else r.data
        return sorted(x["name"] for x in data)

    assert ids(client(a.user).get("/api/exercises/")) == ["Squat"]
    assert ids(client(a.user).get("/api/programs/")) == ["Shared"]
    assert ids(client(other.user).get("/api/exercises/")) == ["Secret"]


def test_head_manages_team_and_coach_cannot():
    head = make_coach("h@x.io", is_head=True)
    c = client(head.user)
    r = c.post("/api/coach/team/", {"name": "New", "username": "new_coach", "password": "longpass123"}, format="json")
    assert r.status_code == 201
    new = Coach.objects.get(user__username="new_coach")
    assert new.head_id == head.pk and new.status == AccountStatus.ACTIVE
    assert len(c.get("/api/coach/team/").data) == 1
    assert c.post(f"/api/coach/team/{new.pk}/set_status/", {"status": "inactive"}, format="json").status_code == 200
    new.refresh_from_db()
    assert new.status == AccountStatus.INACTIVE
    assert client(new.user).get("/api/coach/team/").status_code == 403


def test_team_coach_signs_in_with_username_only():
    head = make_coach("h@x.io", is_head=True)
    client(head.user).post("/api/coach/team/", {"name": "N", "username": "new_coach", "password": "longpass123"}, format="json")
    r = APIClient().post("/api/auth/login/", {"username": "new_coach", "password": "longpass123", "role": "coach"}, format="json")
    assert r.status_code == 200 and r.json()["user"]["username"] == "new_coach"


def test_coach_changes_own_username():
    head = make_coach("h@x.io", is_head=True)
    other = make_coach("taken", head=head)
    c = client(head.user)
    assert c.post("/api/auth/username/", {"username": "new_name", "currentPassword": "wrong"}, format="json").status_code == 400
    assert c.post("/api/auth/username/", {"username": other.user.username, "currentPassword": "pw-12345678"}, format="json").status_code == 400
    r = c.post("/api/auth/username/", {"username": "New_Name", "currentPassword": "pw-12345678"}, format="json")
    assert r.status_code == 200 and r.json()["username"] == "new_name"
    login = APIClient().post("/api/auth/login/", {"username": "new_name", "password": "pw-12345678", "role": "coach"}, format="json")
    assert login.status_code == 200
