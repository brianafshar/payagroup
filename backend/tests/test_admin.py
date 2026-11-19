from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from accounts.models import User
from coaching.models import Coach
from core.models import AuditEvent

from .conftest import make_athlete, make_coach

pytestmark = pytest.mark.django_db

NEW_COACH = {
    "name": "کاوه نیک‌پور",
    "username": "kaveh",
    "password": "kova-pass-12",
    "appName": "Kova Athletics",
    "sport": "fitness",
    "athleteCap": 30,
    "durationDays": 90,
    "reminderDays": 3,
}


def test_create_coach_with_username_and_password(api, admin):
    r = api.as_user(admin).post("/api/coaches/", NEW_COACH)
    assert r.status_code == 201, r.data
    c = r.json()
    assert c["status"] == "active" and c["branding"]["initials"] == "KA" and c["username"] == "kaveh"
    assert c["validity"]["kind"] == "limited" and c["validity"]["days"] == 90
    assert not mail.outbox
    login = api.anon().post("/api/auth/login/", {"username": "kaveh", "password": "kova-pass-12"})
    assert login.status_code == 200
    coach = Coach.objects.get(pk=c["id"])
    assert coach.status == "active" and 89 <= (coach.expires_at - timezone.now()).days <= 90


def test_create_coach_validation(api, admin, coach):
    api.as_user(admin)
    assert api.post("/api/coaches/", {**NEW_COACH, "durationDays": 2000}).status_code == 400
    assert api.post("/api/coaches/", NEW_COACH).status_code == 201
    r = api.post("/api/coaches/", NEW_COACH)
    assert r.status_code == 400 and r.data["username"][0].code == "conflict"
    assert api.post("/api/coaches/", {**NEW_COACH, "username": "a b"}).status_code == 400
    r = api.post("/api/coaches/", {**NEW_COACH, "username": "unlimited", "durationDays": None})
    assert r.json()["validity"] == {"kind": "unlimited"}


def test_expired_coach_is_inactive_and_extend_reactivates(api, admin):
    c = make_coach(expires_at=timezone.now() - timedelta(days=1))
    api.as_user(admin)
    assert api.get(f"/api/coaches/{c.pk}/").json()["status"] == "inactive"
    assert [x["id"] for x in api.get("/api/coaches/?status=inactive").json()["results"]] == [c.pk]
    assert api.get("/api/coaches/?status=active").json()["count"] == 0

    r = api.post(f"/api/coaches/{c.pk}/extend/", {"days": 30})
    assert r.status_code == 200 and r.json()["status"] == "active" and r.json()["daysLeft"] == 30
    assert AuditEvent.objects.filter(action="coach.extend").exists()


def test_extend_adds_to_current_end_date(api, admin, coach):
    before = coach.expires_at
    api.as_user(admin).post(f"/api/coaches/{coach.pk}/extend/", {})
    coach.refresh_from_db()
    assert coach.expires_at - before == timedelta(days=30)


def test_deactivate_coach_ends_sessions(api, admin, coach):
    coach_api = type(api)().as_user(coach.user)
    assert coach_api.get("/api/coach/profile/").status_code == 200
    r = api.as_user(admin).post(f"/api/coaches/{coach.pk}/status/", {"status": "inactive"})
    assert r.json()["status"] == "inactive"
    assert coach_api.get("/api/coach/profile/").status_code == 401


def test_permission_matrix_is_enforced(api, admin, support, coach):
    api.as_user(support)
    # support: no coach management, but branding is allowed by default
    assert api.post("/api/coaches/", NEW_COACH).status_code == 403
    assert api.post(f"/api/coaches/{coach.pk}/extend/", {}).status_code == 403
    assert api.patch(f"/api/coaches/{coach.pk}/", {"primary": "#0F6B5B"}).status_code == 200
    assert api.patch(f"/api/coaches/{coach.pk}/", {"athleteCap": 5}).status_code == 403
    assert api.get("/api/admin/audit-events/").status_code == 403

    r = api.as_user(admin).patch("/api/admin/settings/", {"permissions": {"br": [True, False]}})
    assert r.status_code == 200
    assert api.as_user(support).patch(f"/api/coaches/{coach.pk}/", {"primary": "#111111"}).status_code == 403
    # super admins can't lock themselves out of admin management
    assert api.as_user(admin).patch("/api/admin/settings/", {"permissions": {"adm": [False, False]}}).status_code == 400


def test_admins_never_see_health_or_training_data(api, admin, athlete):
    api.as_user(admin)
    r = api.get("/api/athletes/")
    assert r.status_code == 200 and r.json()["count"] == 1
    assert "health" not in r.json()["results"][0]
    assert api.get(f"/api/athletes/{athlete.pk}/health/").status_code == 403
    for url in ["/api/workouts/", "/api/measurements/", "/api/recovery/", "/api/records/", "/api/meal-logs/", f"/api/nutrition-plans/{athlete.pk}/"]:
        assert api.get(url).status_code == 403, url


def test_admin_athlete_actions(api, admin, athlete, other_coach):
    api.as_user(admin)
    r = api.post(f"/api/athletes/{athlete.pk}/transfer/", {"coachId": other_coach.pk})
    assert r.json()["coachId"] == other_coach.pk
    r = api.post("/api/athletes/bulk-status/", {"ids": [athlete.pk], "status": "inactive"})
    assert r.json() == {"updated": 1, "skipped": 0}
    r = api.post(f"/api/admin/users/{athlete.user.pk}/reset-link/", {"send": False})
    assert r.status_code == 200 and "/reset/" in r.json()["url"]
    assert AuditEvent.objects.filter(action="password.reset-link", actor=admin).exists()
    r = api.post(f"/api/admin/users/{athlete.user.pk}/reset-link/", {"send": True})
    assert r.json()["url"] is None and mail.outbox


def test_admin_users(api, admin):
    api.as_user(admin)
    r = api.post("/api/admin/admins/", {"name": "مریم", "email": "maryam@baseline.app", "role": "support"})
    assert r.status_code == 201 and r.json()["pending"] is True and mail.outbox
    assert api.post("/api/admin/admins/", {"name": "x", "email": "maryam@baseline.app", "role": "support"}).status_code == 400
    new = User.objects.get(email="maryam@baseline.app")
    assert api.patch(f"/api/admin/admins/{new.pk}/", {"role": "super"}).json()["role"] == "super"
    assert api.delete(f"/api/admin/admins/{admin.pk}/").status_code == 400  # not yourself
    assert api.delete(f"/api/admin/admins/{new.pk}/").status_code == 204
    assert api.patch(f"/api/admin/admins/{admin.pk}/", {"role": "support"}).status_code == 400  # last super


def test_admin_stats(api, admin, coach):
    make_coach("soon@x.app", expires_at=timezone.now() + timedelta(days=2))
    make_athlete(coach)
    s = api.as_user(admin).get("/api/admin/stats/").json()
    assert s["coaches"]["active"] == 2 and s["athletes"] == {"total": 1, "active": 1, "newMonth": 1}
    assert len(s["workoutsByDay"]) == 7 and s["coachLogins7d"] == 0
    assert [e["daysLeft"] for e in s["expiring"]] == [2]


def test_non_admins_are_refused(api, coach, athlete):
    for user in (coach.user, athlete.user):
        api.as_user(user)
        assert api.get("/api/coaches/").status_code == 403
        assert api.get("/api/admin/stats/").status_code == 403
        assert api.get("/api/admin/admins/").status_code == 403


def test_admin_invite_resend_and_link_email_override(api, admin, coach):
    api.as_user(admin)
    new = api.post("/api/admin/admins/", {"name": "م", "email": "m@baseline.app", "role": "support"}).json()
    r = api.post(f"/api/admin/admins/{new['id']}/invite/", {"send": False})
    assert r.status_code == 200 and "/invite/" in r.json()["url"]
    r = api.post(f"/api/admin/users/{coach.user.pk}/reset-link/", {"send": True, "email": "other@example.com"})
    assert r.json()["sent"] is True and mail.outbox[-1].to == ["other@example.com"]
    assert api.post(f"/api/admin/admins/{admin.pk}/invite/", {"send": True}).status_code == 400


def test_coach_summary(api, admin, coach, athlete):
    s = api.as_user(admin).get(f"/api/coaches/{coach.pk}/summary/").json()
    assert s["athletes"] == 1 and s["activeAthletes"] == 1 and s["workoutsWeek"] == 0


def test_any_admin_reads_the_admin_list_but_only_adm_changes_it(api, admin, support):
    api.as_user(support)
    assert api.get("/api/admin/admins/").status_code == 200
    assert api.post("/api/admin/admins/", {"name": "x", "email": "x@baseline.app", "role": "support"}).status_code == 403
    assert api.patch(f"/api/admin/admins/{admin.pk}/", {"role": "support"}).status_code == 403


def test_admin_made_in_django_admin_gets_a_role():
    boss = User.objects.create(username="boss@x.y", email="boss@x.y", name="Boss", role="admin", is_superuser=True)
    helper = User.objects.create(username="help@x.y", email="help@x.y", name="Help", role="admin")
    assert (boss.admin_role, helper.admin_role) == ("super", "support")
